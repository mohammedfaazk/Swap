import { ethers } from 'ethers';
import EventEmitter from 'events';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { logger } from '../utils/logger';

interface EthereumMonitorParams {
  rpcUrl: string;
  contractAddress: string;
  startBlock: number;
  prisma: PrismaClient;
  redis: Redis;
}

export class EthereumMonitor extends EventEmitter {
  private provider: ethers.providers.JsonRpcProvider;
  private contract: ethers.Contract;
  private isRunning = false;
  private lastBlock: number;
  private params: EthereumMonitorParams;

  constructor(params: EthereumMonitorParams) {
    super();
    this.params = params;
    this.provider = new ethers.providers.JsonRpcProvider(params.rpcUrl);
    this.contract = new ethers.Contract(
      params.contractAddress,
      [
        "event SwapInitiated(bytes32 indexed swapId, address indexed initiator, address indexed resolver, uint256 amount, bytes32 hashlock, uint256 timelock, string stellarAccount, bool enablePartialFill)",
        "event SwapCompleted(bytes32 indexed swapId, bytes32 secret, uint256 actualAmount, uint256 executionTime, uint256 gasUsed)",
        "event SwapRefunded(bytes32 indexed swapId, address indexed initiator, uint256 amount, string reason)",
      ],
      this.provider
    );
    this.lastBlock = params.startBlock;
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    logger.info('EthereumMonitor started');

    this.contract.on('SwapInitiated', (swapId, initiator, resolver, amount, hashlock, timelock, stellarAccount, enablePartialFill, event) => {
      logger.info(`Swap initiated: ${swapId}`);
      this.emit('SwapInitiated', {
        swapId,
        initiator,
        resolver,
        amount: amount.toString(),
        hashlock,
        timelock: timelock.toNumber(),
        stellarAccount,
        enablePartialFill,
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash,
        timestamp: new Date()
      });
    });

    this.contract.on('SwapCompleted', (swapId, secret, actualAmount, executionTime, gasUsed, event) => {
      logger.info(`Swap completed: ${swapId}`);
      this.emit('SwapCompleted', {
        swapId,
        secret,
        actualAmount: actualAmount.toString(),
        executionTime: executionTime.toNumber(),
        gasUsed: gasUsed.toNumber(),
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash,
        timestamp: new Date()
      });
    });

    this.contract.on('SwapRefunded', (swapId, initiator, amount, reason, event) => {
      logger.info(`Swap refunded: ${swapId}`);
      this.emit('SwapRefunded', {
        swapId,
        initiator,
        amount: amount.toString(),
        reason,
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash,
        timestamp: new Date()
      });
    });
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;
    this.contract.removeAllListeners();
    this.isRunning = false;
    logger.info('EthereumMonitor stopped');
  }
}
