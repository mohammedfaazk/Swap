import { FastifySchema } from 'fastify';
import { z, AnyZodObject } from 'zod';

export function validateSchema(schema: AnyZodObject): FastifySchema {
  return {
    body: {
      type: 'object',
      ...schema.shape
    }
  };
}
