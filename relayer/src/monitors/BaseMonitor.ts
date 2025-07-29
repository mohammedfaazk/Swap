import { EventEmitter } from 'events';

export abstract class BaseMonitor<TEvent = any> extends EventEmitter {
  protected running = false;

  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;

  protected emitEvent(eventName: string, data: TEvent): void {
    this.emit(eventName, data);
  }
}
