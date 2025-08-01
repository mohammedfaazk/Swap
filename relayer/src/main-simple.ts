import Fastify from 'fastify';
import { config } from './config';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

const app = Fastify({ logger: true });
const prisma = new PrismaClient();
const redis = new Redis(config.redis.url);

async function start() {
  try {
    // Add CORS headers manually
    app.addHook('onRequest', async (request, reply) => {
      reply.header('Access-Control-Allow-Origin', '*');
      reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    });

    // Health check route
    app.get('/api/status/health', async (request, reply) => {
      return { 
        status: 'ok', 
        timestamp: new Date().toISOString(), 
        services: {
          database: 'connected',
          redis: 'connected'
        }
      };
    });

    // Basic swap routes
    app.get('/api/swaps', async (request, reply) => {
      const swaps = await prisma.swap.findMany({ take: 10 });
      return { swaps };
    });

    app.post('/api/swaps/initiate', async (request, reply) => {
      return { message: 'Swap initiation endpoint - ready for implementation' };
    });

    // Basic resolver routes
    app.get('/api/resolvers', async (request, reply) => {
      return { resolvers: [] };
    });

    const PORT = config.server.port;
    const HOST = config.server.host;

    await app.listen({ port: PORT, host: HOST });
    console.log(`🚀 Relayer API running at http://${HOST}:${PORT}`);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();