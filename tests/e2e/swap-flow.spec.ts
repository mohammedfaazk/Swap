import { test, expect, Page } from '@playwright/test';
import { TestHelpers } from '../utils/TestHelpers';
import { MockBlockchain } from '../fixtures/MockBlockchain';

test.describe('🔄 Complete Swap Flow E2E Tests', () => {
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

  test('should complete ETH to XLM swap successfully', async ({ page }) => {
    // Navigate to the application
    await page.goto('http://localhost:3000');
    
    // Wait for the app to load
    await page.waitForSelector('[data-testid="swap-interface"]');
    
    // Verify page title
    await expect(page).toHaveTitle(/StellarBridge Fusion\+/);
    
    // Connect wallets (mock wallet connection)
    await page.click('[data-testid="connect-wallets-btn"]');
    await page.waitForSelector('[data-testid="wallet-connected"]');
    
    // Verify wallet connection status
    await expect(page.locator('[data-testid="wallet-status"]')).toContainText('Connected');
    
    // Set up swap parameters
    await page.fill('[data-testid="from-amount-input"]', '1.5');
    await page.selectOption('[data-testid="from-token-select"]', 'ETH');
    await page.selectOption('[data-testid="to-token-select"]', 'XLM');
    
    // Verify exchange rate calculation
    await expect(page.locator('[data-testid="to-amount-display"]')).toContainText('22,500');
    
    // Enable partial fills
    await page.check('[data-testid="partial-fills-toggle"]');
    
    // Set slippage tolerance
    await page.fill('[data-testid="slippage-input"]', '0.5');
    
    // Initiate swap
    await page.click('[data-testid="initiate-swap-btn"]');
    
    // Wait for confirmation dialog
    await page.waitForSelector('[data-testid="swap-confirmation-dialog"]');
    
    // Verify swap details in confirmation
    await expect(page.locator('[data-testid="confirm-from-amount"]')).toContainText('1.5 ETH');
    await expect(page.locator('[data-testid="confirm-to-amount"]')).toContainText('22,500 XLM');
    await expect(page.locator('[data-testid="confirm-slippage"]')).toContainText('0.5%');
    
    // Confirm swap
    await page.click('[data-testid="confirm-swap-btn"]');
    
    // Wait for swap to be initiated
    await page.waitForSelector('[data-testid="swap-progress"]');
    
    // Verify initial progress state
    await expect(page.locator('[data-testid="swap-status"]')).toContainText('Initiated');
    await expect(page.locator('[data-testid="progress-bar"]')).toBeVisible();
    
    // Mock blockchain events to simulate swap progress
    await mockBlockchain.emitSwapInitiated({
      swapId: 'test-swap-123',
      fromAmount: '1500000000000000000', // 1.5 ETH in wei
      toAmount: '225000000000', // 22,500 XLM in stroops
    });
    
    // Wait for source lock confirmation
    await page.waitForSelector('[data-testid="status-locked-source"]');
    await expect(page.locator('[data-testid="swap-status"]')).toContainText('Locked Source');
    
    // Simulate partial fills
    const partialFills = [
      { amount: '500000000000000000', resolver: '0xResolver1' }, // 0.5 ETH
      { amount: '500000000000000000', resolver: '0xResolver2' }, // 0.5 ETH
      { amount: '500000000000000000', resolver: '0xResolver3' }, // 0.5 ETH
    ];
    
    for (const [index, fill] of partialFills.entries()) {
      await mockBlockchain.emitPartialFill({
        swapId: 'test-swap-123',
        resolver: fill.resolver,
        amount: fill.amount,
        totalFilled: ((index + 1) * 0.5).toString(),
      });
      
      // Wait for UI update
      await page.waitForTimeout(1000);
      
      // Verify partial fill in UI
      await expect(page.locator(`[data-testid="partial-fill-${index}"]`)).toBeVisible();
      await expect(page.locator('[data-testid="filled-amount"]')).toContainText(`${(index + 1) * 0.5}`);
    }
    
    // Verify partial fills list
    await expect(page.locator('[data-testid="partial-fills-list"]')).toBeVisible();
    await expect(page.locator('[data-testid="resolver-count"]')).toContainText('3');
    
    // Simulate swap completion
    await mockBlockchain.emitSwapCompleted({
      swapId: 'test-swap-123',
      totalAmount: '1500000000000000000',
      secret: '0xsecret123',
    });
    
    // Wait for completion
    await page.waitForSelector('[data-testid="swap-completed"]');
    
    // Verify completion state
    await expect(page.locator('[data-testid="swap-status"]')).toContainText('Completed');
    await expect(page.locator('[data-testid="progress-bar"]')).toHaveAttribute('aria-valuenow', '100');
    await expect(page.locator('[data-testid="completion-time"]')).toBeVisible();
    
    // Verify success animation
    await expect(page.locator('[data-testid="success-animation"]')).toBeVisible();
    
    // Check transaction hashes
    await expect(page.locator('[data-testid="source-tx-hash"]')).toBeVisible();
    await expect(page.locator('[data-testid="dest-tx-hash"]')).toBeVisible();
    
    // Verify final amounts
    await expect(page.locator('[data-testid="final-from-amount"]')).toContainText('1.5 ETH');
    await expect(page.locator('[data-testid="final-to-amount"]')).toContainText('22,500 XLM');
    
    // Test navigation to swap details
    await page.click('[data-testid="view-details-btn"]');
    await page.waitForSelector('[data-testid="swap-details-page"]');
    
    // Verify swap details page
    await expect(page.locator('[data-testid="swap-id"]')).toContainText('test-swap-123');
    await expect(page.locator('[data-testid="swap-timeline"]')).toBeVisible();
    await expect(page.locator('[data-testid="resolver-performance"]')).toBeVisible();
  });

  test('should handle XLM to ETH swap', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForSelector('[data-testid="swap-interface"]');
    
    // Connect wallets
    await page.click('[data-testid="connect-wallets-btn"]');
    await page.waitForSelector('[data-testid="wallet-connected"]');
    
    // Set up reverse swap
    await page.fill('[data-testid="from-amount-input"]', '15000');
    await page.selectOption('[data-testid="from-token-select"]', 'XLM');
    await page.selectOption('[data-testid="to-token-select"]', 'ETH');
    
    // Verify reverse exchange rate
    await expect(page.locator('[data-testid="to-amount-display"]')).toContainText('1.0');
    
    // Disable partial fills for this test
    await page.uncheck('[data-testid="partial-fills-toggle"]');
    
    // Initiate swap
    await page.click('[data-testid="initiate-swap-btn"]');
    await page.click('[data-testid="confirm-swap-btn"]');
    
    // Wait for progress
    await page.waitForSelector('[data-testid="swap-progress"]');
    
    // Simulate atomic completion (no partial fills)
    await mockBlockchain.emitSwapCompleted({
      swapId: 'test-swap-456',
      totalAmount: '15000000000', // 15,000 XLM in stroops
      secret: '0xsecret456',
    });
    
    // Verify completion
    await page.waitForSelector('[data-testid="swap-completed"]');
    await expect(page.locator('[data-testid="swap-status"]')).toContainText('Completed');
  });

  test('should handle swap failure gracefully', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForSelector('[data-testid="swap-interface"]');
    
    // Connect wallets
    await page.click('[data-testid="connect-wallets-btn"]');
    await page.waitForSelector('[data-testid="wallet-connected"]');
    
    // Set up swap
    await page.fill('[data-testid="from-amount-input"]', '2.0');
    await page.selectOption('[data-testid="from-token-select"]', 'ETH');
    await page.selectOption('[data-testid="to-token-select"]', 'XLM');
    
    // Initiate swap
    await page.click('[data-testid="initiate-swap-btn"]');
    await page.click('[data-testid="confirm-swap-btn"]');
    
    // Wait for progress
    await page.waitForSelector('[data-testid="swap-progress"]');
    
    // Simulate swap failure
    await mockBlockchain.emitSwapFailed({
      swapId: 'test-swap-789',
      error: 'Insufficient liquidity',
      refundAmount: '2000000000000000000',
    });
    
    // Verify failure handling
    await page.waitForSelector('[data-testid="swap-failed"]');
    await expect(page.locator('[data-testid="swap-status"]')).toContainText('Failed');
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Insufficient liquidity');
    
    // Verify refund information
    await expect(page.locator('[data-testid="refund-amount"]')).toContainText('2.0 ETH');
    await expect(page.locator('[data-testid="refund-btn"]')).toBeEnabled();
    
    // Test refund process
    await page.click('[data-testid="refund-btn"]');
    await page.waitForSelector('[data-testid="refund-success"]');
    await expect(page.locator('[data-testid="refund-status"]')).toContainText('Refunded');
  });

  test('should validate input parameters', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForSelector('[data-testid="swap-interface"]');
    
    // Test invalid amount
    await page.fill('[data-testid="from-amount-input"]', '-1');
    await expect(page.locator('[data-testid="amount-error"]')).toContainText('Amount must be positive');
    
    // Test zero amount
    await page.fill('[data-testid="from-amount-input"]', '0');
    await expect(page.locator('[data-testid="amount-error"]')).toContainText('Amount must be greater than 0');
    
    // Test excessive amount
    await page.fill('[data-testid="from-amount-input"]', '999999');
    await expect(page.locator('[data-testid="amount-error"]')).toContainText('Insufficient balance');
    
    // Test same token selection
    await page.selectOption('[data-testid="from-token-select"]', 'ETH');
    await page.selectOption('[data-testid="to-token-select"]', 'ETH');
    await expect(page.locator('[data-testid="token-error"]')).toContainText('Cannot swap to same token');
    
    // Test invalid slippage
    await page.fill('[data-testid="slippage-input"]', '50');
    await expect(page.locator('[data-testid="slippage-error"]')).toContainText('Slippage too high');
  });

  test('should handle real-time updates via WebSocket', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForSelector('[data-testid="swap-interface"]');
    
    // Connect wallets and initiate swap
    await page.click('[data-testid="connect-wallets-btn"]');
    await page.waitForSelector('[data-testid="wallet-connected"]');
    
    await page.fill('[data-testid="from-amount-input"]', '1.0');
    await page.click('[data-testid="initiate-swap-btn"]');
    await page.click('[data-testid="confirm-swap-btn"]');
    
    // Wait for WebSocket connection
    await page.waitForSelector('[data-testid="websocket-connected"]');
    
    // Verify real-time status updates
    await mockBlockchain.emitStatusUpdate({
      swapId: 'test-swap-realtime',
      status: 'LOCKED_SOURCE',
      progress: 25,
    });
    
    // Verify UI updates in real-time
    await expect(page.locator('[data-testid="swap-status"]')).toContainText('Locked Source');
    await expect(page.locator('[data-testid="progress-percentage"]')).toContainText('25%');
    
    // Test resolver bid updates
    await mockBlockchain.emitResolverBid({
      swapId: 'test-swap-realtime',
      resolver: '0xResolver1',
      bidPrice: 99200,
      amount: '500000000000000000',
    });
    
    await expect(page.locator('[data-testid="active-bids"]')).toBeVisible();
    await expect(page.locator('[data-testid="bid-count"]')).toContainText('1');
  });

  test('should handle network disconnection gracefully', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForSelector('[data-testid="swap-interface"]');
    
    // Simulate network offline
    await page.context().setOffline(true);
    
    // Verify offline indicator
    await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible();
    await expect(page.locator('[data-testid="offline-message"]')).toContainText('Connection lost');
    
    // Verify swap button is disabled
    await expect(page.locator('[data-testid="initiate-swap-btn"]')).toBeDisabled();
    
    // Restore connection
    await page.context().setOffline(false);
    
    // Verify reconnection
    await page.waitForSelector('[data-testid="online-indicator"]');
    await expect(page.locator('[data-testid="initiate-swap-btn"]')).toBeEnabled();
  });
});
