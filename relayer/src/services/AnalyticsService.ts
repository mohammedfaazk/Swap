import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

export class AnalyticsService {
  constructor(private prisma: PrismaClient) {}

  async fetchAggregateStats() {
    const totalSwaps = await this.prisma.swap.count();
    const completedSwaps = await this.prisma.swap.count({ where: { state: 'COMPLETED' } });
    const refundedSwaps = await this.prisma.swap.count({ where: { state: 'REFUNDED' } });

    return {
      totalSwaps,
      completedSwaps,
      refundedSwaps,
      successRate: totalSwaps === 0 ? 0 : (completedSwaps / totalSwaps) * 100,
    };
  }
}
