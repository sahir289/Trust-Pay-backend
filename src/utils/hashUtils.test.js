import { createHash, compareHash } from './hashUtils.js'; // adjust path

describe('Hash Utilities', () => {
  const sampleData = 'mySecretData';
  let generatedHash;

  describe('createHash', () => {
    it('should generate a SHA-256 hash as a hex string', () => {
      generatedHash = createHash(sampleData);
      expect(typeof generatedHash).toBe('string');
      expect(generatedHash).toHaveLength(64); // SHA-256 produces 64 hex chars
    });

    it('should generate the same hash for the same input', () => {
      const hash1 = createHash(sampleData);
      const hash2 = createHash(sampleData);
      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different inputs', () => {
      const hash1 = createHash(sampleData);
      const hash2 = createHash('differentData');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('compareHash', () => {
    it('should return true if data matches the hash', () => {
      const isMatch = compareHash(sampleData, generatedHash);
      expect(isMatch).toBe(true);
    });

    it('should return false if data does not match the hash', () => {
      const isMatch = compareHash('wrongData', generatedHash);
      expect(isMatch).toBe(false);
    });
  });
});
