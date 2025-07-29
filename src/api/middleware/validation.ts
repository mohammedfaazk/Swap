import { FastifyReply, FastifyRequest } from 'fastify';

export function validateBody(schema: any) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await schema.parseAsync(request.body);
    } catch (error: any) {
      return reply.status(400).send({ error: 'Invalid request body', details: error.errors });
    }
  };
}
