// If using Prisma models are defined in schema, but helper class example:

import { PrismaClient } from '@prisma/client';

export class SwapModel {
  constructor(private prisma: PrismaClient) {}

  async create(swapData: any) {
    return this.prisma.swap.create({ data: swapData });
  }

  async update(swapId: string, updates: any) {
    return this.prisma.swap.update({ where: { id: swapId }, data: updates });
  }

  async findById(swapId: string) {
    return this.prisma.swap.findUnique({ where: { id: swapId } });
  }

  async listRecent(limit: number = 10) {
    return this.prisma.swap.findMany({ take: limit, orderBy: { createdAt: 'desc' } });
  }
}
