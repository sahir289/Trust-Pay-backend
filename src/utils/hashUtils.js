import crypto from 'node:crypto';

export const createHash = (data) => {
  const hash = crypto.createHash('sha256').update(data).digest('hex'); // Use SHA-256 for deterministic hashing
  return hash;
};

export const compareHash = (data, hash) => {
  const generatedHash = createHash(data);
  // Constant-time comparison to avoid leaking match progress via timing.
  const a = globalThis.Buffer.from(generatedHash, 'utf8');
  const b = globalThis.Buffer.from(String(hash ?? ''), 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};
