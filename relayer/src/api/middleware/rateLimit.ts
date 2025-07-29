import fastifyRateLimit from 'fastify-rate-limit';

export const rateLimit = fastifyRateLimit({
  max: 150,
  timeWindow: '1 minute'
});
