import { z } from 'zod';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../../.env') });

const configSchema = z.object({
  server: z.object({
    port: z.number().default(3001),
    host: z.string().default('0.0.0.0'),
    environment: z.enum(['development', 'production', 'test']).default('development'),
  }),
  ethereum: z.object({
    rpcUrl: z.string().url(),
    contractAddress: z.string(),
    privateKey: z.string().optional(),
    startBlock: z.number().default(0),
    confirmations: z.number().default(1),
    gasLimit: z.number().default(500_000),
    gasPrice: z.string().optional(),
  }),
  stellar: z.object({
    horizonUrl: z.string().url(),
    contractId: z.string(),
    networkPassphrase: z.string(),
    secretKey: z.string().optional(),
  }),
  database: z.object({
    url: z.string(),
  }),
  redis: z.object({
    url: z.string(),
  }),
  resolvers: z.object({
    minStake: z.string().default("10000000000000000000"), // 10 ETH in wei
    maxResolvers: z.number().default(100),
    auctionDuration: z.number().default(60), // seconds
    slashingPercentage: z.number().default(10),
  }),
  monitoring: z.object({
    enableMetrics: z.boolean().default(true),
    metricsPort: z.number().default(9090),
    healthCheckInterval: z.number().default(30000),
  }),
  security: z.object({
    jwtSecret: z.string().min(32),
    apiRateLimit: z.number().default(100),
    enableCors: z.boolean().default(true),
  }),
  demo: z.object({
    mode: z.boolean().default(false),
    hackathonMode: z.boolean().default(false),
    autoCompleteSwaps: z.boolean().default(false),
  }),
});

const rawConfig = {
  server: {
    port: parseInt(process.env.PORT || '3001'),
    host: process.env.HOST || '0.0.0.0',
    environment: process.env.NODE_ENV || 'development',
  },
  ethereum: {
    rpcUrl: process.env.ETHEREUM_RPC_URL || 'http://localhost:8545',
    contractAddress: process.env.HTLC_CONTRACT_ADDRESS || '',
    privateKey: process.env.ETHEREUM_PRIVATE_KEY,
    startBlock: parseInt(process.env.START_BLOCK || '0'),
    confirmations: parseInt(process.env.ETHEREUM_CONFIRMATIONS || '1'),
    gasLimit: parseInt(process.env.GAS_LIMIT || '500000'),
    gasPrice: process.env.GAS_PRICE,
  },
  stellar: {
    horizonUrl: process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org',
    contractId: process.env.STELLAR_CONTRACT_ID || '',
    networkPassphrase: process.env.STELLAR_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015',
    secretKey: process.env.STELLAR_SECRET_KEY,
  },
  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/stellarbridge',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  resolvers: {
    minStake: process.env.MIN_RESOLVER_STAKE || "10000000000000000000",
    maxResolvers: parseInt(process.env.MAX_RESOLVERS || '100'),
    auctionDuration: parseInt(process.env.AUCTION_DURATION || '60'),
    slashingPercentage: parseInt(process.env.SLASHING_PERCENTAGE || '10'),
  },
  monitoring: {
    enableMetrics: process.env.ENABLE_METRICS === 'true',
    metricsPort: parseInt(process.env.METRICS_PORT || '9090'),
    healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000'),
  },
  security: {
    jwtSecret: process.env.JWT_SECRET || 'stellarbridge-demo-jwt-secret-min-32-chars-long-12345',
    apiRateLimit: parseInt(process.env.API_RATE_LIMIT || '100'),
    enableCors: process.env.ENABLE_CORS !== 'false',
  },
  demo: {
    mode: process.env.DEMO_MODE === 'true',
    hackathonMode: process.env.HACKATHON_MODE === 'true',
    autoCompleteSwaps: process.env.AUTO_COMPLETE_SWAPS === 'true',
  },
};

export const config = configSchema.parse(rawConfig);
export type Config = z.infer<typeof configSchema>;
