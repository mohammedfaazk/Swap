import { PrismaClient } from '@prisma/client';

export class PartialFillModel {
  constructor(private prisma: PrismaClient) {}

  async createOrUpdate(data: any) {
    return this.prisma.partialFill.upsert({
      where: {
        swapId_secretIndex: {
          swapId: data.swapId,
          secretIndex: data.secretIndex
        },
      },
      update: {
        secretUsed: data.secretUsed,
      },
      create: data,
    });
  }

  async find(swapId: string, secretIndex: number) {
    return this.prisma.partialFill.findUnique({
      where: {
        swapId_secretIndex: {
          swapId,
          secretIndex
        },
      }
    });
  }
}
