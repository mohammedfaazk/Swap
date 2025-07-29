import crypto from 'crypto';

export function generateSecret(length = 32): Buffer {
  return crypto.randomBytes(length);
}

export function computeHashlock(secret: Buffer): string {
  return crypto.createHash('sha256').update(secret).digest('hex');
}

export function verifyHashlock(secret: Buffer, hashlock: string): boolean {
  return computeHashlock(secret) === hashlock;
}
