import crypto from 'crypto';

export const sha256 = (data: Buffer | string): Buffer => {
  return crypto.createHash('sha256').update(data).digest();
};

export const randomBytes = (length: number): Buffer => {
  return crypto.randomBytes(length);
};

export const verifyHash = (data: Buffer | string, hash: Buffer | string) => {
  const computedHash = sha256(data);
  return computedHash.equals(Buffer.isBuffer(hash) ? hash : Buffer.from(hash, 'hex'));
};
