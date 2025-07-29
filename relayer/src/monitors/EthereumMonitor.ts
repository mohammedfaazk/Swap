import { ethers } from 'ethers';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { BaseMonitor } from './BaseMonitor';
import { logger } from '../utils/logger';

interface EthereumMonitorConfig {
  rpcUrl: string;
  contractAddress: string;
  startBlock: number;
  prisma: PrismaClient;
  redis: Redis;
}

export class EthereumMonitor extends BaseMonitor {
  private provider: ethers.providers.JsonRpcProvider;
  private contract: ethers.Contract;
  private lastProcessedBlock: number;
  private pollingInterval?: NodeJS.Timeout;

  constructor(private config: EthereumMonitorConfig) {
    super();
    this.provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
    this.contract = new ethers.Contract(
      config.contractAddress,
      [
        "event SwapInitiated(bytes32 indexed swapId, address indexed initiator, address indexed resolver, uint256 amount, bytes32 hashlock, uint256 timelock, string stellarAccount, bool enablePartialFill)",
        "event SwapCompleted(bytes32 indexed swapId, bytes32 secret, uint256 actualAmount, uint256 executionTime, uint256 gasUsed)",
        "event SwapRefunded(bytes32 indexed swapId, address indexed initiator, uint256 amount, string reason)",
        "event PartialFillEnabled(bytes32 indexed swapId, bytes32 merkleRoot, uint256 parts)",
      ],
      this.provider
    );
    this.lastProcessedBlock = config.startBlock;
  }

  async start() {
    if (this.running) return;
    logger.info('Starting Ethereum Monitor...');
    this.running = true;

    // Poll blocks every 8s
    this.pollingInterval = setInterval(() => this.pollBlocks(), 8000);
  }

  async stop() {
    if (!this.running) return;
    this.running = false;
    if (this.pollingInterval) clearInterval(this.pollingInterval);
  }

  private async pollBlocks() {
    try {
      const latestBlock = await this.provider.getBlockNumber();
      while (this.lastProcessedBlock < latestBlock) {
        const fromBlock = this.lastProcessedBlock + 1;
        const toBlock = Math.min(latestBlock, fromBlock + 50);

        logger.debug(`Polling Ethereum blocks ${fromBlock} to ${toBlock}`);

        const filterInitiated = this.contract.filters.SwapInitiated();
        const events = await this.contract.queryFilter(filterInitiated, fromBlock, toBlock);

        for (const event of events) {
          this.processSwapInitiated(event);
        }

        this.lastProcessedBlock = toBlock;
        await this.config.redis.set('ethereum:lastProcessedBlock', String(this.lastProcessedBlock));
      }
    } catch (error) {
      logger.error('Error polling Ethereum blocks:', error);
    }
  }

  private async processSwapInitiated(event: ethers.Event) {
    try {
      const {
        swapId,
        initiator,
        resolver,
        amount,
        hashlock,
        timelock,
        stellarAccount,
        enablePartialFill
      } = event.args!;

      logger.info(`Ethereum Swap Initiated: ${swapId}`);

      await this.config.prisma.swap.upsert({
        where: { id: swapId },
        update: {},
        create: {
          id: swapId,
          initiator,
          resolver,
          amount: amount.toString(),
          hashlock,
          timelock: timelock.toNumber(),
          stellarAccount,
          state: 'INITIATED',
          fromChain: 'ethereum',
          toChain: 'stellar',
          enablePartialFill,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      this.emitEvent('SwapInitiated', {
        chain: 'ethereum',
        swapId,
        initiator,
        resolver,
        amount: amount.toString(),
        hashlock,
        timelock: timelock.toNumber(),
        stellarAccount,
        enablePartialFill,
      });
    } catch (err) {
      logger.error('Error processing SwapInitiated event:', err);
    }
  }
}
