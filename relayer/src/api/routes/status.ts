import { FastifyPluginAsync } from 'fastify';

const statusRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request, reply) => {
    const status = { 
      service: 'StellarBridge Fusion+ Relayer',
      version: '1.0.0',
      uptime: process.uptime(),
      ethereum: await app.ethereumMonitor.getStatus(),
      stellar: await app.stellarMonitor.getStatus(),
      resolvers: await app.resolverManager.getStatus(),
      activeOrders: await app.coordinator.getActiveOrderCount(),
      totalVolume24h: await app.coordinator.getVolume24h(),
      successRate: await app.coordinator.getSuccessRate(),
    };
    reply.send(status);
  });

  app.get('/health', async (request, reply) => {
    reply.send({
      status: 'healthy',
      timestamp: new Date(),
    });
  });
};

export default statusRoutes;
