import { describe, beforeAll, afterAll, beforeEach, it, expect } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import express, { Express } from 'express';
import { createServer, Server as HTTPServer } from 'http';
import supertest from 'supertest';
import { CrossChainCoordinator } from '../../relayer/src/coordination/CrossChainCoordinator';
import { WebSocketServer } from '../../relayer/src/websocket/WebSocketServer';
import { TestHelper } from '../utils/TestHelper';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';

describe('🪐 Relayer Integration Tests', () => {
  let app: Express;
  let server: HTTPServer;
  let request: supertest.SuperTest<supertest.Test>;
  let wsServer: WebSocketServer;
  let coordinator: CrossChainCoordinator;
  let prisma: PrismaClient;
  let redis: Redis;
  let testHelper: TestHelper;
  let clientSocket: ClientSocketType;

  beforeAll(async () => {
    // Setup test environment
    prisma = new PrismaClient();
    redis = new Redis();
    coordinator = new CrossChainCoordinator(null, null, prisma);
    testHelper = new TestHelper(prisma, redis);

    app = express();
    app.use(express.json());
    app.set('coordinator', coordinator); // Expose coordinator for routes

    // Integrate API routes (as in app.ts/main.ts)
    const swaps = require('../../relayer/src/api/routes/swaps').default;
    app.use('/api/v1/swaps', swaps);

    const resolvers = require('../../relayer/src/api/routes/resolvers').default;
    app.use('/api/v1/resolvers', resolvers);

    // HTTP server and WebSocket
    server = createServer(app);
    wsServer = new WebSocketServer(server, redis, coordinator);

    await new Promise((resolve) => server.listen(0, resolve)); // random port
    const port = (server.address() as any).port;
    request = supertest(`http://localhost:${port}`);

    // Setup WebSocket client for tests
    clientSocket = ClientSocket(`http://localhost:${port}`, {
      transports: ['websocket'],
      forceNew: true,
    });

    await new Promise((resolve) => clientSocket.on('connect', resolve));
    await testHelper.setupTestEnvironment();
  });

  afterAll(async () => {
    if (clientSocket.connected) clientSocket.close();
    server.close();
    await testHelper.cleanup();
    await prisma.$disconnect();
    await redis.quit();
  });

  beforeEach(async () => {
    await testHelper.resetTestData();
  });

  it('should create and return swap status via REST API', async () => {
    const body = {
      fromChain: 'ethereum',
      toChain: 'stellar',
      fromToken: 'ETH',
      toToken: 'XLM',
      amount: '1500000000000000000',
      userAddress: '0xTestUser1',
      destinationAddress: 'GDSTEST1234567',
      timelock: 3600,
      partialFillsEnabled: false,
      slippage: 0.5,
    };
    // Initiate swap
    const res = await request.post('/api/v1/swaps/initiate').send(body);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('swapId');
    const swapId = res.body.data.swapId;

    // Get status
    const statusRes = await request.get(`/api/v1/swaps/${swapId}`).send();
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.data).toHaveProperty('swapId', swapId);
  });

  it('should broadcast swap status over WebSocket', async () => {
    const statusUpdates: any[] = [];

    clientSocket.emit('subscribe_swap', { swapId: 'E2ETESTSWAP' });
    clientSocket.on('swap_update', (data) => statusUpdates.push(data));

    // Simulate a swap status being published via Redis
    await redis.publish('swap_updates', JSON.stringify({
      swapId: 'E2ETESTSWAP',
      status: 'PARTIAL_FILLED',
      progress: 64,
    }));

    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(statusUpdates.length).toBeGreaterThanOrEqual(1);
    expect(statusUpdates[0].status).toBe('PARTIAL_FILLED');
    expect(statusUpdates[0].swapId).toBe('E2ETESTSWAP');
  });

  it('should submit resolver bid and receive confirmation via WebSocket', async () => {
    let bidConfirmed: any = null;
    clientSocket.on('bid_confirmed', (data) => (bidConfirmed = data));

    // Submit bid
    clientSocket.emit('submit_bid', {
      swapId: 'SwapBid1',
      resolverAddress: '0xRESOLVER',
      bidPrice: 99400,
      fillAmount: '1000000000000000000',
    });

    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(bidConfirmed).toBeTruthy();
    expect(bidConfirmed.swapId).toBe('SwapBid1');
    expect(typeof bidConfirmed.bidId).toBe('string');
  });

  it('should allow resolver registration/query via REST', async () => {
    const registerPayload = {
      address: '0xRESOLVER2',
      stake: '4000000000000000000',
    };
    // Register
    const regRes = await request.post('/api/v1/resolvers/register').send(registerPayload);
    expect(regRes.body.success).toBe(true);
    expect(regRes.body.data.address).toBe('0xRESOLVER2');
    // Query
    const listRes = await request.get('/api/v1/resolvers').send();
    expect(listRes.body.data.resolvers.length).toBeGreaterThan(0);
    expect(listRes.body.data.resolvers.some((r: any) => r.address === '0xRESOLVER2')).toBe(true);
  });

  it('should deliver analytics updates over WebSocket', async () => {
    let analyticsUpdated: any = null;
    clientSocket.on('analytics_update', (data) => (analyticsUpdated = data));
    clientSocket.emit('subscribe_analytics');

    await redis.publish('analytics_updates', JSON.stringify({
      totalSwaps: 1286,
      totalVolume: '17600000000000000000000',
      activeSwaps: 21,
      pendingVolume: '80000000000000000000',
    }));

    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(analyticsUpdated).toBeTruthy();
    expect(analyticsUpdated.totalSwaps).toBe(1286);
    expect(analyticsUpdated.activeSwaps).toBe(21);
  });

  it('should cleanup WebSocket clients on disconnect', async () => {
    const statsBefore = wsServer.getStats();
    expect(statsBefore.connectedClients).toBeGreaterThan(0);

    clientSocket.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 300));

    const statsAfter = wsServer.getStats();
    expect(statsAfter.connectedClients).toBe(0);

    // Reconnect for remaining tests
    clientSocket.connect();
    await new Promise((resolve) => clientSocket.on('connect', resolve));
  });
});
