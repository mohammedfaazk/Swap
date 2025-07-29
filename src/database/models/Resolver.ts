import { PrismaClient } from '@prisma/client';

export class ResolverModel {
  constructor(private prisma: PrismaClient) {}

  async register(resolverData: any) {
    return this.prisma.resolver.upsert({
      where: { address: resolverData.address },
      update: resolverData,
      create: resolverData,
    });
  }

  async get(address: string) {
    return this.prisma.resolver.findUnique({ where: { address } });
  }

  async listAll() {
    return this.prisma.resolver.findMany();
  }
}
