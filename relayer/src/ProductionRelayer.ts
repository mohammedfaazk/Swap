import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import fastifyJwt from '@fastify/jwt';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyHelmet from '@fastify/helmet';
import fastifyCompress from '@fastify/compress';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUI from '@fastify/swagger-ui';
import fastifyHealthcheck from 'fastify-healthcheck';
import { EthereumMonitor } from './monitors/EthereumMonitor';
import { StellarMonitor } from './monitors/StellarMonitor';
import { ResolverManager } from './resolvers/ResolverManager';
import { AuctionEngine } from './resolvers/AuctionEngine';
import { PartialFillOptimizer } from './resolvers/PartialFillOptimizer';
import { CrossChainCoordinator } from './coordination/CrossChainCoordinator';
import { SecretManager } from './coordination/SecretManager';
import { MerkleTreeManager } from './coordination/MerkleTreeManager';
import { WebSocketManager } from './websocket/WebSocketManager';
import { logger } from './utils/logger';
import { config } from './config';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { AnalyticsService } from './services/AnalyticsService';
import { NotificationService } from './services/NotificationService';
import { EventBus } from './utils/EventBus';
import { MetricsCollector } from './utils/MetricsCollector';
import { SecurityManager } from './utils/SecurityManager';

/**
 * Production-ready cross-chain atomic swap relayer
 * 
 * Features:
 * - Multi-network support with automatic failover
 * - Advanced monitoring and alerting
 * - Comprehensive security controls
 * - Performance optimization and caching
 * - Real-time analytics and reporting
 * - Circuit breakers and rate limiting
 * - Health checks and self-healing
 */
export class ProductionRelayer {
  private app = Fastify({ 
    logger: {
      level: config.logging.level,
      prettyPrint: config.environment === 'development'
    },
    trustProxy: true,
    requestTimeout: 30000,
    keepAliveTimeout: 65000
  });

  private prisma = new PrismaClient({
    log: ['error', 'warn'],
    datasources: {
      db: { url: config.database.url }
    }
  });

  private redis = new Redis(config.redis.url, {
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
    lazyConnect: true
  });

  // Core services
  private ethereumMonitor!: EthereumMonitor;
  private stellarMonitor!: StellarMonitor;
  private resolverManager!: ResolverManager;
  private auctionEngine!: AuctionEngine;
  private partialFillOptimizer!: PartialFillOptimizer;
  private coordinator!: CrossChainCoordinator;
  private secretManager!: SecretManager;
  private merkleTreeManager!: MerkleTreeManager;
  private wsManager!: WebSocketManager;

  // Production services
  private analyticsService!: AnalyticsService;
  private notificationService!: NotificationService;
  private eventBus!: EventBus;
  private metricsCollector!: MetricsCollector;
  private securityManager!: SecurityManager;

  // Health tracking
  private healthChecks = new Map<string, () => Promise<boolean>>();
  private startupTime = Date.now();
  private isShuttingDown = false;

  constructor() {
    this.setupGracefulShutdown();
    this.setupHealthMonitoring();
  }

  async initialize() {
    logger.info('🚀 Initializing Production Relayer...');
    
    try {
      // Initialize core infrastructure
      await this.initializeInfrastructure();
      
      // Setup middleware and plugins
      await this.setupMiddleware();
      
      // Initialize monitoring and analytics
      await this.initializeMonitoring();
      
      // Initialize core services
      await this.initializeCoreServices();
      
      // Setup API routes
      await this.setupRoutes();
      
      // Initialize WebSocket
      await this.initializeWebSocket();
      
      // Start background processes
      await this.startBackgroundProcesses();
      
      logger.info('✅ Production Relayer initialized successfully');
    } catch (error) {
      logger.error('❌ Failed to initialize Production Relayer:', error);
      throw error;
    }
  }

  private async initializeInfrastructure() {
    logger.info('🔌 Connecting to infrastructure...');
    
    // Database connection
    try {
      await this.prisma.$connect();
      await this.prisma.$queryRaw`SELECT 1`;
      logger.info('✅ Database connected');
      
      this.healthChecks.set('database', async () => {
        try {
          await this.prisma.$queryRaw`SELECT 1`;
          return true;
        } catch {
          return false;
        }
      });
    } catch (error) {
      logger.error('❌ Database connection failed:', error);
      throw error;
    }

    // Redis connection
    try {
      await this.redis.connect();
      await this.redis.ping();
      logger.info('✅ Redis connected');
      
      this.healthChecks.set('redis', async () => {
        try {
          await this.redis.ping();
          return true;
        } catch {
          return false;
        }
      });
    } catch (error) {
      logger.error('❌ Redis connection failed:', error);
      throw error;
    }
  }

  private async setupMiddleware() {
    logger.info('🛡️ Setting up middleware...');

    // Security middleware
    await this.app.register(fastifyHelmet, {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    });

    // Compression
    await this.app.register(fastifyCompress, {
      global: true,
      threshold: 1024,
    });

    // CORS
    await this.app.register(cors, {
      origin: config.security.allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    });

    // JWT Authentication
    await this.app.register(fastifyJwt, {
      secret: config.security.jwtSecret,
      sign: {
        expiresIn: '24h',
      },
    });

    // Rate limiting with Redis
    await this.app.register(fastifyRateLimit, {
      redis: this.redis,
      max: config.security.apiRateLimit,
      timeWindow: '1 minute',
      keyGenerator: (req) => req.ip,
      errorResponseBuilder: () => ({
        code: 'RATE_LIMIT_EXCEEDED',
        error: 'Rate limit exceeded',
        message: 'Too many requests, please try again later',
      }),
    });

    // WebSocket support
    await this.app.register(websocket);

    // API documentation
    if (config.environment !== 'production') {
      await this.app.register(fastifySwagger, {
        swagger: {
          info: {
            title: 'StellarBridge Production API',
            description: 'Production-ready cross-chain atomic swap API',
            version: '2.0.0',
          },
          host: config.server.host,
          schemes: ['https', 'http'],
          consumes: ['application/json'],
          produces: ['application/json'],
        },
      });

      await this.app.register(fastifySwaggerUI, {
        routePrefix: '/documentation',
        uiConfig: {
          docExpansion: 'list',
          deepLinking: false,
        },
      });
    }

    // Health checks
    await this.app.register(fastifyHealthcheck, {
      healthcheckUrl: '/health',
      healthcheckUrlDisable404: true,
    });
  }

  private async initializeMonitoring() {
    logger.info('📊 Initializing monitoring services...');

    // Event bus for internal communication
    this.eventBus = new EventBus();

    // Metrics collection
    this.metricsCollector = new MetricsCollector({
      redis: this.redis,
      eventBus: this.eventBus,
    });

    // Analytics service
    this.analyticsService = new AnalyticsService({
      prisma: this.prisma,
      redis: this.redis,
      metricsCollector: this.metricsCollector,
    });

    // Notification service
    this.notificationService = new NotificationService({
      webhookUrl: config.notifications.webhookUrl,
      emailConfig: config.notifications.email,
      slackConfig: config.notifications.slack,
    });

    // Security manager
    this.securityManager = new SecurityManager({
      prisma: this.prisma,
      redis: this.redis,
      notificationService: this.notificationService,
    });

    // Setup health checks for monitoring services
    this.healthChecks.set('metrics', () => this.metricsCollector.isHealthy());
    this.healthChecks.set('analytics', () => this.analyticsService.isHealthy());
    this.healthChecks.set('notifications', () => this.notificationService.isHealthy());
  }

  private async initializeCoreServices() {
    logger.info('⚙️ Initializing core services...');

    // Secret management
    this.secretManager = new SecretManager({
      encryptionKey: config.security.encryptionKey,
      redis: this.redis,
    });

    // Merkle tree management
    this.merkleTreeManager = new MerkleTreeManager({
      redis: this.redis,
      eventBus: this.eventBus,
    });

    // Enhanced Ethereum monitoring
    this.ethereumMonitor = new EthereumMonitor({
      rpcUrl: config.ethereum.rpcUrl,
      backupRpcUrls: config.ethereum.backupRpcUrls,
      contractAddress: config.ethereum.contractAddress,
      startBlock: config.ethereum.startBlock,
      prisma: this.prisma,
      redis: this.redis,
      eventBus: this.eventBus,
      metricsCollector: this.metricsCollector,
      maxRetries: 3,
      retryDelay: 1000,
    });

    // Enhanced Stellar monitoring
    this.stellarMonitor = new StellarMonitor({
      horizonUrl: config.stellar.horizonUrl,
      backupHorizonUrls: config.stellar.backupHorizonUrls,
      contractId: config.stellar.contractId,
      networkPassphrase: config.stellar.networkPassphrase,
      prisma: this.prisma,
      redis: this.redis,
      eventBus: this.eventBus,
      metricsCollector: this.metricsCollector,
      maxRetries: 3,
      retryDelay: 1000,
    });

    // Resolver management with advanced features
    this.resolverManager = new ResolverManager({
      ethereumRpc: config.ethereum.rpcUrl,
      stellarHorizon: config.stellar.horizonUrl,
      minStake: BigInt(config.resolvers.minStake),
      maxResolvers: config.resolvers.maxResolvers,
      prisma: this.prisma,
      redis: this.redis,
      eventBus: this.eventBus,
      securityManager: this.securityManager,
      performanceTracker: this.metricsCollector,
    });

    // Auction engine with MEV protection
    this.auctionEngine = new AuctionEngine({
      resolverManager: this.resolverManager,
      config: config.resolvers,
      eventBus: this.eventBus,
      metricsCollector: this.metricsCollector,
      antiMevProtection: true,
    });

    // Partial fill optimizer
    this.partialFillOptimizer = new PartialFillOptimizer({
      eventBus: this.eventBus,
      analyticsService: this.analyticsService,
      optimizationAlgorithm: 'advanced',
    });

    // Cross-chain coordinator with enhanced features
    this.coordinator = new CrossChainCoordinator({
      ethereumMonitor: this.ethereumMonitor,
      stellarMonitor: this.stellarMonitor,
      resolverManager: this.resolverManager,
      auctionEngine: this.auctionEngine,
      partialFillOptimizer: this.partialFillOptimizer,
      secretManager: this.secretManager,
      merkleTreeManager: this.merkleTreeManager,
      prisma: this.prisma,
      redis: this.redis,
      eventBus: this.eventBus,
      analyticsService: this.analyticsService,
      notificationService: this.notificationService,
      securityManager: this.securityManager,
    });

    // Setup health checks for core services
    this.healthChecks.set('ethereum', () => this.ethereumMonitor.isHealthy());
    this.healthChecks.set('stellar', () => this.stellarMonitor.isHealthy());
    this.healthChecks.set('coordinator', () => this.coordinator.isHealthy());
    this.healthChecks.set('resolvers', () => this.resolverManager.isHealthy());

    logger.info('✅ Core services initialized');
  }

  private async setupRoutes() {
    logger.info('🛣️ Setting up API routes...');

    // Health check route
    this.app.get('/health', async (request, reply) => {
      const checks = await this.runHealthChecks();
      const isHealthy = Object.values(checks).every(status => status);
      
      return reply.code(isHealthy ? 200 : 503).send({
        status: isHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: Date.now() - this.startupTime,
        checks,
        version: process.env.npm_package_version || '2.0.0',
      });
    });

    // Metrics endpoint
    this.app.get('/metrics', async (request, reply) => {
      const metrics = await this.metricsCollector.getMetrics();
      return reply.send(metrics);
    });

    // Swap initiation endpoint
    this.app.post('/api/v2/swaps', {
      schema: {
        body: {
          type: 'object',
          required: ['fromChain', 'toChain', 'amount', 'destinationAddress'],
          properties: {
            fromChain: { type: 'string', enum: ['ethereum', 'stellar'] },
            toChain: { type: 'string', enum: ['ethereum', 'stellar'] },
            amount: { type: 'string' },
            destinationAddress: { type: 'string' },
            token: { type: 'string' },
            timelock: { type: 'number', minimum: 3600, maximum: 259200 }, // 1h to 72h
            partialFillEnabled: { type: 'boolean' },
          },
        },
      },
    }, async (request, reply) => {
      try {
        const swapRequest = request.body as any;
        
        // Security validation
        await this.securityManager.validateSwapRequest(swapRequest, request.ip);
        
        // Initiate swap
        const swap = await this.coordinator.initiateSwap(swapRequest);
        
        // Track metrics
        this.metricsCollector.recordSwapInitiated(swap);
        
        return reply.send({
          success: true,
          swapId: swap.id,
          status: swap.status,
          estimatedTime: swap.estimatedCompletionTime,
        });
      } catch (error) {
        logger.error('Swap initiation failed:', error);
        return reply.code(400).send({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Swap status endpoint
    this.app.get('/api/v2/swaps/:swapId', async (request, reply) => {
      try {
        const { swapId } = request.params as { swapId: string };
        const swap = await this.coordinator.getSwapStatus(swapId);
        
        if (!swap) {
          return reply.code(404).send({
            success: false,
            error: 'Swap not found',
          });
        }
        
        return reply.send({
          success: true,
          swap: {
            id: swap.id,
            status: swap.status,
            progress: swap.progress,
            fromChain: swap.fromChain,
            toChain: swap.toChain,
            amount: swap.amount,
            createdAt: swap.createdAt,
            updatedAt: swap.updatedAt,
            transactions: swap.transactions,
            estimatedCompletionTime: swap.estimatedCompletionTime,
          },
        });
      } catch (error) {
        logger.error('Failed to get swap status:', error);
        return reply.code(500).send({
          success: false,
          error: 'Internal server error',
        });
      }
    });

    // Analytics endpoint
    this.app.get('/api/v2/analytics', async (request, reply) => {
      try {
        const analytics = await this.analyticsService.getOverallAnalytics();
        return reply.send({
          success: true,
          data: analytics,
        });
      } catch (error) {
        logger.error('Failed to get analytics:', error);
        return reply.code(500).send({
          success: false,
          error: 'Failed to retrieve analytics',
        });
      }
    });

    // Resolver registration endpoint
    this.app.post('/api/v2/resolvers/register', async (request, reply) => {
      try {
        const registrationData = request.body as any;
        const resolver = await this.resolverManager.registerResolver(registrationData);
        
        return reply.send({
          success: true,
          resolver: {
            id: resolver.id,
            address: resolver.address,
            status: resolver.status,
          },
        });
      } catch (error) {
        logger.error('Resolver registration failed:', error);
        return reply.code(400).send({
          success: false,
          error: error instanceof Error ? error.message : 'Registration failed',
        });
      }
    });

    logger.info('✅ API routes configured');
  }

  private async initializeWebSocket() {
    logger.info('🔌 Initializing WebSocket...');

    this.wsManager = new WebSocketManager(this.app, {
      coordinator: this.coordinator,
      ethereumMonitor: this.ethereumMonitor,
      stellarMonitor: this.stellarMonitor,
      analyticsService: this.analyticsService,
      eventBus: this.eventBus,
      authenticationRequired: config.security.wsAuthRequired,
    });

    await this.wsManager.initialize();
    logger.info('✅ WebSocket initialized');
  }

  private async startBackgroundProcesses() {
    logger.info('🔄 Starting background processes...');

    // Start monitors
    await this.ethereumMonitor.start();
    await this.stellarMonitor.start();
    
    // Start resolver management
    await this.resolverManager.start();
    
    // Start coordination
    await this.coordinator.start();
    
    // Start analytics processing
    await this.analyticsService.start();
    
    // Start metrics collection
    await this.metricsCollector.start();

    // Setup periodic tasks
    this.setupPeriodicTasks();

    logger.info('✅ Background processes started');
  }

  private setupPeriodicTasks() {
    // Health check every 30 seconds
    setInterval(async () => {
      if (this.isShuttingDown) return;
      
      const healthStatus = await this.runHealthChecks();
      const unhealthyServices = Object.entries(healthStatus)
        .filter(([, status]) => !status)
        .map(([service]) => service);
      
      if (unhealthyServices.length > 0) {
        logger.warn('Unhealthy services detected:', unhealthyServices);
        await this.notificationService.sendAlert({
          type: 'health_check_failed',
          services: unhealthyServices,
          timestamp: new Date(),
        });
      }
    }, 30000);

    // Metrics collection every 60 seconds
    setInterval(async () => {
      if (this.isShuttingDown) return;
      await this.metricsCollector.collectMetrics();
    }, 60000);

    // Cleanup expired data every hour
    setInterval(async () => {
      if (this.isShuttingDown) return;
      await this.cleanupExpiredData();
    }, 3600000);
  }

  private async runHealthChecks(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    
    for (const [service, check] of this.healthChecks) {
      try {
        results[service] = await check();
      } catch (error) {
        logger.error(`Health check failed for ${service}:`, error);
        results[service] = false;
      }
    }
    
    return results;
  }

  private async cleanupExpiredData() {
    try {
      logger.info('🧹 Running periodic cleanup...');
      
      // Clean up old swap records
      await this.coordinator.cleanupExpiredSwaps();
      
      // Clean up old metrics
      await this.metricsCollector.cleanupOldMetrics();
      
      // Clean up old logs
      await this.analyticsService.cleanupOldAnalytics();
      
      logger.info('✅ Cleanup completed');
    } catch (error) {
      logger.error('❌ Cleanup failed:', error);
    }
  }

  private setupHealthMonitoring() {
    // Setup application-level health checks
    this.app.addHook('onRequest', async (request, reply) => {
      if (this.isShuttingDown) {
        reply.code(503).send({ error: 'Service shutting down' });
        return;
      }
    });

    // Monitor memory usage
    setInterval(() => {
      const memUsage = process.memoryUsage();
      const memUsageMB = {
        rss: Math.round(memUsage.rss / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024),
      };

      if (memUsageMB.heapUsed > 1000) { // Alert if using more than 1GB
        logger.warn('High memory usage detected:', memUsageMB);
      }
    }, 60000);
  }

  private setupGracefulShutdown() {
    const gracefulShutdown = async (signal: string) => {
      logger.info(`${signal} received. Starting graceful shutdown...`);
      this.isShuttingDown = true;

      try {
        // Stop accepting new connections
        await this.app.close();
        
        // Stop background processes
        await this.coordinator.stop();
        await this.resolverManager.stop();
        await this.stellarMonitor.stop();
        await this.ethereumMonitor.stop();
        await this.analyticsService.stop();
        await this.metricsCollector.stop();
        
        // Close database connections
        await this.redis.quit();
        await this.prisma.$disconnect();
        
        logger.info('✅ Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('❌ Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception:', error);
      gracefulShutdown('UNCAUGHT_EXCEPTION');
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection at:', promise, 'reason:', reason);
      gracefulShutdown('UNHANDLED_REJECTION');
    });
  }

  async start() {
    try {
      await this.initialize();
      
      const PORT = config.server.port;
      const HOST = config.server.host;
      
      await this.app.listen({ port: PORT, host: HOST });
      
      logger.info(`🚀 Production Relayer running at http://${HOST}:${PORT}`);
      logger.info(`📚 API Documentation: http://${HOST}:${PORT}/documentation`);
      logger.info(`❤️ Health Check: http://${HOST}:${PORT}/health`);
      logger.info(`📊 Metrics: http://${HOST}:${PORT}/metrics`);
      
      // Send startup notification
      await this.notificationService.sendNotification({
        type: 'startup',
        message: 'Production Relayer started successfully',
        timestamp: new Date(),
        details: {
          host: HOST,
          port: PORT,
          version: process.env.npm_package_version || '2.0.0',
        },
      });
      
    } catch (error) {
      logger.error('❌ Failed to start Production Relayer:', error);
      throw error;
    }
  }
}