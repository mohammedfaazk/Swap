import { describe, it, expect } from '@jest/globals';
import { CrossChainCoordinator } from '../../relayer/src/coordination/CrossChainCoordinator';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

describe('⚡ Load Testing', () => {
  // Adjust as per your infrastructure
  const nSwaps = 200;
  const concurrent = 20;
  const testDuration = 15_000;

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

  it('should process concurrent swaps efficiently', async () => {
    const swapPromises: Promise<any>[] = [];
    let success = 0, failures = 0;

    for (let i = 0; i < nSwaps; i++) {
      swapPromises.push(
        coordinator
          .initiateSwap({
            fromChain: 'ethereum',
            toChain: 'stellar',
            fromToken: 'ETH',
            toToken: 'XLM',
            amount: '1000000000000000000',
            userAddress: `0xUser${i}`,
            destinationAddress: `GDSTEST${i}`,
            timelock: 3600,
            partialFillsEnabled: Boolean(i % 2),
            slippage: 0.5 + (i % 5) * 0.1,
          })
          .then(() => success++)
          .catch(() => failures++)
      );
      if (i % concurrent === 0) await Promise.all(swapPromises.splice(0, concurrent));
    }
    await Promise.all(swapPromises);

    expect(success + failures).toBe(nSwaps);
    expect(failures).toBeLessThan(nSwaps * 0.1);
    console.log(`Load test results: ${success} successful, ${failures} failed swaps`);
  }, testDuration);
});
