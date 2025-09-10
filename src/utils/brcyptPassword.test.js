import { createHash, verifyHash } from './bcryptPassword'; 
import bcrypt from 'bcrypt';

jest.mock('bcrypt'); // Mock bcrypt to avoid actual hashing during tests

describe('Password hashing and verification', () => {
  const plaintext = 'mySecretPassword';
  const fakeHash = 'hashedPassword123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('createHash should return a hash', async () => {
    bcrypt.hash.mockResolvedValue(fakeHash);

    const hash = await createHash(plaintext);

    expect(bcrypt.hash).toHaveBeenCalledWith(plaintext, 12);
    expect(hash).toBe(fakeHash);
  });

  test('verifyHash should return true for matching password', async () => {
    bcrypt.compare.mockResolvedValue(true);

    const result = await verifyHash(plaintext, fakeHash);

    expect(bcrypt.compare).toHaveBeenCalledWith(plaintext, fakeHash);
    expect(result).toBe(true);
  });

  test('verifyHash should return false for non-matching password', async () => {
    bcrypt.compare.mockResolvedValue(false);

    const result = await verifyHash('wrongPassword', fakeHash);

    expect(bcrypt.compare).toHaveBeenCalledWith('wrongPassword', fakeHash);
    expect(result).toBe(false);
  });
});
