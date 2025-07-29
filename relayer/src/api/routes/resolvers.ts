import { FastifyPluginAsync } from 'fastify';

const resolversRoutes: FastifyPluginAsync = async (app) => {
  app.post('/register', async (request, reply) => {
    const { resolverManager } = app;
    const { address, stake, endpoint } = request.body;
    // Validate and register
    try {
      await resolverManager.registerResolver(address, BigInt(stake), endpoint);
      return reply.send({ success: true });
    } catch (error) {
      request.log.error('Resolver registration error:', error);
      return reply.code(400).send({ error: error.message });
    }
  });

  app.get('/list', async (request, reply) => {
    const resolvers = await app.resolverManager.getAuthorizedResolvers();
    return { resolvers };
  });
};

export default resolversRoutes;
