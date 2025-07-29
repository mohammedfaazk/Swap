import { FastifyInstance, FastifyPluginOptions, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

const swapInitiateSchema = z.object({
  initiator: z.string(),
  amount: z.string(),
  hashlock: z.string(),
  timelock: z.number(),
  stellarAccount: z.string(),
  resolver: z.string(),
  enablePartialFill: z.boolean().optional(),
  minimumFill: z.string().optional()
});

export default async function swapRoutes(fastify: FastifyInstance, opts: FastifyPluginOptions) {
  const { deps } = opts as any;

  fastify.post('/initiate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = swapInitiateSchema.parse(request.body);

      const swapId = await deps.coordinator.initiateSwap(body);

      return reply.send({
        success: true,
        swapId,
        message: 'Swap initiated successfully.',
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(400).send({ error: 'Invalid swap initiation request' });
    }
  });

  fastify.get('/:swapId/status', async (request: FastifyRequest, reply: FastifyReply) => {
    const { swapId } = request.params as { swapId: string };
    try {
      const status = await deps.coordinator.getSwapStatus(swapId);
      return reply.send(status);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(404).send({ error: 'Swap not found' });
    }
  });
}
