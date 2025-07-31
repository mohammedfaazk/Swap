import { FastifyPluginAsync } from 'fastify';

const swapsRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: any }>('/initiate', async (request, reply) => {
    const { coordinator } = app;
    const order = request.body as any;

    const validation = await coordinator.validateOrder(order);
    if (!validation.isValid) {
      return reply.code(400).send({ error: validation.error });
    }

    try {
      // Start auction and swap coordination
      const auction = await coordinator.auctionEngine.startAuction(order);
      return reply.send({ success: true, orderId: order.id, auction });
    } catch (err) {
      request.log.error('Failed to initiate swap:', err);
      return reply.code(500).send({ error: 'Failed to initiate swap.' });
    }
  });

  // Additional swap routes: status, partial fills, cancel, complete etc. can be added here

  app.get<{ Params: { swapId: string } }>('/:swapId/status', async (request, reply) => {
    const swapId = request.params.swapId;
    const swap = await app.prisma.swap.findUnique({ where: { id: swapId } });
    if (!swap) return reply.code(404).send({ error: 'Swap not found' });
    return swap;
  });
};

export default swapsRoutes;
