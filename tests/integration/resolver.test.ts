import { describe, beforeAll, afterAll, beforeEach, it, expect } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { ResolverService } from '../../relayer/src/services/ResolverService';
import { TestHelper } from '../utils/TestHelper';

describe('🧠 Resolver Integration Tests', () => {
  let prisma: PrismaClient;
  let redis: Redis;
  let resolverService: ResolverService;
  let testHelper: TestHelper;

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/stellarbridge_test'
        }
      }
    });
    redis = new Redis(process.env.TEST_REDIS_URL || 'redis://localhost:6379/1');
    resolverService = new ResolverService(prisma, redis);
    testHelper = new TestHelper(prisma, redis);
    await testHelper.setupTestEnvironment();
  });

  afterAll(async () => {
    await testHelper.cleanup();
    await prisma.$disconnect();
    await redis.quit();
  });

  beforeEach(async () => {
    await testHelper.resetTestData();
  });

  it('should register and fetch resolver', async () => {
    const resolverData = {
      address: '0xABCDEF1111222233334444555566667777888899',
      stake: '4000000000000000000', // 4 ETH
      reputation: 1200,
      totalVolume: '80000000000000000000',
      successRate: 9940,
      avgResponseTime: 2200,
      active: true,
    };
    await resolverService.registerResolver(resolverData);

    const resolver = await resolverService.getResolver(resolverData.address);
    expect(resolver).toBeDefined();
    expect(resolver?.stake).toEqual('4000000000000000000');
    expect(resolver?.reputation).toEqual(1200);
  });

  it('should update resolver performance', async () => {
    const address = await testHelper.createTestResolver();
    await resolverService.updatePerformance(address, {
      fillAmount: '3000000000000000000',
      success: true,
      responseTime: 3000,
    });

    const resolver = await resolverService.getResolver(address);
    expect(resolver?.totalVolume).not.toBe('0');
    expect(resolver?.avgResponseTime).toBeGreaterThan(0);
    expect(resolver?.successRate).toBeLessThanOrEqual(10000);
  });

  it('should slash and deactivate failed resolver', async () => {
    const address = await testHelper.createTestResolver();
    await resolverService.recordFailure(address);

    const resolver = await resolverService.getResolver(address);
    expect(resolver?.active).toBe(true);
    expect(resolver?.reputation).toBeLessThan(1000);

    // Multiple failures deactivate
    await resolverService.recordFailure(address);
    await resolverService.recordFailure(address);
    const r2 = await resolverService.getResolver(address);
    expect(r2?.active).toBe(false);
  });

  it('should rank resolvers by reputation and stake', async () => {
    await Promise.all(Array(5).fill(0).map(() => testHelper.createTestResolver()));
    const topResolvers = await resolverService.listResolvers({ sortBy: 'reputation', limit: 3 });
    expect(topResolvers.length).toBe(3);
    expect(topResolvers[0].reputation).toBeGreaterThanOrEqual(topResolvers[1].reputation);
  });

  it('should find available resolvers for a swap', async () => {
    const activeResolvers = await resolverService.listResolvers({ active: true });
    expect(activeResolvers.length).toBeGreaterThan(0);

    const selection = await resolverService.pickResolvers('ETH', 'XLM', 3);
    expect(selection.length).toBeGreaterThan(0);
    for (const resolver of selection) {
      expect(resolver.active).toBe(true);
      expect(typeof resolver.stake).toBe('string');
    }
  });
});
