import { EventEmitter } from 'events';

export abstract class BaseMonitor extends EventEmitter {
  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;
}
