import { FastifyPluginAsync, FastifyInstance } from 'fastify';
import { z } from 'zod';

// Define types for our domain
interface Swap {
  id: string;
  initiator: string;
  resolver: string;
  amount: string;
  hashlock: string;
  timelock: number;
  stellarAccount: string;
  state: string;
  enablePartialFill: boolean;
  minimumFill?: string;
  filledAmount?: string;
  merkleRoot?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface AuctionResult {
  id: string;
  startTime: number;
  endTime: number;
  minBid: string;
  currentBid?: string;
  currentBidder?: string;
}

// Define service interfaces
interface PrismaSwap {
  findUnique(args: { where: { id: string } }): Promise<Swap | null>;
  create(args: { data: any }): Promise<Swap>;
  update(args: { where: { id: string }; data: Partial<Swap> }): Promise<Swap>;
}

interface Prisma {
  swap: PrismaSwap;
}

interface AuctionEngine {
  startAuction(order: SwapInput): Promise<AuctionResult>;
}

interface ResolverManager {
  auctionEngine: AuctionEngine;
}

interface Coordinator {
  validateOrder(order: SwapInput): Promise<{ isValid: boolean; error?: string }>;
  resolverManager: ResolverManager;
  getActiveOrderCount(): Promise<number>;
  getVolume24h(): Promise<string>;
  getSuccessRate(): Promise<number>;
}

// Declare Fastify extensions
declare module 'fastify' {
  interface FastifyInstance {
    prisma: Prisma;
    coordinator: Coordinator;
  }
}

// Validation schemas
const SwapInputSchema = z.object({
  initiator: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  resolver: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  amount: z.string().regex(/^\d+$/),
  hashlock: z.string().length(64),
  timelock: z.number().int().min(Date.now()),
  stellarAccount: z.string(),
  enablePartialFill: z.boolean().optional().default(false),
  minimumFill: z.string().regex(/^\d+$/).optional(),
  merkleRoot: z.string().optional()
});

const SwapParamsSchema = z.object({
  swapId: z.string().uuid()
});

type SwapInput = z.infer<typeof SwapInputSchema>;
type SwapParams = z.infer<typeof SwapParamsSchema>;

interface SwapResponse {
  success: boolean;
  data?: any;
  error?: string;
}

interface SwapRequest {
  Body: SwapInput;
  Reply: SwapResponse;
}

interface SwapStatusRequest {
  Params: SwapParams;
  Reply: SwapResponse;
}

const swapsRoutes: FastifyPluginAsync = async (app) => {
  // Apply rate limiting
  await app.register(import('@fastify/rate-limit'), {
    max: 100,
    timeWindow: '1 minute'
  });

  app.post<SwapRequest>('/initiate', {
    schema: {
      body: SwapInputSchema
    },
    preHandler: async (request, reply) => {
      // JWT verification
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        reply.status(401).send({ success: false, error: 'Invalid authorization header' });
        return;
      }
      // Additional JWT verification logic here
    }
  }, async (request, reply) => {
    try {
      const { coordinator } = app;
      const orderInput: SwapInput = request.body;

      const validation = await coordinator.validateOrder(orderInput);
      if (!validation.isValid) {
        return reply.status(400).send({
          success: false,
          error: validation.error
        });
      }

      const auction = await coordinator.resolverManager.auctionEngine.startAuction(orderInput);
      return reply.send({
        success: true,
        data: { auction }
      });
    } catch (error) {
      request.log.error('Failed to initiate swap:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to initiate swap'
      });
    }
  });

  app.get<SwapStatusRequest>('/:swapId/status', {
    schema: {
      params: SwapParamsSchema
    },
    preHandler: async (request, reply) => {
      // JWT verification
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        reply.status(401).send({ success: false, error: 'Invalid authorization header' });
        return;
      }
      // Additional JWT verification logic here
    }
  }, async (request, reply) => {
    try {
      const { swapId } = request.params as SwapParams;
      const swap = await app.prisma.swap.findUnique({ where: { id: swapId } });
      
      if (!swap) {
        return reply.status(404).send({
          success: false,
          error: 'Swap not found'
        });
      }

      return reply.send({
        success: true,
        data: {
          id: swap.id,
          initiator: swap.initiator,
          resolver: swap.resolver,
          amount: swap.amount,
          hashlock: swap.hashlock,
          timelock: swap.timelock,
          stellarAccount: swap.stellarAccount,
          state: swap.state,
          enablePartialFill: swap.enablePartialFill,
          minimumFill: swap.minimumFill,
          filledAmount: swap.filledAmount,
          merkleRoot: swap.merkleRoot,
          createdAt: swap.createdAt,
          updatedAt: swap.updatedAt
        }
      });
    } catch (error) {
      request.log.error('Failed to fetch swap status:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch swap status'
      });
    }
  });
};

export default swapsRoutes;
