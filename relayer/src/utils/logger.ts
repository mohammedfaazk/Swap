import pino from 'pino';
import { config } from '../config';

const isDev = config.server.environment !== 'production';

export const logger = pino({
  level: isDev ? 'debug' : 'info',
  transport: isDev ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname',
    }
  } : undefined,
  base: {
    service: 'stellbridge-relayer',
    version: '1.0.0',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});
