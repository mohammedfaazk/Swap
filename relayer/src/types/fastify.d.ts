import 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    ethereumMonitor: any;
    stellarMonitor: any;
    coordinator: any;
    resolverManager: any;
    prisma: any;
    redis: any;
  }
}