import { PrismaClient } from '@prisma/client';

export class AnalyticsService {
  constructor(private prisma: PrismaClient) {}

 async getOverview() {
  const swaps = await this.prisma.swap.findMany({ select: { amount: true } });
const totalVolume = swaps.reduce((acc, s) => acc + Number(s.amount), 0);



  return { swaps, totalVolume };
}


  // Other analytics: per resolver, real-time stats, etc...
}
