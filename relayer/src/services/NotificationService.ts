import { FastifyInstance } from 'fastify';

export class NotificationService {
  private app: FastifyInstance;

  constructor(app: FastifyInstance) {
    this.app = app;
  }

  emitNotification(eventType: string, data: any) {
    this.app.websocketServer.clients.forEach(client => {
      if (client.readyState === 1) {
        client.send(JSON.stringify({ event: eventType, data }));
      }
    });
  }
}
