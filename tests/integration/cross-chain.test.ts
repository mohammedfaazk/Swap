import { describe, beforeAll, afterAll, beforeEach, it, expect } from '@jest/globals';
import { ethers } from 'ethers';
import * as StellarSdk from 'stellar-sdk';
import { CrossChainCoordinator } from '../../relayer/src/coordination/CrossChainCoordinator';
import { EthereumMonitor } from '../../relayer/src/monitors/EthereumMonitor';
import { StellarMonitor } from '../../relayer/src/monitors/StellarMonitor';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { TestHelper } from '../utils/TestHelper';

describe('🔗 Cross-Chain Integration Tests', () => {
  let prisma: PrismaClient;
  let redis: Redis;
  let ethereumMonitor: EthereumMonitor;
  let stellarMonitor: StellarMonitor;
  let coordinator: CrossChainCoordinator;
  let testHelper: TestHelper;

  beforeAll(async () => {
    // Initialize test environment
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/stellarbridge_test'
        }
      }
    });

    redis = new Redis(process.env.TEST_REDIS_URL || 'redis://localhost:6379/1');
    testHelper = new TestHelper(prisma, redis);

    // Initialize blockchain monitors
    ethereumMonitor = new EthereumMonitor(prisma, redis);
    stellarMonitor = new StellarMonitor(prisma, redis);

    // Initialize coordinator
    coordinator = new CrossChainCoordinator(ethereumMonitor, stellarMonitor, prisma);

    // Setup test environment
    await testHelper.setupTestEnvironment();
    
    // Start services
    await ethereumMonitor.start();
    await stellarMonitor.start();
    await coordinator.start();
  });

  afterAll(async () => {
    await ethereumMonitor.stop();
    await stellarMonitor.stop();
    await coordinator.stop();
    await testHelper.cleanup();
    await prisma.$disconnect();
    await redis.quit();
  });

  beforeEach(async () => {
    await testHelper.resetTestData();
  });

  describe('Ethereum to Stellar Swaps', () => {
    it('should complete atomic ETH to XLM swap', async () => {
      const swapRequest = {
        fromChain: 'ethereum' as const,
        toChain: 'stellar' as const,
        fromToken: 'ETH',
        toToken: 'XLM',
        amount: '1000000000000000000', // 1 ETH
        userAddress: testHelper.getTestEthereumAddress(),
        destinationAddress: testHelper.getTestStellarAddress(),
        timelock: 3600,
        partialFillsEnabled: false,
        slippage: 0.5,
      };

      // Initiate swap
      const result = await coordinator.initiateSwap(swapRequest);
      
      expect(result.swapId).toBeDefined();
      expect(result.secret).toBeDefined();
      expect(result.secretHash).toBeDefined();
      expect(result.estimatedTime).toBeGreaterThan(0);

      // Verify swap creation in database
      const swap = await prisma.swap.findUnique({
        where: { id: result.swapId }
      });
      
      expect(swap).toBeTruthy();
      expect(swap?.state).toBe('INITIATED');
      expect(swap?.amount).toBe(swapRequest.amount);

      // Simulate Ethereum contract interaction
      const ethTxHash = await testHelper.simulateEthereumSwapInitiation({
        swapId: result.swapId,
        secretHash: result.secretHash,
        amount: swapRequest.amount,
        timelock: swapRequest.timelock,
      });

      // Wait for Ethereum event processing
      await testHelper.waitForEventProcessing();

      // Verify swap state update
      const updatedSwap = await prisma.swap.findUnique({
        where: { id: result.swapId }
      });
      
      expect(updatedSwap?.state).toBe('LOCKED_SOURCE');
      expect(updatedSwap?.sourceChainTxHash).toBe(ethTxHash);

      // Simulate Stellar completion
      const stellarTxHash = await testHelper.simulateStellarSwapCompletion({
        swapId: result.swapId,
        secret: result.secret,
        amount: '150000000000', // 15,000 XLM in stroops
      });

      // Wait for completion processing
      await testHelper.waitForEventProcessing();

      // Verify final state
      const completedSwap = await prisma.swap.findUnique({
        where: { id: result.swapId }
      });
      
      expect(completedSwap?.state).toBe('COMPLETED');
      expect(completedSwap?.destChainTxHash).toBe(stellarTxHash);
      expect(completedSwap?.completedAt).toBeTruthy();
    });

    it('should handle partial fills with multiple resolvers', async () => {
      const swapRequest = {
        fromChain: 'ethereum' as const,
        toChain: 'stellar' as const,
        fromToken: 'ETH',
        toToken: 'XLM',
        amount: '5000000000000000000', // 5 ETH
        userAddress: testHelper.getTestEthereumAddress(),
        destinationAddress: testHelper.getTestStellarAddress(),
        timelock: 3600,
        partialFillsEnabled: true,
        slippage: 1.0,
      };

      const result = await coordinator.initiateSwap(swapRequest);

      // Register test resolvers
      const resolvers = await testHelper.registerTestResolvers(3);

      // Simulate Ethereum swap initiation
      await testHelper.simulateEthereumSwapInitiation({
        swapId: result.swapId,
        secretHash: result.secretHash,
        amount: swapRequest.amount,
        timelock: swapRequest.timelock,
      });

      await testHelper.waitForEventProcessing();

      // Simulate partial fills from different resolvers
      const partialFills = [
        { resolver: resolvers[0].address, amount: '2000000000000000000' }, // 2 ETH
        { resolver: resolvers[1].address, amount: '1500000000000000000' }, // 1.5 ETH
        { resolver: resolvers[2].address, amount: '1500000000000000000' }, // 1.5 ETH
      ];

      let totalFilled = BigInt(0);
      for (const fill of partialFills) {
        totalFilled += BigInt(fill.amount);

        await testHelper.simulatePartialFill({
          swapId: result.swapId,
          resolver: fill.resolver,
          amount: fill.amount,
          totalFilled: totalFilled.toString(),
        });

        await testHelper.waitForEventProcessing();

        // Verify partial fill recorded
        const partialFill = await prisma.partialFill.findFirst({
          where: {
            swapId: result.swapId,
            resolverAddress: fill.resolver
          }
        });

        expect(partialFill).toBeTruthy();
        expect(partialFill?.amount).toBe(fill.amount);
        expect(partialFill?.status).toBe('EXECUTED');
      }

      // Verify final swap state
      const finalSwap = await prisma.swap.findUnique({
        where: { id: result.swapId },
        include: { partialFills: true }
      });

      expect(finalSwap?.state).toBe('COMPLETED');
      expect(finalSwap?.filled).toBe(swapRequest.amount);
      expect(finalSwap?.partialFills).toHaveLength(3);

      // Verify resolver performance updates
      for (const resolver of resolvers) {
        const updatedResolver = await prisma.resolver.findUnique({
          where: { address: resolver.address }
        });

        expect(updatedResolver?.totalVolume).not.toBe('0');
        expect(updatedResolver?.successRate).toBeGreaterThanOrEqual(10000);
      }
    });

    it('should handle swap timeout and refund', async () => {
      const swapRequest = {
        fromChain: 'ethereum' as const,
        toChain: 'stellar' as const,
        fromToken: 'ETH',
        toToken: 'XLM',
        amount: '1000000000000000000',
        userAddress: testHelper.getTestEthereumAddress(),
        destinationAddress: testHelper.getTestStellarAddress(),
        timelock: 1, // Very short timelock for testing
        partialFillsEnabled: false,
        slippage: 0.5,
      };

      const result = await coordinator.initiateSwap(swapRequest);

      // Simulate Ethereum swap initiation
      await testHelper.simulateEthereumSwapInitiation({
        swapId: result.swapId,
        secretHash: result.secretHash,
        amount: swapRequest.amount,
        timelock: swapRequest.timelock,
      });

      await testHelper.waitForEventProcessing();

      // Wait for timeout
      await testHelper.waitForTimeout(2000);

      // Process timeout
      await coordinator.processTimeouts();

      // Verify timeout handling
      const expiredSwap = await prisma.swap.findUnique({
        where: { id: result.swapId }
      });

      expect(expiredSwap?.state).toBe('EXPIRED');

      // Simulate refund
      await testHelper.simulateEthereumRefund({
        swapId: result.swapId,
        refundAmount: swapRequest.amount,
      });

      await testHelper.waitForEventProcessing();

      // Verify refund
      const refundedSwap = await prisma.swap.findUnique({
        where: { id: result.swapId }
      });

      expect(refundedSwap?.state).toBe('REFUNDED');
    });

    it('should handle resolver failure and replacement', async () => {
      const swapRequest = {
        fromChain: 'ethereum' as const,
        toChain: 'stellar' as const,
        fromToken: 'ETH',
        toToken: 'XLM',
        amount: '3000000000000000000', // 3 ETH
        userAddress: testHelper.getTestEthereumAddress(),
        destinationAddress: testHelper.getTestStellarAddress(),
        timelock: 3600,
        partialFillsEnabled: true,
        slippage: 1.0,
      };

      const result = await coordinator.initiateSwap(swapRequest);
      const resolvers = await testHelper.registerTestResolvers(4);

      // Initiate swap
      await testHelper.simulateEthereumSwapInitiation({
        swapId: result.swapId,
        secretHash: result.secretHash,
        amount: swapRequest.amount,
        timelock: swapRequest.timelock,
      });

      await testHelper.waitForEventProcessing();

      // Simulate successful partial fill
      await testHelper.simulatePartialFill({
        swapId: result.swapId,
        resolver: resolvers[0].address,
        amount: '1000000000000000000', // 1 ETH
        totalFilled: '1000000000000000000',
      });

      await testHelper.waitForEventProcessing();

      // Simulate resolver failure
      await testHelper.simulateResolverFailure({
        swapId: result.swapId,
        resolver: resolvers[1].address,
        amount: '1000000000000000000',
        error: 'Resolver timeout',
      });

      await testHelper.waitForEventProcessing();

      // Verify failure handling
      const failedFill = await prisma.partialFill.findFirst({
        where: {
          swapId: result.swapId,
          resolverAddress: resolvers[1].address
        }
      });

      expect(failedFill?.status).toBe('FAILED');

      // Verify resolver reputation impact
      const failedResolver = await prisma.resolver.findUnique({
        where: { address: resolvers[1].address }
      });

      expect(failedResolver?.reputation).toBeLessThan(1000);
      expect(failedResolver?.slashCount).toBeGreaterThan(0);

      // Complete swap with replacement resolver
      await testHelper.simulatePartialFill({
        swapId: result.swapId,
        resolver: resolvers[2].address,
        amount: '2000000000000000000', // 2 ETH (includes failed amount)
        totalFilled: '3000000000000000000',
      });

      await testHelper.waitForEventProcessing();

      // Verify successful completion despite failure
      const finalSwap = await prisma.swap.findUnique({
        where: { id: result.swapId }
      });

      expect(finalSwap?.state).toBe('COMPLETED');
      expect(finalSwap?.filled).toBe(swapRequest.amount);
    });
  });

  describe('Stellar to Ethereum Swaps', () => {
    it('should complete atomic XLM to ETH swap', async () => {
      const swapRequest = {
        fromChain: 'stellar' as const,
        toChain: 'ethereum' as const,
        fromToken: 'XLM',
        toToken: 'ETH',
        amount: '150000000000', // 15,000 XLM in stroops
        userAddress: testHelper.getTestStellarAddress(),
        destinationAddress: testHelper.getTestEthereumAddress(),
        timelock: 3600,
        partialFillsEnabled: false,
        slippage: 0.5,
      };

      const result = await coordinator.initiateSwap(swapRequest);

      // Simulate Stellar swap initiation
      const stellarTxHash = await testHelper.simulateStellarSwapInitiation({
        swapId: result.swapId,
        secretHash: result.secretHash,
        amount: swapRequest.amount,
        timelock: swapRequest.timelock,
      });

      await testHelper.waitForEventProcessing();

      // Verify swap state
      const initiatedSwap = await prisma.swap.findUnique({
        where: { id: result.swapId }
      });

      expect(initiatedSwap?.state).toBe('LOCKED_SOURCE');
      expect(initiatedSwap?.sourceChainTxHash).toBe(stellarTxHash);

      // Simulate Ethereum completion
      const ethTxHash = await testHelper.simulateEthereumSwapCompletion({
        swapId: result.swapId,
        secret: result.secret,
        amount: '1000000000000000000', // 1 ETH
      });

      await testHelper.waitForEventProcessing();

      // Verify completion
      const completedSwap = await prisma.swap.findUnique({
        where: { id: result.swapId }
      });

      expect(completedSwap?.state).toBe('COMPLETED');
      expect(completedSwap?.destChainTxHash).toBe(ethTxHash);
    });

    it('should handle large XLM swap with multiple resolvers', async () => {
      const swapRequest = {
        fromChain: 'stellar' as const,
        toChain: 'ethereum' as const,
        fromToken: 'XLM',
        toToken: 'ETH',
        amount: '1000000000000', // 100,000 XLM
        userAddress: testHelper.getTestStellarAddress(),
        destinationAddress: testHelper.getTestEthereumAddress(),
        timelock: 7200, // 2 hours
        partialFillsEnabled: true,
        slippage: 1.5,
      };

      const result = await coordinator.initiateSwap(swapRequest);
      const resolvers = await testHelper.registerTestResolvers(5);

      // Initiate large swap
      await testHelper.simulateStellarSwapInitiation({
        swapId: result.swapId,
        secretHash: result.secretHash,
        amount: swapRequest.amount,
        timelock: swapRequest.timelock,
      });

      await testHelper.waitForEventProcessing();

      // Simulate partial fills from multiple resolvers
      const partialFills = [
        { resolver: resolvers[0].address, amount: '200000000000' }, // 20,000 XLM
        { resolver: resolvers[1].address, amount: '200000000000' }, // 20,000 XLM
        { resolver: resolvers[2].address, amount: '200000000000' }, // 20,000 XLM
        { resolver: resolvers[3].address, amount: '200000000000' }, // 20,000 XLM
        { resolver: resolvers[4].address, amount: '200000000000' }, // 20,000 XLM
      ];

      let totalFilled = BigInt(0);
      for (const fill of partialFills) {
        totalFilled += BigInt(fill.amount);

        await testHelper.simulatePartialFill({
          swapId: result.swapId,
          resolver: fill.resolver,
          amount: fill.amount,
          totalFilled: totalFilled.toString(),
        });

        await testHelper.waitForEventProcessing();
      }

      // Verify completion
      const completedSwap = await prisma.swap.findUnique({
        where: { id: result.swapId },
        include: { partialFills: true }
      });

      expect(completedSwap?.state).toBe('COMPLETED');
      expect(completedSwap?.partialFills).toHaveLength(5);
      expect(completedSwap?.filled).toBe(swapRequest.amount);

      // Verify gas optimization across fills
      const totalGasUsed = completedSwap?.partialFills.reduce((sum, fill) => {
        return sum + parseInt(fill.gasUsed || '0');
      }, 0);

      expect(totalGasUsed).toBeLessThan(5 * 200000); // Should be optimized
    });
  });

  describe('Cross-Chain Event Processing', () => {
    it('should handle concurrent events from both chains', async () => {
      // Create multiple swaps in both directions
      const ethToXlmSwap = await coordinator.initiateSwap({
        fromChain: 'ethereum',
        toChain: 'stellar',
        fromToken: 'ETH',
        toToken: 'XLM',
        amount: '2000000000000000000',
        userAddress: testHelper.getTestEthereumAddress(),
        destinationAddress: testHelper.getTestStellarAddress(),
        timelock: 3600,
        partialFillsEnabled: true,
        slippage: 0.5,
      });

      const xlmToEthSwap = await coordinator.initiateSwap({
        fromChain: 'stellar',
        toChain: 'ethereum',
        fromToken: 'XLM',
        toToken: 'ETH',
        amount: '300000000000',
        userAddress: testHelper.getTestStellarAddress(),
        destinationAddress: testHelper.getTestEthereumAddress(),
        timelock: 3600,
        partialFillsEnabled: true,
        slippage: 0.5,
      });

      // Simulate concurrent events
      const promises = [
        testHelper.simulateEthereumSwapInitiation({
          swapId: ethToXlmSwap.swapId,
          secretHash: ethToXlmSwap.secretHash,
          amount: '2000000000000000000',
          timelock: 3600,
        }),
        testHelper.simulateStellarSwapInitiation({
          swapId: xlmToEthSwap.swapId,
          secretHash: xlmToEthSwap.secretHash,
          amount: '300000000000',
          timelock: 3600,
        }),
      ];

      await Promise.all(promises);
      await testHelper.waitForEventProcessing();

      // Verify both swaps processed correctly
      const ethSwap = await prisma.swap.findUnique({
        where: { id: ethToXlmSwap.swapId }
      });

      const xlmSwap = await prisma.swap.findUnique({
        where: { id: xlmToEthSwap.swapId }
      });

      expect(ethSwap?.state).toBe('LOCKED_SOURCE');
      expect(xlmSwap?.state).toBe('LOCKED_SOURCE');
    });

    it('should maintain event ordering and consistency', async () => {
      const swapRequest = {
        fromChain: 'ethereum' as const,
        toChain: 'stellar' as const,
        fromToken: 'ETH',
        toToken: 'XLM',
        amount: '3000000000000000000',
        userAddress: testHelper.getTestEthereumAddress(),
        destinationAddress: testHelper.getTestStellarAddress(),
        timelock: 3600,
        partialFillsEnabled: true,
        slippage: 1.0,
      };

      const result = await coordinator.initiateSwap(swapRequest);

      // Simulate rapid sequence of events
      const eventSequence = [
        () => testHelper.simulateEthereumSwapInitiation({
          swapId: result.swapId,
          secretHash: result.secretHash,
          amount: swapRequest.amount,
          timelock: swapRequest.timelock,
        }),
        () => testHelper.simulatePartialFill({
          swapId: result.swapId,
          resolver: '0xResolver1',
          amount: '1000000000000000000',
          totalFilled: '1000000000000000000',
        }),
        () => testHelper.simulatePartialFill({
          swapId: result.swapId,
          resolver: '0xResolver2',
          amount: '1000000000000000000',
          totalFilled: '2000000000000000000',
        }),
        () => testHelper.simulatePartialFill({
          swapId: result.swapId,
          resolver: '0xResolver3',
          amount: '1000000000000000000',
          totalFilled: '3000000000000000000',
        }),
      ];

      // Execute events rapidly
      for (const eventFn of eventSequence) {
        await eventFn();
        await testHelper.waitForTimeout(100); // Minimal delay
      }

      await testHelper.waitForEventProcessing();

      // Verify correct final state
      const finalSwap = await prisma.swap.findUnique({
        where: { id: result.swapId },
        include: { partialFills: true, swapEvents: true }
      });

      expect(finalSwap?.state).toBe('COMPLETED');
      expect(finalSwap?.partialFills).toHaveLength(3);
      expect(finalSwap?.swapEvents).toHaveLength(4); // 1 initiation + 3 fills

      // Verify event ordering
      const sortedEvents = finalSwap?.swapEvents.sort((a, b) => 
        a.timestamp.getTime() - b.timestamp.getTime()
      );

      expect(sortedEvents?.[0].eventType).toBe('SwapInitiated');
      expect(sortedEvents?.[1].eventType).toBe('PartialFillExecuted');
      expect(sortedEvents?.[2].eventType).toBe('PartialFillExecuted');
      expect(sortedEvents?.[3].eventType).toBe('PartialFillExecuted');
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle blockchain network failures', async () => {
      const swapRequest = {
        fromChain: 'ethereum' as const,
        toChain: 'stellar' as const,
        fromToken: 'ETH',
        toToken: 'XLM',
        amount: '1000000000000000000',
        userAddress: testHelper.getTestEthereumAddress(),
        destinationAddress: testHelper.getTestStellarAddress(),
        timelock: 3600,
        partialFillsEnabled: false,
        slippage: 0.5,
      };

      const result = await coordinator.initiateSwap(swapRequest);

      // Simulate network failure during processing
      await testHelper.simulateNetworkFailure('ethereum');

      // Attempt to process events (should handle gracefully)
      await testHelper.simulateEthereumSwapInitiation({
        swapId: result.swapId,
        secretHash: result.secretHash,
        amount: swapRequest.amount,
        timelock: swapRequest.timelock,
      });

      // Network recovery
      await testHelper.simulateNetworkRecovery('ethereum');
      await testHelper.waitForEventProcessing();

      // Verify recovery and processing
      const swap = await prisma.swap.findUnique({
        where: { id: result.swapId }
      });

      expect(swap?.state).toBe('LOCKED_SOURCE');
    });

    it('should handle invalid swap parameters gracefully', async () => {
      const invalidRequests = [
        {
          fromChain: 'ethereum' as const,
          toChain: 'stellar' as const,
          fromToken: 'ETH',
          toToken: 'XLM',
          amount: '0', // Invalid amount
          userAddress: testHelper.getTestEthereumAddress(),
          destinationAddress: testHelper.getTestStellarAddress(),
          timelock: 3600,
          partialFillsEnabled: false,
          slippage: 0.5,
        },
        {
          fromChain: 'ethereum' as const,
          toChain: 'stellar' as const,
          fromToken: 'ETH',
          toToken: 'XLM',
          amount: '1000000000000000000',
          userAddress: 'invalid_address',
          destinationAddress: testHelper.getTestStellarAddress(),
          timelock: 3600,
          partialFillsEnabled: false,
          slippage: 0.5,
        },
        {
          fromChain: 'ethereum' as const,
          toChain: 'stellar' as const,
          fromToken: 'ETH',
          toToken: 'XLM',
          amount: '1000000000000000000',
          userAddress: testHelper.getTestEthereumAddress(),
          destinationAddress: testHelper.getTestStellarAddress(),
          timelock: -1, // Invalid timelock
          partialFillsEnabled: false,
          slippage: 0.5,
        },
      ];

      for (const invalidRequest of invalidRequests) {
        await expect(coordinator.initiateSwap(invalidRequest))
          .rejects.toThrow();
      }
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle high-frequency swap requests', async () => {
      const concurrentSwaps = 50;
      const swapPromises = [];

      for (let i = 0; i < concurrentSwaps; i++) {
        const swapRequest = {
          fromChain: (i % 2 === 0 ? 'ethereum' : 'stellar') as const,
          toChain: (i % 2 === 0 ? 'stellar' : 'ethereum') as const,
          fromToken: i % 2 === 0 ? 'ETH' : 'XLM',
          toToken: i % 2 === 0 ? 'XLM' : 'ETH',
          amount: i % 2 === 0 ? '1000000000000000000' : '150000000000',
          userAddress: i % 2 === 0 ? 
            testHelper.getTestEthereumAddress() : 
            testHelper.getTestStellarAddress(),
          destinationAddress: i % 2 === 0 ? 
            testHelper.getTestStellarAddress() : 
            testHelper.getTestEthereumAddress(),
          timelock: 3600,
          partialFillsEnabled: Math.random() > 0.5,
          slippage: 0.5,
        };

        swapPromises.push(coordinator.initiateSwap(swapRequest));
      }

      const startTime = Date.now();
      const results = await Promise.all(swapPromises);
      const endTime = Date.now();

      // Verify all swaps created successfully
      expect(results).toHaveLength(concurrentSwaps);
      results.forEach(result => {
        expect(result.swapId).toBeDefined();
        expect(result.secret).toBeDefined();
      });

      // Verify performance (should complete within reasonable time)
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(10000); // Less than 10 seconds

      // Verify database consistency
      const swapCount = await prisma.swap.count();
      expect(swapCount).toBeGreaterThanOrEqual(concurrentSwaps);
    });

    it('should maintain performance under load', async () => {
      const loadTestDuration = 30000; // 30 seconds
      const swapsPerSecond = 5;
      const totalSwaps = (loadTestDuration / 1000) * swapsPerSecond;

      const startTime = Date.now();
      let completedSwaps = 0;

      const loadTestInterval = setInterval(async () => {
        if (Date.now() - startTime > loadTestDuration) {
          clearInterval(loadTestInterval);
          return;
        }

        const swapPromises = [];
        for (let i = 0; i < swapsPerSecond; i++) {
          const swapRequest = {
            fromChain: 'ethereum' as const,
            toChain: 'stellar' as const,
            fromToken: 'ETH',
            toToken: 'XLM',
            amount: '500000000000000000', // 0.5 ETH
            userAddress: testHelper.getTestEthereumAddress(),
            destinationAddress: testHelper.getTestStellarAddress(),
            timelock: 3600,
            partialFillsEnabled: true,
            slippage: 1.0,
          };

          swapPromises.push(
            coordinator.initiateSwap(swapRequest)
              .then(() => completedSwaps++)
              .catch(err => console.error('Swap failed:', err))
          );
        }

        await Promise.all(swapPromises);
      }, 1000);

      // Wait for load test completion
      await new Promise(resolve => {
        setTimeout(resolve, loadTestDuration + 2000);
      });

      // Verify performance metrics
      expect(completedSwaps).toBeGreaterThan(totalSwaps * 0.95); // 95% success rate
      
      // Verify system stability
      const finalSwapCount = await prisma.swap.count();
      expect(finalSwapCount).toBeGreaterThanOrEqual(completedSwaps);

      // Verify no memory leaks or resource exhaustion
      const activeConnections = await redis.info('clients');
      expect(activeConnections).toContain('connected_clients');
    });
  });
});
