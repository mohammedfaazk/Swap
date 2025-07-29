import { PrismaClient, Prisma } from '@prisma/client';

export class SwapRepository {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async create(swapData: Prisma.SwapCreateInput) {
    return this.prisma.swap.create({ data: swapData });
  }

  async findById(swapId: string) {
    return this.prisma.swap.findUnique({ where: { id: swapId } });
  }

  async updateStatus(swapId: string, status: string) {
    return this.prisma.swap.update({
      where: { id: swapId },
      data: { state: status },
    });
  }
}
