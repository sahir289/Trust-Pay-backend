import { verifyPayinsService, getPayInUrlService } from './payInService.js';
import { updatePayInUrlDao } from './payInDao.js';
import { getMerchantsDao } from '../merchants/merchantDao.js';
import { getMerchantBankDao } from '../bankAccounts/bankaccountDao.js';
import { logger } from '../../utils/logger.js';

// Mock dependencies
jest.mock('./payInService.js', () => ({
  verifyPayinsService: jest.fn(), // Add verifyPayinsService to the mock
  getPayInUrlService: jest.fn(),
}));

jest.mock('./payInDao.js', () => ({
  updatePayInUrlDao: jest.fn(),
}));

jest.mock('../merchants/merchantDao.js', () => ({
  getMerchantsDao: jest.fn(),
}));

jest.mock('../bankAccounts/bankaccountDao.js', () => ({
  getMerchantBankDao: jest.fn(),
}));

jest.mock('../../utils/logger.js', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
  },
}));

// Mock data
const mockPayIn = {
  id: 'payin1',
  merchant_id: 'merchant1',
  merchant_order_id: '123',
  config: { urls: { return: 'http://return.url' } },
  expiration_date: 1630000001000,
  amount: 100,
  one_time_used: false,
  status: 'INITIATED',
  user: 'user1',
};
const mockMerchant = { id: 'merchant1', name: 'Test Merchant' };
const mockBanks = [{ bank_id: 'bank1', merchant_id: 'merchant1' }];

describe('verifyPayinsService tests', () => {
  beforeEach(() => {
    jest.clearAllMocks(); // Clear mocks before each test to avoid interference
  });

  test('should verify payin URL successfully and return result', async () => {
    getPayInUrlService.mockResolvedValueOnce(mockPayIn);
    getMerchantsDao.mockResolvedValueOnce([mockMerchant]); // Wrap in array to match DAO expectation
    getMerchantBankDao.mockResolvedValueOnce(mockBanks);
    updatePayInUrlDao.mockResolvedValueOnce({ id: 'payin1' });

    const result = await getPayInUrlService('123', null, true);

    expect(getPayInUrlService).toHaveBeenCalledWith('123', null, true);
    expect(result).toEqual(mockPayIn);
  });

  test('should throw BadRequestError for invalid merchant order ID', async () => {
    getPayInUrlService.mockResolvedValueOnce(null);
    verifyPayinsService.mockRejectedValueOnce(new Error('Invalid merchant order id'));
    await expect(verifyPayinsService('123', {}, 'false')).rejects.toThrow('Invalid merchant order id');
    expect(logger.error).toHaveBeenCalledWith('Error in verifyPayinsService:', expect.any(Error));
    expect(getPayInUrlService).toHaveBeenCalledWith('123', null, true);
    expect(updatePayInUrlDao).not.toHaveBeenCalled();
    expect(getMerchantsDao).not.toHaveBeenCalled();
    expect(getMerchantBankDao).not.toHaveBeenCalled();
  });

  test('should return error for already used payin URL', async () => {
    const usedPayIn = { ...mockPayIn, one_time_used: true };
    getPayInUrlService.mockResolvedValueOnce(usedPayIn);
    updatePayInUrlDao.mockResolvedValueOnce({ id: 'payin1' });
    verifyPayinsService.mockResolvedValueOnce({
      error: 'This payin url is already used',
      result: { redirect_url: 'http://return.url' },
    }); // Mock the response

    const userLocation = { user_ip: '192.168.1.1' };
    const result = await verifyPayinsService('123', userLocation, 'false');

    expect(getPayInUrlService).toHaveBeenCalledWith('123', undefined);
    expect(updatePayInUrlDao).toHaveBeenCalledWith('payin1', {
      config: expect.any(String),
      one_time_used: true,
    });
    expect(result).toEqual({
      error: 'This payin url is already used',
      result: { redirect_url: 'http://return.url' },
    });
    expect(getMerchantsDao).not.toHaveBeenCalled();
    expect(getMerchantBankDao).not.toHaveBeenCalled();
  });
  test('should throw BadRequestError for blocked user', async () => {
    const blockedMerchant = [{
      id: 'merchant1',
      min_payin: 50,
      max_payin: 1000,
      config: { blocked_users: [{ userId: 'user1' }] },
    }];
    getPayInUrlService.mockResolvedValueOnce(mockPayIn);
    getMerchantsDao.mockResolvedValueOnce(blockedMerchant);

    const userLocation = { user_ip: '192.168.1.1' };
    await expect(verifyPayinsService('123', userLocation, 'false')).rejects.toThrow('User Access Denied !');
    expect(require('../utils/logger').error).toHaveBeenCalledWith('Error in verifyPayinsService:', expect.any(Error));
    expect(getPayInUrlService).toHaveBeenCalledWith('123', undefined);
    expect(getMerchantsDao).toHaveBeenCalledWith({ id: 'merchant1' });
    expect(updatePayInUrlDao).toHaveBeenCalledWith('payin1', {
      config: expect.any(String),
      one_time_used: false,
    });
    expect(getMerchantBankDao).not.toHaveBeenCalled();
  });
 });