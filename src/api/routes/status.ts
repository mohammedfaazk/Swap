import { FastifyInstance } from 'fastify';

export default async function statusRoutes(fastify: FastifyInstance) {
  fastify.get('/', async () => {
    return {
      service: 'stellarbridge-fusionplus-relayer',
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    };
  });

  fastify.get('/health', async () => {
    // Perform health checks of connected services if needed
    return { healthy: true, timestamp: new Date().toISOString() };
  });
}
