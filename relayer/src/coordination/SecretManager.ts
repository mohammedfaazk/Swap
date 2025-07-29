import crypto from 'crypto';

export class SecretManager {
  generateSecret(): Buffer {
    return crypto.randomBytes(32);
  }

  hashSecret(secret: Buffer): Buffer {
    return crypto.createHash('sha256').update(secret).digest();
  }

  verifyHash(secret: Buffer, hash: Buffer): boolean {
    const computedHash = this.hashSecret(secret);
    return computedHash.equals(hash);
  }
}
