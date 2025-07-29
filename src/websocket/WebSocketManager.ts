import Fastify from 'fastify';
import fp from 'fastify-plugin';
import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

export class WebSocketManager extends EventEmitter {
  private app: Fastify.FastifyInstance;
  private wss: WebSocket.Server | null = null;

  constructor(app: Fastify.FastifyInstance, dependencies?: any) {
    super();
    this.app = app;
    this.initialize(dependencies);
  }

  private initialize(dependencies?: any) {
    this.app.register(fp(async (fastify) => {
      fastify.get('/ws', { websocket: true }, (connection, req) => {
        this.setupConnection(connection.socket);
      });
    }));

    this.app.ready(() => {
      this.wss = new WebSocket.Server({ noServer: true });
    });
  }

  private setupConnection(ws: WebSocket) {
    logger.info('New WebSocket client connected');
    ws.on('message', (data) => {
      const msg = data.toString();
      logger.debug(`Received WS message: ${msg}`);
      // Process incoming messages if any
    });

    ws.on('close', () => {
      logger.info('WebSocket client disconnected');
    });

    ws.on('error', (err) => {
      logger.error('WebSocket error', err);
    });
  }

  broadcast(event: string, payload: any) {
    if (!this.wss) return;
    const message = JSON.stringify({ event, payload });
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
}
