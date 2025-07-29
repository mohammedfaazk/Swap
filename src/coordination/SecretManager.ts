import crypto from 'crypto';

export class SecretManager {
  private secretMap = new Map<string, Buffer>();

  generateSecret(): Buffer {
    const secret = Buffer.from(crypto.randomBytes(32));
    this.secretMap.set(secret.toString('hex'), secret);
    return secret;
  }

  getSecret(hashlock: string): Buffer | undefined {
    for (const [key, secret] of this.secretMap.entries()) {
      if (this.computeHashlock(secret) === hashlock) return secret;
    }
    return undefined;
  }

  computeHashlock(secret: Buffer): string {
    return crypto.createHash('sha256').update(secret).digest('hex');
  }
}
