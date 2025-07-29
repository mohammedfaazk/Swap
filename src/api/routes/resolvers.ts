import { FastifyInstance, FastifyPluginOptions, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

const resolverRegisterSchema = z.object({
  address: z.string(),
  endpoint: z.string(),
  stake: z.string(),
});

export default async function resolverRoutes(fastify: FastifyInstance, opts: FastifyPluginOptions) {
  const { deps } = opts as any;

  fastify.post('/register', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = resolverRegisterSchema.parse(request.body);

      const result = await deps.resolverManager.registerResolver(data);

      return reply.send({
        success: true,
        resolverId: result.id,
        status: 'registered'
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(400).send({ error: 'Invalid resolver registration' });
    }
  });

  fastify.get('/list', async (request: FastifyRequest, reply: FastifyReply) => {
    const list = await deps.resolverManager.listResolvers();
    return reply.send({ resolvers: list });
  });
}
