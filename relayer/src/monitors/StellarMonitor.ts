import { Server, AccountResponse } from '@stellar/stellar-sdk';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { BaseMonitor } from './BaseMonitor';
import { logger } from '../utils/logger';

interface StellarMonitorConfig {
  horizonUrl: string;
  contractId: string;
  networkPassphrase: string;
  prisma: PrismaClient;
  redis: Redis;
}

export class StellarMonitor extends BaseMonitor {
  private server: Server;
  private subscription: any;

  constructor(private config: StellarMonitorConfig) {
    super();
    this.server = new Server(config.horizonUrl);
  }

  async start() {
    if (this.running) return;
    this.running = true;

    logger.info('Starting Stellar Monitor...');

    this.subscription = this.server
      .payments()
      .forContract(this.config.contractId)
      .cursor('now')
      .stream({
        onmessage: (payment) => this.handlePayment(payment),
        onerror: (error) => logger.error('Stellar stream error:', error),
      });
  }

  async stop() {
    if (!this.running) return;
    this.running = false;
    if (this.subscription) this.subscription(); // Close subscription
  }

  private async handlePayment(payment: any) {
    try {
      // Extract and parse payment details (mock example)
      const swapId = payment.transaction_hash; // or parse from memo or metadata
      const amount = payment.amount;
      const from = payment.from;
      const to = payment.to;

      logger.info(`Stellar payment received: swapId=${swapId}, amount=${amount}`);

      // Database update example
      await this.config.prisma.swap.updateMany({
        where: { id: swapId, state: 'INITIATED' },
        data: { state: 'LOCKED', updatedAt: new Date() }
      });

      // Emit event for relayer coordination
      this.emitEvent('StellarPayment', {
        swapId,
        amount,
        from,
        to,
        payment,
      });
    } catch (error) {
      logger.error('Error handling Stellar payment:', error);
    }
  }
}
