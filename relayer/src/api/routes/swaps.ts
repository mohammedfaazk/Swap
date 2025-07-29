import { FastifyPluginAsync } from 'fastify';

const swapsRoutes: FastifyPluginAsync = async (app) => {
  app.post('/initiate', async (request, reply) => {
    const { coordinator } = app;
    // Validate input & create swap
    // Assuming validation is in coordinator.validateOrder()
    const order = request.body;

    const validation = await coordinator.validateOrder(order);
    if (!validation.isValid) {
      return reply.code(400).send({ error: validation.error });
    }

    try {
      // Start auction and swap coordination
      const auction = await coordinator.resolverManager.auctionEngine.startAuction(order);
      return reply.send({ success: true, orderId: order.id, auction });
    } catch (err) {
      request.log.error('Failed to initiate swap:', err);
      return reply.code(500).send({ error: 'Failed to initiate swap.' });
    }
  });

  // Additional swap routes: status, partial fills, cancel, complete etc. can be added here

  app.get('/:swapId/status', async (request, reply) => {
    const swapId = request.params.swapId;
    const swap = await app.prisma.swap.findUnique({ where: { id: swapId } });
    if (!swap) return reply.code(404).send({ error: 'Swap not found' });
    return swap;
  });
};

export default swapsRoutes;
