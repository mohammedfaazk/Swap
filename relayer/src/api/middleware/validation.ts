
import { FastifySchema, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

export interface ValidationSchema {
  body?: z.ZodObject<any>;
  querystring?: z.ZodObject<any>;
  params?: z.ZodObject<any>;
  headers?: z.ZodObject<any>;
}

export function validateSchema(schema: ValidationSchema): FastifySchema {
  const jsonSchema: FastifySchema = {};

  if (schema.body) {
    jsonSchema.body = {
      type: 'object',
      properties: schema.body.shape as Record<string, unknown>
    };
  }
  if (schema.querystring) {
    jsonSchema.querystring = {
      type: 'object',
      properties: schema.querystring.shape as Record<string, unknown>
    };
  }
  if (schema.params) {
    jsonSchema.params = {
      type: 'object',
      properties: schema.params.shape as Record<string, unknown>
    };
  }
  if (schema.headers) {
    jsonSchema.headers = {
      type: 'object',
      properties: schema.headers.shape as Record<string, unknown>
    };
  }

  return jsonSchema;
}

export async function validateRequest(
  request: FastifyRequest,
  reply: FastifyReply,
  schema: ValidationSchema
): Promise<void> {
  try {
    if (schema.body) {
      await schema.body.parseAsync(request.body);
    }
    if (schema.querystring) {
      await schema.querystring.parseAsync(request.query);
    }
    if (schema.params) {
      await schema.params.parseAsync(request.params);
    }
    if (schema.headers) {
      await schema.headers.parseAsync(request.headers);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Validation error',
        details: error.issues.map(issue => ({
          path: issue.path.join('.'),
          message: issue.message
        }))
      });
      return;
    }
    reply.status(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'An unexpected error occurred'
    });
    return;
  }
}