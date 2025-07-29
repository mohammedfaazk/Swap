import { FastifyInstance } from 'fastify';
import swapsRoutes from './swaps';
import resolversRoutes from './resolvers';
import statusRoutes from './status';

interface RoutesOptions {
  coordinator: any;
  resolverManager: any;
  ethereumMonitor: any;
  stellarMonitor: any;
  prisma: any;
  redis: any;
}

export function setupApiRoutes(app: FastifyInstance, options: RoutesOptions) {
  app.register(swapsRoutes, { prefix: '/api/swaps', ...options });
  app.register(resolversRoutes, { prefix: '/api/resolvers', ...options });
  app.register(statusRoutes, { prefix: '/api/status', ...options });
}
