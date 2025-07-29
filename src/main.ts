import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { setupApiRoutes } from './api/routes';
import { EthereumMonitor } from './monitors/EthereumMonitor';
import { StellarMonitor } from './monitors/StellarMonitor';
import { ResolverManager } from './resolvers/ResolverManager';
import { CrossChainCoordinator } from './coordination/CrossChainCoordinator';
import { WebSocketManager } from './websocket/WebSocketManager';
import { logger } from './utils/logger';
import { config } from './config';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

async function startRelayer() {
  const app = Fastify({ logger: logger });
  app.register(cors, { origin: true, credentials: true });
  app.register(websocket);

  const prisma = new PrismaClient();
  const redis = new Redis(config.redis.url);

  const ethMonitor = new EthereumMonitor({
    rpcUrl: config.ethereum.rpcUrl,
    contractAddress: config.ethereum.contractAddress,
    startBlock: config.ethereum.startBlock,
    prisma,
    redis,
  });

  const stellarMonitor = new StellarMonitor({
    horizonUrl: config.stellar.horizonUrl,
    contractId: config.stellar.contractId,
    networkPassphrase: config.stellar.networkPassphrase,
    prisma,
    redis,
  });

  const resolverManager = new ResolverManager({
    ethereumRpc: config.ethereum.rpcUrl,
    stellarHorizon: config.stellar.horizonUrl,
    minStake: config.resolvers.minStake,
    maxResolvers: config.resolvers.maxResolvers,
    prisma,
    redis,
  });

  const coordinator = new CrossChainCoordinator({
    ethereumMonitor: ethMonitor,
    stellarMonitor: stellarMonitor,
    resolverManager: resolverManager,
    prisma,
    redis,
  });

  const wsManager = new WebSocketManager(app, {
    coordinator,
    ethereumMonitor: ethMonitor,
    stellarMonitor: stellarMonitor,
  });

  setupApiRoutes(app, {
    coordinator,
    resolverManager,
    ethereumMonitor: ethMonitor,
    stellarMonitor: stellarMonitor,
    prisma,
    redis,
  });

  // Start services
  await prisma.$connect();
  await redis.ping();
  await ethMonitor.start();
  await stellarMonitor.start();
  await resolverManager.start();
  await coordinator.start();

  // Start server
  const port = config.server.port;
  const host = config.server.host;

  app.listen({ port, host });
  logger.info(`Relayer started on http://${host}:${port}`);

  // Graceful shutdown
  process.on('SIGINT', async () => {
    logger.info('Shutting down relayer...');
    await coordinator.stop();
    await resolverManager.stop();
    await stellarMonitor.stop();
    await ethMonitor.stop();
    await redis.quit();
    await prisma.$disconnect();
    await app.close();
    process.exit(0);
  });
}

startRelayer().catch((e) => {
  logger.error('Error starting relayer', e);
  process.exit(1);
});
