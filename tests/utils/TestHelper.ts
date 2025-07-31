import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { ethers } from 'ethers';
import * as crypto from 'crypto';

export class TestHelper {
  constructor(
    private prisma: PrismaClient,
    private redis: Redis
  ) {}

  async setupTestEnvironment() {
    // Initialize test database
    await this.prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;
    
    // Clear any existing test data
    await this.resetTestData();
    
    console.log('Test environment setup complete');
  }

  async resetTestData() {
    // Clear database tables in correct order
    await this.prisma.partialFill.deleteMany();
    await this.prisma.swap.deleteMany(); 
    await this.prisma.resolver.deleteMany();
    
    // Clear Redis cache
    await this.redis.flushdb();
  }

  async cleanup() {
    await this.resetTestData();
  }

  getTestEthereumAddress(): string {
    return '0x742d35Cc6639C0532fE87b5A99B8D1A9FFE64C4F';
  }

  getTestStellarAddress(): string {
    return 'GDQNY3PBOJOKYZSRMK2S7LHHGWZIUISD4QORETLMXEWXBI7KFZZMKTL3';
  }

  async simulateEthereumSwapInitiation(params: {
    swapId: string;
    secretHash: string;
    amount: string;
    timelock: number;
  }): Promise<string> {
    // Simulate transaction hash
    const txHash = `0x${crypto.randomBytes(32).toString('hex')}`;
    
    // Update swap state
    await this.prisma.swap.update({
      where: { id: params.swapId },
      data: {
        state: 'LOCKED_SOURCE',
        sourceChainTxHash: txHash,
        updatedAt: new Date()
      }
    });

    return txHash;
  }

  async simulateStellarSwapInitiation(params: {
    swapId: string;
    secretHash: string;
    amount: string;
    timelock: number;
  }): Promise<string> {
    // Simulate Stellar transaction hash
    const txHash = crypto.randomBytes(32).toString('hex');
    
    // Update swap state
    await this.prisma.swap.update({
      where: { id: params.swapId },
      data: {
        state: 'LOCKED_SOURCE',
        sourceChainTxHash: txHash,
        updatedAt: new Date()
      }
    });

    return txHash;
  }

  async simulateStellarSwapCompletion(params: {
    swapId: string;
    secret: string;
    amount: string;
  }): Promise<string> {
    const txHash = crypto.randomBytes(32).toString('hex');
    
    await this.prisma.swap.update({
      where: { id: params.swapId },
      data: {
        state: 'COMPLETED',
        destChainTxHash: txHash,
        completedAt: new Date(),
        updatedAt: new Date()
      }
    });

    return txHash;
  }

  async simulateEthereumSwapCompletion(params: {
    swapId: string;
    secret: string;
    amount: string;
  }): Promise<string> {
    const txHash = `0x${crypto.randomBytes(32).toString('hex')}`;
    
    await this.prisma.swap.update({
      where: { id: params.swapId },
      data: {
        state: 'COMPLETED',
        destChainTxHash: txHash,
        completedAt: new Date(),
        updatedAt: new Date()
      }
    });

    return txHash;
  }

  async simulatePartialFill(params: {
    swapId: string;
    resolver: string;
    amount: string;
    totalFilled: string;
  }) {
    // Create partial fill record
    await this.prisma.partialFill.create({
      data: {
        swapId: params.swapId,
        resolver: params.resolver,
        fillAmount: params.amount,
        secretIndex: 0,
        secret: crypto.randomBytes(32).toString('hex'),
        createdAt: new Date()
      }
    });

    // Update swap filled amount
    await this.prisma.swap.update({
      where: { id: params.swapId },
      data: {
        filledAmount: params.totalFilled,
        state: params.totalFilled === await this.getSwapAmount(params.swapId) ? 'COMPLETED' : 'PARTIAL_FILLED',
        updatedAt: new Date()
      }
    });
  }

  async registerTestResolvers(count: number) {
    const resolvers = [];
    
    for (let i = 0; i < count; i++) {
      const resolver = await this.prisma.resolver.create({
        data: {
          address: `0x${crypto.randomBytes(20).toString('hex')}`,
          endpoint: `http://resolver-${i}.test.com`,
          stake: '10000000000000000000', // 10 ETH
          reputation: 1000,
          isAuthorized: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
      resolvers.push(resolver);
    }
    
    return resolvers;
  }

  async simulateResolverFailure(params: {
    swapId: string;
    resolver: string;
    amount: string;
    error: string;
  }) {
    // Update resolver reputation
    await this.prisma.resolver.update({
      where: { address: params.resolver },
      data: {
        reputation: { decrement: 100 },
        totalSwaps: { increment: 1 },
        updatedAt: new Date()
      }
    });
  }

  async simulateEthereumRefund(params: {
    swapId: string;
    refundAmount: string;
  }) {
    await this.prisma.swap.update({
      where: { id: params.swapId },
      data: {
        state: 'REFUNDED',
        updatedAt: new Date()
      }
    });
  }

  async simulateNetworkFailure(network: 'ethereum' | 'stellar') {
    // Simulate network issues by setting flags in Redis
    await this.redis.set(`network:${network}:down`, 'true', 'EX', 60);
  }

  async simulateNetworkRecovery(network: 'ethereum' | 'stellar') {
    await this.redis.del(`network:${network}:down`);
  }

  async waitForEventProcessing(timeout: number = 5000) {
    // Simple delay to allow event processing
    await new Promise(resolve => setTimeout(resolve, timeout));
  }

  async waitForTimeout(ms: number) {
    await new Promise(resolve => setTimeout(resolve, ms));
  }

  private async getSwapAmount(swapId: string): Promise<string> {
    const swap = await this.prisma.swap.findUnique({
      where: { id: swapId },
      select: { amount: true }
    });
    return swap?.amount || '0';
  }
}