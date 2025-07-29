import { PrismaClient, Swap as SwapModel } from '@prisma/client';

export interface ISwap {
  id: string;
  initiator: string;
  resolver: string;
  amount: string;
  hashlock: string;
  timelock: number;
  stellarAccount: string;
  state: string;
  enablePartialFill: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class SwapRepository {
  constructor(private prisma: PrismaClient) {}

  async create(swap: ISwap): Promise<SwapModel> {
    return this.prisma.swap.create({ data: swap });
  }

  async updateState(swapId: string, newState: string): Promise<SwapModel> {
    return this.prisma.swap.update({ where: { id: swapId }, data: { state: newState, updatedAt: new Date() } });
  }

  async findById(swapId: string): Promise<SwapModel | null> {
    return this.prisma.swap.findUnique({ where: { id: swapId } });
  }

  async countActive(): Promise<number> {
    return this.prisma.swap.count({ where: { state: 'INITIATED' } });
  }
}
