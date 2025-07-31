import { PrismaClient } from '@prisma/client';
import type { Resolver as ResolverModel } from '@prisma/client';

export interface IResolver {
  id?: number;
  address: string;
  endpoint: string;
  stake: string; // stored as string for BigInt in DB
  reputation: number;
  successfulSwaps: number;
  totalSwaps: number;
  isAuthorized: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export class ResolverRepository {
  constructor(private prisma: PrismaClient) {}

  async create(resolver: IResolver): Promise<ResolverModel> {
    return this.prisma.resolver.create({ data: resolver });
  }

  async update(resolver: ResolverModel): Promise<ResolverModel> {
    return this.prisma.resolver.update({ where: { id: resolver.id! }, data: resolver });
  }

  async findByAddress(address: string): Promise<ResolverModel | null> {
    return this.prisma.resolver.findUnique({ where: { address } });
  }

  async findAuthorized(): Promise<ResolverModel[]> {
    return this.prisma.resolver.findMany({ where: { isAuthorized: true } });
  }

  async deregister(address: string): Promise<void> {
    await this.prisma.resolver.updateMany({
      where: { address },
      data: { isAuthorized: false },
    });
  }
}
