import { FastifyReply, FastifyRequest } from 'fastify';
import { JWT } from '@fastify/jwt';

export async function verifyJwt(
  request: FastifyRequest & { jwtVerify: () => Promise<JWT> },
  reply: FastifyReply
): Promise<void> {
  try {
    await request.jwtVerify();
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unauthorized';
    reply.status(401).send({ 
      error: "Unauthorized",
      message: errorMessage
    });
    return;
  }
}