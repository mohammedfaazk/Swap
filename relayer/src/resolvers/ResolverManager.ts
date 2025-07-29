import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { logger } from '../utils/logger';

interface ResolverManagerConfig {
  ethereumRpc: string;
  stellarHorizon: string;
  minStake: bigint;
  maxResolvers: number;
  prisma: PrismaClient;
  redis: Redis;
}

export class ResolverManager {
  private resolversSet = new Set<string>();
  private config: ResolverManagerConfig;
  private prisma: PrismaClient;
  private redis: Redis;

  constructor(config: ResolverManagerConfig) {
    this.config = config;
    this.prisma = config.prisma;
    this.redis = config.redis;
  }

  async start(): Promise<void> {
    await this.loadResolvers();
    logger.info('ResolverManager started');
  }

  async stop(): Promise<void> {
    logger.info('ResolverManager stopped');
  }

  private async loadResolvers() {
    const resolvers = await this.prisma.resolver.findMany({
      where: { isAuthorized: true, stake: { gte: this.config.minStake.toString() } }
    });
    this.resolversSet = new Set(resolvers.map(r => r.address));
  }

  async registerResolver(address: string, stake: bigint, endpoint: string): Promise<void> {
    // Validate stake
    if (stake < this.config.minStake) {
      throw new Error('Insufficient stake to register as resolver');
    }
    // Check if already registered
    if (this.resolversSet.has(address)) {
      throw new Error('Resolver already registered');
    }
    await this.prisma.resolver.create({
      data: {
        address,
        stake: stake.toString(),
        endpoint,
        reputation: 100,
        successfulSwaps: 0,
        totalSwaps: 0,
        isAuthorized: true
      }
    });
    this.resolversSet.add(address);
    logger.info(`Resolver registered: ${address}`);
  }

  async deregisterResolver(address: string): Promise<void> {
    await this.prisma.resolver.updateMany({
      where: { address },
      data: { isAuthorized: false }
    });
    this.resolversSet.delete(address);
    logger.info(`Resolver deregistered: ${address}`);
  }

  async getAuthorizedResolvers(): Promise<string[]> {
    return Array.from(this.resolversSet);
  }

  async getStatus() {
    const count = this.resolversSet.size;
    const resolverDetails = await this.prisma.resolver.findMany({
      where: { address: { in: Array.from(this.resolversSet) } }
    });
    return {
      total: count,
      resolvers: resolverDetails
    };
  }
}
