import { test, expect } from '@playwright/test';
import { TestHelpers } from '../utils/TestHelpers';
import { MockBlockchain } from '../fixtures/MockBlockchain';

test.describe('🔗 Partial Fills E2E Tests', () => {
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

  test('should handle multiple resolver partial fills', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForSelector('[data-testid="swap-interface"]');
    
    // Connect wallets
    await page.click('[data-testid="connect-wallets-btn"]');
    await page.waitForSelector('[data-testid="wallet-connected"]');
    
    // Set up large swap for partial fills
    await page.fill('[data-testid="from-amount-input"]', '10.0');
    await page.selectOption('[data-testid="from-token-select"]', 'ETH');
    await page.selectOption('[data-testid="to-token-select"]', 'XLM');
    
    // Enable partial fills
    await page.check('[data-testid="partial-fills-toggle"]');
    
    // Configure partial fill settings
    await page.click('[data-testid="advanced-settings-toggle"]');
    await page.fill('[data-testid="max-resolvers-input"]', '5');
    await page.fill('[data-testid="min-fill-size-input"]', '10'); // 10% minimum
    
    // Initiate swap
    await page.click('[data-testid="initiate-swap-btn"]');
    await page.click('[data-testid="confirm-swap-btn"]');
    
    // Wait for swap progress
    await page.waitForSelector('[data-testid="swap-progress"]');
    
    // Simulate Dutch auction start
    await mockBlockchain.emitAuctionStarted({
      swapId: 'test-partial-123',
      startPrice: 100000, // 100%
      reservePrice: 95000, // 95%
      duration: 300, // 5 minutes
    });
    
    // Verify auction interface
    await expect(page.locator('[data-testid="auction-active"]')).toBeVisible();
    await expect(page.locator('[data-testid="auction-timer"]')).toBeVisible();
    await expect(page.locator('[data-testid="current-price"]')).toContainText('100%');
    
    // Simulate resolver bids coming in
    const resolvers = [
      { address: '0xResolver1', reputation: 1250, stake: '3.0 ETH' },
      { address: '0xResolver2', reputation: 1180, stake: '2.5 ETH' },
      { address: '0xResolver3', reputation: 1350, stake: '4.0 ETH' },
      { address: '0xResolver4', reputation: 1100, stake: '2.0 ETH' },
      { address: '0xResolver5', reputation: 1420, stake: '5.0 ETH' },
    ];
    
    // Emit resolver bids
    for (const [index, resolver] of resolvers.entries()) {
      await mockBlockchain.emitResolverBid({
        swapId: 'test-partial-123',
        resolver: resolver.address,
        bidPrice: 99500 - (index * 100), // Decreasing bids
        amount: '2000000000000000000', // 2 ETH each
        timestamp: Date.now() + (index * 1000),
      });
      
      // Wait for UI update
      await page.waitForTimeout(500);
      
      // Verify bid appears in UI
      await expect(page.locator(`[data-testid="bid-${index}"]`)).toBeVisible();
      await expect(page.locator(`[data-testid="resolver-${index}-address"]`)).toContainText(resolver.address.slice(0, 8));
      await expect(page.locator(`[data-testid="resolver-${index}-reputation"]`)).toContainText(resolver.reputation.toString());
    }
    
    // Verify resolver leaderboard
    await expect(page.locator('[data-testid="resolver-leaderboard"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-bids"]')).toContainText('5');
    
    // Simulate auction completion and fill execution
    await mockBlockchain.emitAuctionCompleted({
      swapId: 'test-partial-123',
      winningBids: [
        { resolver: '0xResolver3', price: 99500, amount: '2000000000000000000' },
        { resolver: '0xResolver1', price: 99400, amount: '2000000000000000000' },
        { resolver: '0xResolver5', price: 99300, amount: '2000000000000000000' },
        { resolver: '0xResolver2', price: 99200, amount: '2000000000000000000' },
        { resolver: '0xResolver4', price: 99100, amount: '2000000000000000000' },
      ],
    });
    
    // Verify auction results
    await expect(page.locator('[data-testid="auction-completed"]')).toBeVisible();
    await expect(page.locator('[data-testid="winning-resolvers"]')).toContainText('5');
    
    // Simulate partial fill executions
    const fills = [
      { resolver: '0xResolver3', amount: '2000000000000000000', txHash: '0xfill1' },
      { resolver: '0xResolver1', amount: '2000000000000000000', txHash: '0xfill2' },
      { resolver: '0xResolver5', amount: '2000000000000000000', txHash: '0xfill3' },
      { resolver: '0xResolver2', amount: '2000000000000000000', txHash: '0xfill4' },
      { resolver: '0xResolver4', amount: '2000000000000000000', txHash: '0xfill5' },
    ];
    
    let totalFilled = 0;
    for (const [index, fill] of fills.entries()) {
      totalFilled += 2; // 2 ETH per fill
      
      await mockBlockchain.emitPartialFill({
        swapId: 'test-partial-123',
        resolver: fill.resolver,
        amount: fill.amount,
        totalFilled: (totalFilled * 1e18).toString(),
        txHash: fill.txHash,
        gasUsed: '180000',
        gasPrice: '20000000000',
      });
      
      // Wait for UI update
      await page.waitForTimeout(1000);
      
      // Verify fill in progress list
      await expect(page.locator(`[data-testid="fill-${index}"]`)).toBeVisible();
      await expect(page.locator(`[data-testid="fill-${index}-resolver"]`)).toContainText(fill.resolver.slice(0, 8));
      await expect(page.locator(`[data-testid="fill-${index}-amount"]`)).toContainText('2.0 ETH');
      await expect(page.locator(`[data-testid="fill-${index}-status"]`)).toContainText('Executed');
      
      // Verify progress update
      const expectedProgress = (totalFilled / 10) * 100; // 10 ETH total
      await expect(page.locator('[data-testid="progress-percentage"]')).toContainText(`${expectedProgress}%`);
      await expect(page.locator('[data-testid="filled-amount"]')).toContainText(`${totalFilled}.0`);
      await expect(page.locator('[data-testid="remaining-amount"]')).toContainText(`${10 - totalFilled}.0`);
    }
    
    // Verify completion
    await expect(page.locator('[data-testid="swap-completed"]')).toBeVisible();
    await expect(page.locator('[data-testid="progress-percentage"]')).toContainText('100%');
    
    // Verify fill analytics
    await expect(page.locator('[data-testid="total-fills"]')).toContainText('5');
    await expect(page.locator('[data-testid="avg-fill-time"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-gas-used"]')).toBeVisible();
    await expect(page.locator('[data-testid="mev-savings"]')).toBeVisible();
    
    // Test fill details expansion
    await page.click('[data-testid="fill-0-details-btn"]');
    await expect(page.locator('[data-testid="fill-0-details"]')).toBeVisible();
    await expect(page.locator('[data-testid="fill-0-merkle-proof"]')).toBeVisible();
    await expect(page.locator('[data-testid="fill-0-gas-details"]')).toBeVisible();
  });

  test('should handle partial fill cancellation', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForSelector('[data-testid="swap-interface"]');
    
    // Connect wallets and set up swap
    await page.click('[data-testid="connect-wallets-btn"]');
    await page.waitForSelector('[data-testid="wallet-connected"]');
    
    await page.fill('[data-testid="from-amount-input"]', '5.0');
    await page.check('[data-testid="partial-fills-toggle"]');
    
    await page.click('[data-testid="initiate-swap-btn"]');
    await page.click('[data-testid="confirm-swap-btn"]');
    
    // Wait for partial fills to start
    await page.waitForSelector('[data-testid="swap-progress"]');
    
    // Simulate some partial fills
    await mockBlockchain.emitPartialFill({
      swapId: 'test-cancel-123',
      resolver: '0xResolver1',
      amount: '1000000000000000000', // 1 ETH
      totalFilled: '1000000000000000000',
    });
    
    await page.waitForTimeout(1000);
    
    // Cancel the swap
    await page.click('[data-testid="cancel-swap-btn"]');
    await page.waitForSelector('[data-testid="cancel-confirmation-dialog"]');
    
    // Verify cancellation warning
    await expect(page.locator('[data-testid="cancel-warning"]')).toContainText('1.0 ETH has already been filled');
    await expect(page.locator('[data-testid="refund-amount"]')).toContainText('4.0 ETH');
    
    // Confirm cancellation
    await page.click('[data-testid="confirm-cancel-btn"]');
    
    // Verify cancellation processing
    await page.waitForSelector('[data-testid="swap-cancelled"]');
    await expect(page.locator('[data-testid="swap-status"]')).toContainText('Cancelled');
    await expect(page.locator('[data-testid="partial-refund"]')).toContainText('4.0 ETH');
  });

  test('should handle resolver failure and recovery', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForSelector('[data-testid="swap-interface"]');
    
    // Set up swap with partial fills
    await page.click('[data-testid="connect-wallets-btn"]');
    await page.waitForSelector('[data-testid="wallet-connected"]');
    
    await page.fill('[data-testid="from-amount-input"]', '6.0');
    await page.check('[data-testid="partial-fills-toggle"]');
    
    await page.click('[data-testid="initiate-swap-btn"]');
    await page.click('[data-testid="confirm-swap-btn"]');
    
    // Wait for progress
    await page.waitForSelector('[data-testid="swap-progress"]');
    
    // Simulate successful fill
    await mockBlockchain.emitPartialFill({
      swapId: 'test-recovery-123',
      resolver: '0xResolver1',
      amount: '2000000000000000000', // 2 ETH
      totalFilled: '2000000000000000000',
      status: 'EXECUTED',
    });
    
    // Simulate resolver failure
    await mockBlockchain.emitPartialFillFailed({
      swapId: 'test-recovery-123',
      resolver: '0xResolver2',
      amount: '2000000000000000000',
      error: 'Resolver timeout',
    });
    
    // Verify failure handling
    await expect(page.locator('[data-testid="resolver-failure"]')).toBeVisible();
    await expect(page.locator('[data-testid="failed-resolver"]')).toContainText('0xResolver2');
    await expect(page.locator('[data-testid="failure-reason"]')).toContainText('timeout');
    
    // Simulate recovery with new resolver
    await mockBlockchain.emitResolverReplacement({
      swapId: 'test-recovery-123',
      failedResolver: '0xResolver2',
      replacementResolver: '0xResolver3',
      amount: '2000000000000000000',
    });
    
    // Verify recovery
    await expect(page.locator('[data-testid="resolver-replaced"]')).toBeVisible();
    await expect(page.locator('[data-testid="replacement-resolver"]')).toContainText('0xResolver3');
    
    // Continue with replacement resolver
    await mockBlockchain.emitPartialFill({
      swapId: 'test-recovery-123',
      resolver: '0xResolver3',
      amount: '2000000000000000000',
      totalFilled: '4000000000000000000',
      status: 'EXECUTED',
    });
    
    // Complete the swap
    await mockBlockchain.emitPartialFill({
      swapId: 'test-recovery-123',
      resolver: '0xResolver4',
      amount: '2000000000000000000',
      totalFilled: '6000000000000000000',
      status: 'EXECUTED',
    });
    
    // Verify successful completion despite resolver failure
    await expect(page.locator('[data-testid="swap-completed"]')).toBeVisible();
    await expect(page.locator('[data-testid="recovery-note"]')).toContainText('1 resolver was replaced during execution');
  });

  test('should optimize gas usage across multiple fills', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForSelector('[data-testid="swap-interface"]');
    
    // Enable gas optimization
    await page.click('[data-testid="connect-wallets-btn"]');
    await page.waitForSelector('[data-testid="wallet-connected"]');
    
    await page.fill('[data-testid="from-amount-input"]', '8.0');
    await page.check('[data-testid="partial-fills-toggle"]');
    
    // Enable gas optimization settings
    await page.click('[data-testid="advanced-settings-toggle"]');
    await page.check('[data-testid="gas-optimization-toggle"]');
    await page.check('[data-testid="batch-fills-toggle"]');
    
    await page.click('[data-testid="initiate-swap-btn"]');
    await page.click('[data-testid="confirm-swap-btn"]');
    
    // Wait for progress
    await page.waitForSelector('[data-testid="swap-progress"]');
    
    // Simulate batched fill execution
    await mockBlockchain.emitBatchedFills({
      swapId: 'test-gas-opt-123',
      fills: [
        { resolver: '0xResolver1', amount: '2000000000000000000' },
        { resolver: '0xResolver2', amount: '2000000000000000000' },
        { resolver: '0xResolver3', amount: '2000000000000000000' },
      ],
      batchTxHash: '0xbatch123',
      totalGasUsed: '450000', // Less than 3 individual txs
      gasSavings: '150000',
    });
    
    // Verify gas optimization results
    await expect(page.locator('[data-testid="gas-optimization-active"]')).toBeVisible();
    await expect(page.locator('[data-testid="batch-execution"]')).toBeVisible();
    await expect(page.locator('[data-testid="gas-savings"]')).toContainText('150,000');
    await expect(page.locator('[data-testid="batch-tx-hash"]')).toContainText('0xbatch123');
    
    // Complete remaining fills
    await mockBlockchain.emitPartialFill({
      swapId: 'test-gas-opt-123',
      resolver: '0xResolver4',
      amount: '2000000000000000000',
      totalFilled: '8000000000000000000',
    });
    
    // Verify final gas analytics
    await expect(page.locator('[data-testid="swap-completed"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-gas-savings"]')).toBeVisible();
    await expect(page.locator('[data-testid="efficiency-score"]')).toBeVisible();
  });

  test('should display real-time resolver performance', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Navigate to resolvers page
    await page.click('[data-testid="nav-resolvers"]');
    await page.waitForSelector('[data-testid="resolvers-page"]');
    
    // Verify resolver leaderboard
    await expect(page.locator('[data-testid="resolver-leaderboard"]')).toBeVisible();
    await expect(page.locator('[data-testid="resolver-count"]')).toBeVisible();
    
    // Simulate real-time resolver updates
    await mockBlockchain.emitResolverUpdate({
      resolver: '0xResolver1',
      newReputation: 1275,
      newVolume: '52000000000000000000',
      newSuccessRate: 9865,
      recentFill: {
        amount: '2000000000000000000',
        timestamp: Date.now(),
        profit: '15000000000000000',
      },
    });
    
    // Verify real-time updates
    await expect(page.locator('[data-testid="resolver-0xResolver1-reputation"]')).toContainText('1275');
    await expect(page.locator('[data-testid="resolver-0xResolver1-volume"]')).toContainText('52.0');
    await expect(page.locator('[data-testid="resolver-0xResolver1-success-rate"]')).toContainText('98.65%');
    
    // Test resolver details modal
    await page.click('[data-testid="resolver-0xResolver1-details"]');
    await page.waitForSelector('[data-testid="resolver-details-modal"]');
    
    // Verify detailed metrics
    await expect(page.locator('[data-testid="resolver-performance-chart"]')).toBeVisible();
    await expect(page.locator('[data-testid="recent-fills-list"]')).toBeVisible();
    await expect(page.locator('[data-testid="resolver-analytics"]')).toBeVisible();
  });
});
