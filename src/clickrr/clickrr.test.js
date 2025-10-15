import { generateSignature, initiateClickrrPayout, getClickrrWalletBalance } from './clickrr.js'; // Adjust path as needed
import crypto from 'crypto';
import axios from 'axios';
import { logger } from '../utils/logger.js';
import config from '../config/config.js';
import { sendSuccess } from '../utils/responseHandlers.js';

jest.mock('axios');
jest.mock('../utils/logger.js');
jest.mock('../utils/responseHandlers.js');
jest.mock('../config/config.js');

const mockedAxios = axios;
const mockedLogger = logger;
const mockedSendSuccess = sendSuccess;
const mockedConfig = config;

describe('generateSignature', () => {
  it('should generate correct signature and timestamp with custom timestamp', () => {
    const apiKey = 'test-api-key';
    const apiSecret = 'test-api-secret';
    const method = 'POST';
    const timestamp = 1234567890;
    const expectedStringToSign = `${timestamp}|${method}|${apiKey}`;
    const expectedSignature = crypto
      .createHmac('sha256', apiSecret)
      .update(expectedStringToSign)
      .digest('hex');

    const result = generateSignature(apiKey, apiSecret, method, timestamp);

    expect(result.timestamp).toBe(timestamp);
    expect(result.signature).toBe(expectedSignature);
  });

  it('should generate signature with default timestamp', () => {
    const apiKey = 'test-api-key';
    const apiSecret = 'test-api-secret';
    const method = 'POST';
    const timestamp = Math.floor(Date.now() / 1000);

    const result = generateSignature(apiKey, apiSecret, method);

    expect(result.timestamp).toBeCloseTo(timestamp, 1); // Allow for minor timing differences
    expect(result.signature).toHaveLength(64); // Hex digest length
  });
});

describe('initiateClickrrPayout', () => {
  const mockPayload = {
    amount: '100.50',
    user_bank_details: {
      account_no: '123456789012',
      account_holder_name: 'John Doe',
      ifsc_code: 'SBIN0001234',
      bank_name: 'State Bank of India',
    },
    merchant_order_id: 'MERCHANT_ORDER_123',
  };

  const mockResponseData = { status: 'success', transactionId: 'TXN_456' };

  beforeEach(() => {
    mockedConfig.clickrr = {
      baseUrl: 'https://api.clickrr.com',
      initiatePayout: '/v1/payouts',
      apiKey: 'test-api-key',
      apiSecret: 'test-api-secret',
    };
    mockedAxios.post.mockResolvedValue({ data: { data: mockResponseData } });
    mockedLogger.error.mockClear();
  });

  it('should initiate payout successfully', async () => {
    const result = await initiateClickrrPayout(mockPayload);

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://api.clickrr.com/v1/payouts',
      {
        amount: 100.5,
        mobileNumber: 9898989898,
        senderName: 'Trust pay',
        accountNumber: '123456789012',
        beneficiaryName: 'John Doe',
        beneficiaryIfsc: 'SBIN0001234',
        paymentPurpose: 'vendor payment',
        referenceId: 'MERCHANT_ORDER_123',
        paymentMode: 'IMPS',
        bankName: 'State Bank of India',
      },
      {
        headers: expect.objectContaining({
          Apikey: 'test-api-key',
          'Content-Type': 'application/json',
        }),
      },
    );

    expect(result).toEqual(mockResponseData);
  });

  it('should handle payload with string amount correctly', async () => {
    await initiateClickrrPayout(mockPayload);

    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        amount: 100.5,
      }),
      expect.any(Object),
    );
  });

  it('should throw error and log on API failure', async () => {
    const mockError = { response: { data: { error: 'API Error' } } };
    mockedAxios.post.mockRejectedValue(mockError);

    await expect(initiateClickrrPayout(mockPayload)).rejects.toThrow();
    expect(mockedLogger.error).toHaveBeenCalledWith(
      'Payout initiation failed:',
      { error: 'API Error' },
    );
  });
});

describe('getClickrrWalletBalance', () => {
  const mockReq = {};
  const mockRes = {};
  const mockBalanceData = { balance: 500.00 };

  beforeEach(() => {
    mockedConfig.clickrr = {
      baseUrl: 'https://api.clickrr.com',
      walletBalance: '/v1/wallet/balance',
      apiKey: 'test-api-key',
      apiSecret: 'test-api-secret',
    };
    mockedAxios.get.mockResolvedValue({ data: { data: mockBalanceData } });
    mockedSendSuccess.mockClear();
    mockedLogger.error.mockClear();
  });

  it('should fetch wallet balance successfully', async () => {
    await getClickrrWalletBalance(mockReq, mockRes);

    expect(mockedAxios.get).toHaveBeenCalledWith(
      'https://api.clickrr.com/v1/wallet/balance',
      {
        headers: expect.objectContaining({
          Apikey: 'test-api-key',
          'Content-Type': 'application/json',
        }),
      },
    );

    expect(mockedSendSuccess).toHaveBeenCalledWith(
      mockRes,
      mockBalanceData,
      'clickrr wallet balance fetched successfully',
    );
  });

  it('should throw error and log on API failure', async () => {
    const mockError = { response: { data: { error: 'Balance Fetch Error' } } };
    mockedAxios.get.mockRejectedValue(mockError);

    await expect(getClickrrWalletBalance(mockReq, mockRes)).rejects.toThrow();
    expect(mockedLogger.error).toHaveBeenCalledWith(
      'Error fetching Clickrr payout status:',
      { error: 'Balance Fetch Error' },
    );
  });
});
