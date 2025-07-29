import { FastifyReply, FastifyRequest } from 'fastify';
import Redis from 'ioredis';

const redis = new Redis();

const MAX_REQUESTS = 100;
const WINDOW = 60 * 1000; // 1 minute

export async function rateLimitMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const ip = request.ip;
  const key = `rate-limit:${ip}`;

  const count = await redis.incr(key);
  if (count === 1) {
    await redis.pexpire(key, WINDOW);
  }

  if (count > MAX_REQUESTS) {
    return reply.status(429).send({ error: 'Too many requests' });
  }
}
