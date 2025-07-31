// Re-export all types for easier importing
export * from './api';
export * from './swap';
export * from './resolver';

// Common utility types
export interface ServiceStatus {
  connected: boolean;
  lastUpdate?: Date;
  error?: string;
}