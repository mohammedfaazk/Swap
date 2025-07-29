import * as dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

dotenv.config({ path: path.join(__dirname, '../../../.env') });

const schema = z.object({
  server: z.object({
    port: z.number().default(3001),
    host: z.string().default('0.0.0.0'),
  }),
  ethereum: z.object({
    rpcUrl: z.string(),
    contractAddress: z.string(),
    startBlock: z.number().default(0),
  }),
  stellar: z.object({
    horizonUrl: z.string(),
    contractId: z.string(),
    networkPassphrase: z.string(),
  }),
  redis: z.object({
    url: z.string(),
  }),
  resolvers: z.object({
    minStake: z.string().default('10000000000000000000'),
    maxResolvers: z.number().default(100),
    auctionDuration: z.number().default(60), // seconds
  }),
});

export const config = schema.parse({
  server: {
    port: Number(process.env.PORT) || 3001,
    host: process.env.HOST || '0.0.0.0',
  },
  ethereum: {
    rpcUrl: process.env.ETHEREUM_RPC_URL || 'http://localhost:8545',
    contractAddress: process.env.HTLC_CONTRACT_ADDRESS || '',
    startBlock: Number(process.env.START_BLOCK) || 0,
  },
  stellar: {
    horizonUrl: process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org',
    contractId: process.env.STELLAR_CONTRACT_ID || '',
    networkPassphrase: process.env.STELLAR_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  resolvers: {
    minStake: process.env.MIN_RESOLVER_STAKE || '10000000000000000000',
    maxResolvers: Number(process.env.MAX_RESOLVERS) || 100,
    auctionDuration: Number(process.env.AUCTION_DURATION) || 60,
  },
});
