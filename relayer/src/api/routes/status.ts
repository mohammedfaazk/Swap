
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { rateLimitConfig } from '../middleware/rateLimit';
import '../../types';

interface StatusResponse {
  service: string;
  version: string;
  uptime: number;
  ethereum: {
    blockNumber: number;
    isConnected: boolean;
    networkId: number;
  };
  stellar: {
    isConnected: boolean;
    networkPassphrase: string;
    lastLedger: number;
  };
  resolvers: {
    totalResolvers: number;
    activeResolvers: number;
    totalStaked: string;
  };
  activeOrders: number;
  totalVolume24h: string;
  successRate: number;
}

interface HealthResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  version: string;
}

const statusRoutes: FastifyPluginAsync = async (app) => {
  // Apply rate limiting
  await app.register(import('@fastify/rate-limit'), {
    ...rateLimitConfig,
    max: 300, // Higher limit for status endpoints
    timeWindow: '1 minute'
  });

  app.get<{
    Reply: StatusResponse
  }>('/', {
    schema: {
      response: {
        200: {
          type: 'object',
          required: [
            'service',
            'version',
            'uptime',
            'ethereum',
            'stellar',
            'resolvers',
            'activeOrders',
            'totalVolume24h',
            'successRate'
          ],
          properties: {
            service: { type: 'string' },
            version: { type: 'string' },
            uptime: { type: 'number' },
            ethereum: {
              type: 'object',
              required: ['blockNumber', 'isConnected', 'networkId'],
              properties: {
                blockNumber: { type: 'number' },
                isConnected: { type: 'boolean' },
                networkId: { type: 'number' }
              }
            },
            stellar: {
              type: 'object',
              required: ['isConnected', 'networkPassphrase', 'lastLedger'],
              properties: {
                isConnected: { type: 'boolean' },
                networkPassphrase: { type: 'string' },
                lastLedger: { type: 'number' }
              }
            },
            resolvers: {
              type: 'object',
              required: ['totalResolvers', 'activeResolvers', 'totalStaked'],
              properties: {
                totalResolvers: { type: 'number' },
                activeResolvers: { type: 'number' },
                totalStaked: { type: 'string' }
              }
            },
            activeOrders: { type: 'number' },
            totalVolume24h: { type: 'string' },
            successRate: { type: 'number' }
          }
        },
        500: {
          type: 'object',
          required: ['error', 'message'],
          properties: {
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const resolvers = await app.resolverManager.getAuthorizedResolvers();
      const [ethereum, stellar, activeOrders, totalVolume24h, successRate] = await Promise.all([
        app.ethereumMonitor.getStatus(),
        app.stellarMonitor.getStatus(),
        app.coordinator.getActiveOrderCount(),
        app.coordinator.getVolume24h(),
        app.coordinator.getSuccessRate()
      ]);

      const resolversStatus = {
        totalResolvers: resolvers.length,
        activeResolvers: resolvers.filter(r => r.stake > 0n).length,
        totalStaked: resolvers.reduce((acc, r) => acc + r.stake, 0n).toString()
      };

      const status: StatusResponse = {
        service: 'StellarBridge Fusion+ Relayer',
        version: process.env.npm_package_version || '1.0.0',
        uptime: process.uptime(),
        ethereum,
        stellar,
        resolvers: resolversStatus,
        activeOrders,
        totalVolume24h,
        successRate
      };

      return reply.send(status);
    } catch (error) {
      request.log.error('Error fetching status:', error);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch system status'
      });
    }
  });

  app.get<{
    Reply: HealthResponse
  }>('/health', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['healthy', 'unhealthy'] },
            timestamp: { type: 'string', format: 'date-time' },
            version: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Basic health check of our monitoring services
      const [ethereumHealth, stellarHealth] = await Promise.all([
        app.ethereumMonitor.getStatus(),
        app.stellarMonitor.getStatus()
      ]);

      const isHealthy = ethereumHealth.isConnected && stellarHealth.isConnected;

      const response: HealthResponse = {
        status: isHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0'
      };

      reply.status(isHealthy ? 200 : 503).send(response);
    } catch (error) {
      request.log.error('Health check failed:', error);
      reply.status(503).send({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0'
      });
    }
  });
};

export default statusRoutes;