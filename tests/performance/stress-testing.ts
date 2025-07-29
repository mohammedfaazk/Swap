import { describe, it, expect } from '@jest/globals';
import { CrossChainCoordinator } from '../../relayer/src/coordination/CrossChainCoordinator';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

describe('🔥 Stress Testing', () => {
  let prisma: PrismaClient;
  let redis: Redis;
  let coordinator: CrossChainCoordinator;

  beforeAll(() => {
    prisma = new PrismaClient();
    redis = new Redis();
    coordinator = new CrossChainCoordinator(null, null, prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await redis.quit();
  });

  it('should remain stable at max system load', async () => {
    const swapsPerSecond = 50;
    const durationSec = 10;
    let totalCreated = 0;

    const getSwapReq = (i: number) => ({
      fromChain: i % 2 ? 'ethereum' : 'stellar',
      toChain: i % 2 ? 'stellar' : 'ethereum',
      fromToken: i % 2 ? 'ETH' : 'XLM',
      toToken: i % 2 ? 'XLM' : 'ETH',
      amount: '1000000000000000000',
      userAddress: `0xStress${i}`,
      destinationAddress: `GStress${i}`,
      timelock: 3600,
      partialFillsEnabled: true,
      slippage: 1.0,
    });

    const stressTest = [];
    for (let sec = 0; sec < durationSec; sec++) {
      let batch = [];
      for (let j = 0; j < swapsPerSecond; j++) {
        batch.push(coordinator.initiateSwap(getSwapReq(totalCreated++)));
      }
      stressTest.push(Promise.all(batch));
    }
    await Promise.all(stressTest);

    // Confirm database integrity and absence of resource errors
    const count = await prisma.swap.count();
    expect(count).toBeGreaterThanOrEqual(swapsPerSecond * durationSec);
  }, 15000);
});
