import { Server } from 'stellar-sdk';
import EventEmitter from 'events';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { logger } from '../utils/logger';

interface StellarMonitorParams {
  horizonUrl: string;
  contractId: string;
  networkPassphrase: string;
  prisma: PrismaClient;
  redis: Redis;
}

export class StellarMonitor extends EventEmitter {
  private server: Server;
  private contractId: string;
  private networkPassphrase: string;
  private isRunning: boolean = false;
  private prisma: PrismaClient;
  private redis: Redis;

  constructor(params: StellarMonitorParams) {
    super();
    this.server = new Server(params.horizonUrl);
    this.contractId = params.contractId;
    this.networkPassphrase = params.networkPassphrase;
    this.prisma = params.prisma;
    this.redis = params.redis;
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    logger.info('StellarMonitor started');

    // Listen for transactions calling the Soroban contract
    this.server.transactions()
      .forAccount(this.contractId)
      .cursor('now')
      .stream({
        onmessage: (tx) => {
          // TODO: parse operation details for swaps
          logger.info(`New Stellar transaction: ${tx.hash}`);
          this.emit('StellarTransaction', { hash: tx.hash, timestamp: new Date() });
          // Implement detailed event parsing to detect swaps
        },
        onerror: (error) => {
          logger.error('Stellar stream error:', error);
          // Optionally reconnect or cleanup
        }
      });
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    // Stellar SDK does not expose stream stop, so may require external handling
    logger.info('StellarMonitor stopped');
  }
}
