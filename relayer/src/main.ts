import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import fastifyJwt from '@fastify/jwt';
import fastifyRateLimit from '@fastify/rate-limit';
import { EthereumMonitor } from './monitors/EthereumMonitor';
import { StellarMonitor } from './monitors/StellarMonitor';
import { ResolverManager } from './resolvers/ResolverManager';
import { AuctionEngine } from './resolvers/AuctionEngine';
import { PartialFillOptimizer } from './resolvers/PartialFillOptimizer';
import { CrossChainCoordinator } from './coordination/CrossChainCoordinator';
import { SecretManager } from './coordination/SecretManager';
import { MerkleTreeManager } from './coordination/MerkleTreeManager';
import { WebSocketManager } from './websocket/WebSocketManager';
import { setupApiRoutes } from './api/routes';
import { logger } from './utils/logger';
import { config } from './config';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

class StellarBridgeRelayer {
  app = Fastify({ logger });
  prisma = new PrismaClient();
  redis = new Redis(config.redis.url);

  ethereumMonitor!: EthereumMonitor;
  stellarMonitor!: StellarMonitor;
  resolverManager!: ResolverManager;
  auctionEngine!: AuctionEngine;
  partialFillOptimizer!: PartialFillOptimizer;
  coordinator!: CrossChainCoordinator;
  secretManager!: SecretManager;
  merkleTreeManager!: MerkleTreeManager;
  wsManager!: WebSocketManager;

  async initServices() {
    logger.info('Initializing services...');
    await this.app.register(cors, { origin: true, credentials: true });
    await this.app.register(websocket);
    await this.app.register(fastifyJwt, { secret: config.security.jwtSecret });
    await this.app.register(fastifyRateLimit, { max: config.security.apiRateLimit, timeWindow: '1 minute' });

    this.ethereumMonitor = new EthereumMonitor({
      rpcUrl: config.ethereum.rpcUrl,
      contractAddress: config.ethereum.contractAddress,
      startBlock: config.ethereum.startBlock,
      prisma: this.prisma,
      redis: this.redis
    });

    this.stellarMonitor = new StellarMonitor({
      horizonUrl: config.stellar.horizonUrl,
      contractId: config.stellar.contractId,
      networkPassphrase: config.stellar.networkPassphrase,
      prisma: this.prisma,
      redis: this.redis
    });

    this.resolverManager = new ResolverManager({
      ethereumRpc: config.ethereum.rpcUrl,
      stellarHorizon: config.stellar.horizonUrl,
      minStake: BigInt(config.resolvers.minStake),
      maxResolvers: config.resolvers.maxResolvers,
      prisma: this.prisma,
      redis: this.redis,
    });

    this.auctionEngine = new AuctionEngine(this.resolverManager, config.resolvers);
    this.partialFillOptimizer = new PartialFillOptimizer();

    this.secretManager = new SecretManager();
    this.merkleTreeManager = new MerkleTreeManager();

    this.coordinator = new CrossChainCoordinator({
      ethereumMonitor: this.ethereumMonitor,
      stellarMonitor: this.stellarMonitor,
      resolverManager: this.resolverManager,
      auctionEngine: this.auctionEngine,
      partialFillOptimizer: this.partialFillOptimizer,
      secretManager: this.secretManager,
      merkleTreeManager: this.merkleTreeManager,
      prisma: this.prisma,
      redis: this.redis
    });

    this.wsManager = new WebSocketManager(this.app, {
      coordinator: this.coordinator,
      ethereumMonitor: this.ethereumMonitor,
      stellarMonitor: this.stellarMonitor,
    });

    setupApiRoutes(this.app, {
      coordinator: this.coordinator,
      resolverManager: this.resolverManager,
      ethereumMonitor: this.ethereumMonitor,
      stellarMonitor: this.stellarMonitor,
      prisma: this.prisma,
      redis: this.redis,
    });

    logger.info('Services initialized.');
  }

  async start() {
    try {
      await this.prisma.$connect();
      logger.info('Connected to database.');

      await this.redis.ping();
      logger.info('Connected to Redis.');

      await this.ethereumMonitor.start();
      await this.stellarMonitor.start();
      await this.resolverManager.start();
      await this.coordinator.start();

      const PORT = config.server.port;
      const HOST = config.server.host;

      await this.app.listen({ port: PORT, host: HOST });
      logger.info(`Relayer running at http://${HOST}:${PORT}`);
    } catch (err) {
      logger.error('Error during startup:', err);
      process.exit(1);
    }
  }

  async stop() {
    logger.info('Shutting down relayer...');
    await this.coordinator.stop();
    await this.resolverManager.stop();
    await this.stellarMonitor.stop();
    await this.ethereumMonitor.stop();
    await this.redis.quit();
    await this.prisma.$disconnect();
    await this.app.close();
    logger.info('Relayer shutdown complete.');
  }
}

const relayer = new StellarBridgeRelayer();

process.on('SIGINT', async () => {
  logger.info('SIGINT received.');
  await relayer.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received.');
  await relayer.stop();
  process.exit(0);
});

relayer.start();

export { StellarBridgeRelayer };
