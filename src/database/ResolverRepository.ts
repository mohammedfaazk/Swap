import { PrismaClient, Resolver } from '@prisma/client';

export class ResolverRepository {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async getActiveResolvers(): Promise<Resolver[]> {
    return this.prisma.resolver.findMany({ where: { active: true } });
  }

  async updateReputation(address: string, delta: number) {
    // Adjust resolver reputation
  }
}
