import { test, expect } from '@playwright/test';
import { TestHelpers } from '../utils/TestHelpers';
import { MockBlockchain } from '../fixtures/MockBlockchain';

test.describe('↔️ Bidirectional Swap E2E Tests', () => {
  let testHelpers: TestHelpers;
  let mockBlockchain: MockBlockchain;

  test.beforeAll(async () => {
    testHelpers = new TestHelpers();
    mockBlockchain = new MockBlockchain();
    await mockBlockchain.setup();
  });

  test.afterAll(async () => {
    await mockBlockchain.cleanup();
  });

  test('should handle concurrent bidirectional swaps', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForSelector('[data-testid="swap-interface"]');
    
    // Connect wallets
    await page.click('[data-testid="connect-wallets-btn"]');
    await page.waitForSelector('[data-testid="wallet-connected"]');
    
    // Initiate first swap: ETH → XLM
    await page.fill('[data-testid="from-amount-input"]', '2.0');
    await page.selectOption('[data-testid="from-token-select"]', 'ETH');
    await page.selectOption('[data-testid="to-token-select"]', 'XLM');
    
    await page.click('[data-testid="initiate-swap-btn"]');
    await page.click('[data-testid="confirm-swap-btn"]');
    
    // Wait for first swap to be initiated
    await page.waitForSelector('[data-testid="swap-progress"]');
    
    // Open new swap tab/window for reverse swap
    await page.click('[data-testid="new-swap-btn"]');
    await page.waitForSelector('[data-testid="swap-interface-2"]');
    
    // Initiate second swap: XLM → ETH
    await page.fill('[data-testid="from-amount-input-2"]', '25000');
    await page.selectOption('[data-testid="from-token-select-2"]', 'XLM');
    await page.selectOption('[data-testid="to-token-select-2"]', 'ETH');
    
    await page.click('[data-testid="initiate-swap-btn-2"]');
    await page.click('[data-testid="confirm-swap-btn-2"]');
    
    // Verify both swaps are active
    await expect(page.locator('[data-testid="active-swaps-count"]')).toContainText('2');
    
    // Simulate progress for first swap
    await mockBlockchain.emitSwapProgress({
      swapId: 'bidirectional-1',
      status: 'PARTIAL_FILLED',
      progress: 50,
      filled: '1000000000000000000', // 1 ETH
    });
    
    // Simulate progress for second swap
    await mockBlockchain.emitSwapProgress({
      swapId: 'bidirectional-2',
      status: 'EXECUTING',
      progress: 75,
      filled: '18750000000', // 18,750 XLM
    });
    
    // Verify both swaps progress independently
    await expect(page.locator('[data-testid="swap-1-progress"]')).toContainText('50%');
    await expect(page.locator('[data-testid="swap-2-progress"]')).toContainText('75%');
    
    // Complete both swaps
    await mockBlockchain.emitSwapCompleted({
      swapId: 'bidirectional-1',
      totalAmount: '2000000000000000000',
    });
    
    await mockBlockchain.emitSwapCompleted({
      swapId: 'bidirectional-2',
      totalAmount: '25000000000',
    });
    
    // Verify both completions
    await expect(page.locator('[data-testid="swap-1-completed"]')).toBeVisible();
    await expect(page.locator('[data-testid="swap-2-completed"]')).toBeVisible();
    await expect(page.locator('[data-testid="active-swaps-count"]')).toContainText('0');
  });

  test('should optimize resolver utilization across directions', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForSelector('[data-testid="swap-interface"]');
    
    // Connect wallets
    await page.click('[data-testid="connect-wallets-btn"]');
    await page.waitForSelector('[data-testid="wallet-connected"]');
    
    // Check resolver availability for both directions
    await page.click('[data-testid="check-resolver-availability"]');
    await page.waitForSelector('[data-testid="resolver-analysis"]');
    
    // Verify resolver distribution analysis
    await expect(page.locator('[data-testid="eth-to-xlm-resolvers"]')).toBeVisible();
    await expect(page.locator('[data-testid="xlm-to-eth-resolvers"]')).toBeVisible();
    await expect(page.locator('[data-testid="optimal-direction"]')).toBeVisible();
    
    // Test optimal direction recommendation
    await mockBlockchain.emitResolverAnalysis({
      ethToXlmResolvers: 8,
      xlmToEthResolvers: 3,
      recommendedDirection: 'ETH_TO_XLM',
      reason: 'Better liquidity and more competitive rates',
    });
    
    await expect(page.locator('[data-testid="direction-recommendation"]')).toContainText('ETH → XLM');
    await expect(page.locator('[data-testid="recommendation-reason"]')).toContainText('Better liquidity');
    
    // Initiate swap in recommended direction
    await page.fill('[data-testid="from-amount-input"]', '3.0');
    await page.selectOption('[data-testid="from-token-select"]', 'ETH');
    await page.selectOption('[data-testid="to-token-select"]', 'XLM');
    
    await page.click('[data-testid="initiate-swap-btn"]');
    await page.click('[data-testid="confirm-swap-btn"]');
    
    // Verify optimal resolver selection
    await page.waitForSelector('[data-testid="resolver-selection"]');
    await expect(page.locator('[data-testid="selected-resolvers-count"]')).toContainText('8');
    await expect(page.locator('[data-testid="competition-level"]')).toContainText('High');
  });

  test('should handle cross-direction arbitrage opportunities', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Navigate to analytics page
    await page.click('[data-testid="nav-analytics"]');
    await page.waitForSelector('[data-testid="analytics-page"]');
    
    // Check arbitrage opportunities
    await expect(page.locator('[data-testid="arbitrage-monitor"]')).toBeVisible();
    
    // Simulate arbitrage opportunity detection
    await mockBlockchain.emitArbitrageOpportunity({
      direction1: { from: 'ETH', to: 'XLM', rate: 15100 },
      direction2: { from: 'XLM', to: 'ETH', rate: 0.000067 },
      profitMargin: 2.3,
      volume: '5000000000000000000', // 5 ETH
      timeWindow: 300, // 5 minutes
    });
    
    // Verify arbitrage alert
    await expect(page.locator('[data-testid="arbitrage-alert"]')).toBeVisible();
    await expect(page.locator('[data-testid="profit-margin"]')).toContainText('2.3%');
    await expect(page.locator('[data-testid="arbitrage-volume"]')).toContainText('5.0 ETH');
    
    // Test arbitrage execution
    await page.click('[data-testid="execute-arbitrage-btn"]');
    await page.waitForSelector('[data-testid="arbitrage-execution"]');
    
    // Verify arbitrage swap initiation
    await expect(page.locator('[data-testid="arbitrage-swap-1"]')).toBeVisible();
    await expect(page.locator('[data-testid="arbitrage-swap-2"]')).toBeVisible();
    
    // Simulate arbitrage completion
    await mockBlockchain.emitArbitrageCompleted({
      profit: '115000000000000000', // 0.115 ETH profit
      totalGas: '420000',
      netProfit: '105000000000000000', // After gas
    });
    
    // Verify arbitrage results
    await expect(page.locator('[data-testid="arbitrage-completed"]')).toBeVisible();
    await expect(page.locator('[data-testid="net-profit"]')).toContainText('0.105 ETH');
  });

  test('should maintain consistent rates across directions', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForSelector('[data-testid="swap-interface"]');
    
    // Test rate consistency
    await page.fill('[data-testid="from-amount-input"]', '1.0');
    
    // Check ETH → XLM rate
    await page.selectOption('[data-testid="from-token-select"]', 'ETH');
    await page.selectOption('[data-testid="to-token-select"]', 'XLM');
    
    await page.waitForSelector('[data-testid="exchange-rate"]');
    const ethToXlmRate = await page.locator('[data-testid="exchange-rate"]').textContent();
    const ethToXlmAmount = await page.locator('[data-testid="to-amount-display"]').textContent();
    
    // Switch directions
    await page.click('[data-testid="swap-direction-toggle"]');
    
    // Verify XLM → ETH rate consistency
    await page.waitForSelector('[data-testid="exchange-rate"]');
    const xlmToEthRate = await page.locator('[data-testid="exchange-rate"]').textContent();
    const xlmToEthAmount = await page.locator('[data-testid="to-amount-display"]').textContent();
    
    // Calculate expected consistency (accounting for slippage and fees)
    const expectedConsistency = parseFloat(ethToXlmAmount || '0') * parseFloat(xlmToEthRate || '0');
    expect(expectedConsistency).toBeCloseTo(1.0, 2); // Within 1% of 1.0
    
    // Test rate stability over time
    await page.waitForTimeout(5000);
    
    const stableRate = await page.locator('[data-testid="exchange-rate"]').textContent();
    expect(stableRate).toBe(xlmToEthRate); // Rate should remain stable
  });

  test('should handle liquidity imbalances across directions', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForSelector('[data-testid="swap-interface"]');
    
    // Simulate liquidity imbalance
    await mockBlockchain.emitLiquidityUpdate({
      ethToXlmLiquidity: '1000000000000000000000', // 1000 ETH
      xlmToEthLiquidity: '500000000000000000000',  // 500 ETH equivalent
      imbalanceRatio: 2.0,
      rebalanceNeeded: true,
    });
    
    // Check liquidity warnings
    await expect(page.locator('[data-testid="liquidity-warning"]')).toBeVisible();
    await expect(page.locator('[data-testid="imbalance-ratio"]')).toContainText('2.0');
    
    // Test impact on swap rates
    await page.fill('[data-testid="from-amount-input"]', '100');
    await page.selectOption('[data-testid="from-token-select"]', 'ETH');
    await page.selectOption('[data-testid="to-token-select"]', 'XLM');
    
    // Large ETH → XLM swap should have minimal impact (high liquidity)
    await expect(page.locator('[data-testid="price-impact"]')).toContainText('0.1%');
    
    // Switch to constrained direction
    await page.click('[data-testid="swap-direction-toggle"]');
    
    // Equivalent XLM → ETH swap should have higher impact (low liquidity)
    await expect(page.locator('[data-testid="price-impact"]')).toContainText('2.3%');
    await expect(page.locator('[data-testid="liquidity-warning"]')).toContainText('Limited liquidity');
    
    // Test automatic rebalancing trigger
    await page.click('[data-testid="trigger-rebalance-btn"]');
    await page.waitForSelector('[data-testid="rebalancing-active"]');
    
    // Verify rebalancing progress
    await expect(page.locator('[data-testid="rebalance-status"]')).toContainText('In Progress');
    await expect(page.locator('[data-testid="rebalance-eta"]')).toBeVisible();
  });

  test('should provide comprehensive swap analytics', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Navigate to analytics
    await page.click('[data-testid="nav-analytics"]');
    await page.waitForSelector('[data-testid="analytics-page"]');
    
    // Check directional volume analytics
    await expect(page.locator('[data-testid="directional-volume-chart"]')).toBeVisible();
    await expect(page.locator('[data-testid="eth-to-xlm-volume"]')).toBeVisible();
    await expect(page.locator('[data-testid="xlm-to-eth-volume"]')).toBeVisible();
    
    // Test time range selection
    await page.selectOption('[data-testid="analytics-timerange"]', '24h');
    await page.waitForSelector('[data-testid="chart-updated"]');
    
    // Verify 24h analytics
    await expect(page.locator('[data-testid="24h-eth-to-xlm-count"]')).toBeVisible();
    await expect(page.locator('[data-testid="24h-xlm-to-eth-count"]')).toBeVisible();
    await expect(page.locator('[data-testid="24h-volume-ratio"]')).toBeVisible();
    
    // Test resolver performance by direction
    await page.click('[data-testid="resolver-performance-tab"]');
    await expect(page.locator('[data-testid="resolver-direction-performance"]')).toBeVisible();
    
    // Verify resolver specialization metrics
    await expect(page.locator('[data-testid="eth-specialist-resolvers"]')).toBeVisible();
    await expect(page.locator('[data-testid="xlm-specialist-resolvers"]')).toBeVisible();
    await expect(page.locator('[data-testid="bidirectional-resolvers"]')).toBeVisible();
    
    // Test success rate comparison
    await expect(page.locator('[data-testid="direction-success-rates"]')).toBeVisible();
    await expect(page.locator('[data-testid="eth-to-xlm-success-rate"]')).toBeVisible();
    await expect(page.locator('[data-testid="xlm-to-eth-success-rate"]')).toBeVisible();
  });
});
