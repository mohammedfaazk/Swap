import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { logger } from '../utils/logger';

interface ResolverData {
  address: string;
  endpoint: string;
  stake: string;
}

export class ResolverManager {
  private prisma: PrismaClient;
  private redis: Redis;
  private minStake: string;
  private maxResolvers: number;

  constructor(params: { prisma: PrismaClient; redis: Redis; minStake: string; maxResolvers: number }) {
    this.prisma = params.prisma;
    this.redis = params.redis;
    this.minStake = params.minStake;
    this.maxResolvers = params.maxResolvers;
  }

  async registerResolver(data: ResolverData) {
    // Validate stake value
    if (BigInt(data.stake) < BigInt(this.minStake)) {
      throw new Error('Stake below minimum');
    }

    // Check limit on total resolvers
    const count = await this.prisma.resolver.count();
    if (count >= this.maxResolvers) {
      throw new Error('Max resolver count reached');
    }

    const resolver = await this.prisma.resolver.upsert({
      where: { address: data.address },
      update: { endpoint: data.endpoint, stake: data.stake },
      create: {
        address: data.address,
        endpoint: data.endpoint,
        stake: data.stake,
        successfulSwaps: 0,
        totalSwaps: 0,
        reputation: 100,
      },
    });

    logger.info(`Resolver registered: ${data.address}`);
    return resolver;
  }

  async listResolvers() {
    return await this.prisma.resolver.findMany({
      orderBy: [{ reputation: 'desc' }, { stake: 'desc' }],
      take: this.maxResolvers,
    });
  }

  async getActiveResolverCount() {
    return await this.prisma.resolver.count({
      where: { stake: { gte: this.minStake } },
    });
  }

  async start() {
    logger.info('ResolverManager started');
  }

  async stop() {
    logger.info('ResolverManager stopped');
  }
} // <--- No trailing commas here
