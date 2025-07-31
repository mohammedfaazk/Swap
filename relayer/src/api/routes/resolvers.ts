
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { validateSchema, validateRequest } from '../middleware/validation';
import { verifyJwt } from '../middleware/auth';
import { rateLimitConfig } from '../middleware/rateLimit';

// Define validation schemas
const registerSchema = {
  body: z.object({
    address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    stake: z.string().regex(/^\d+$/),
    endpoint: z.string().url()
  })
};

declare module 'fastify' {
  interface FastifyInstance {
    resolverManager: {
      registerResolver(address: string, stake: bigint, endpoint: string): Promise<void>;
      getAuthorizedResolvers(): Promise<Array<{ address: string; stake: bigint; endpoint: string }>>;
    }
  }
}

const resolversRoutes: FastifyPluginAsync = async (app) => {
  // Apply rate limiting
  await app.register(import('@fastify/rate-limit'), rateLimitConfig);

  app.post<{
    Body: z.infer<typeof registerSchema.body>
  }>('/register', {
    schema: validateSchema({body: registerSchema.body}),
    preHandler: [
      verifyJwt,
      async (request, reply) => await validateRequest(request, reply, {body: registerSchema.body})
    ]
  }, async (request, reply) => {
    const { resolverManager } = app;
    const { address, stake, endpoint } = request.body;

    try {
      await resolverManager.registerResolver(address, BigInt(stake), endpoint);
      return reply.status(201).send({ 
        success: true,
        data: { address, stake, endpoint }
      });
    } catch (error) {
      request.log.error('Resolver registration error:', error);
      if (error instanceof Error) {
        return reply.status(400).send({ 
          success: false,
          error: error.message 
        });
      }
      return reply.status(500).send({ 
        success: false,
        error: 'Internal server error' 
      });
    }
  });

  app.get('/list', {
    preHandler: [verifyJwt],
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  address: { type: 'string' },
                  stake: { type: 'string' },
                  endpoint: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const resolvers = await app.resolverManager.getAuthorizedResolvers();
      return reply.send({
        success: true,
        data: resolvers.map(r => ({
          ...r,
          stake: r.stake.toString()
        }))
      });
    } catch (error) {
      request.log.error('Error fetching resolvers:', error);
      if (error instanceof Error) {
        return reply.status(500).send({
          success: false,
          error: error.message || 'Failed to fetch resolvers'
        });
      }
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch resolvers'
      });
    }
  });
};

export default resolversRoutes;