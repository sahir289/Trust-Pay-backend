// __tests__/zentechind.test.js
import crypto from 'crypto';
import axios from 'axios';
import { generateHash } from '../zentechind/zentechInd.js';
import { createZenTechIndTransaction } from '../zentechind/zentechInd.js';

import config from '../config/config.js';

// Mock axios
jest.mock('axios');

// Mock logger to avoid noisy console output
jest.mock('../utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('ZenTechInd Utils', () => {
  describe('generateHash', () => {
    it('should generate correct SHA512 hash', () => {
      const body = {
        amount: '100',
        order_id: 'ORD123',
      };

      const stringToHash = `${config.zentechind.collectionId}|${body.amount}|${body.order_id}|${config.zentechind.salt}`;
      const expectedHash = crypto.createHash('sha512').update(stringToHash).digest('hex');

      const hash = generateHash(body);

      expect(hash).toBe(expectedHash);
    });
  });

  describe('createZenTechIndTransaction', () => {
    const deposit = {
      merchant_order_id: 'ORDER123',
      user: 'USER123',
    };

    const amount = '200';

    it('should create transaction successfully', async () => {
      const mockResponse = { data: { status: 'success', txn_id: 'TXN001' } };
      axios.post.mockResolvedValueOnce(mockResponse);

      const response = await createZenTechIndTransaction(deposit, amount);

      expect(response).toEqual(mockResponse.data);

      expect(axios.post).toHaveBeenCalledWith(
        config.zentechind.url,
        expect.objectContaining({
          collection_id: config.zentechind.collectionId,
          order_id: deposit.merchant_order_id,
          amount,
          user_id: deposit.user,
          hash: expect.any(String), // hash must be included
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    });

    it('should handle API error response', async () => {
      const mockError = {
        response: { data: { error: 'Invalid request' } },
      };
      axios.post.mockRejectedValueOnce(mockError);

      await expect(createZenTechIndTransaction(deposit, amount)).rejects.toEqual(mockError);
    });

    it('should handle network or unexpected error', async () => {
      const mockError = new Error('Network error');
      axios.post.mockRejectedValueOnce(mockError);

      await expect(createZenTechIndTransaction(deposit, amount)).rejects.toThrow('Network error');
    });
  });
});
