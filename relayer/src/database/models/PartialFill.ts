import { PrismaClient } from '@prisma/client';
import type { PartialFill as PartialFillModel } from '@prisma/client';

export interface IPartialFill {
  id?: number;
  swapId: string;
  resolver: string;
  fillAmount: string;
  secretIndex: number;
  secret: string;
  createdAt?: Date;
}

export class PartialFillRepository {
  constructor(private prisma: PrismaClient) {}

  async create(partialFill: IPartialFill): Promise<PartialFillModel> {
    return this.prisma.partialFill.create({ data: partialFill });
  }

  async findBySwapId(swapId: string): Promise<PartialFillModel[]> {
    return this.prisma.partialFill.findMany({ where: { swapId } });
  }
}
