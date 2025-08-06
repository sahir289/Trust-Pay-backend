import { verifyPayinsService, getPayInUrlService } from './payInService.js';
import { updatePayInUrlDao, getPayInUrlDao } from './payInDao.js';
import { getMerchantsDao } from '../merchants/merchantDao.js';
import { getMerchantBankDao } from '../bankAccounts/bankaccountDao.js';
import { logger } from '../../utils/logger.js';
import { BadRequestError, InternalServerError, NotFoundError } from '../../utils/errors.js';

// Mock dependencies
jest.mock('./payInService.js', () => ({
  verifyPayinsService: jest.requireActual('./payInService.js').verifyPayinsService, 
  getPayInUrlService: jest.fn(),
}));

jest.mock('./payInDao.js', () => ({
  updatePayInUrlDao: jest.fn(),
  getPayInUrlDao: jest.fn(), // Mock getPayInUrlDao
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
const mockMerchant = {
  id: 'merchant1',
  name: 'Test Merchant',
  min_payin: 50,
  max_payin: 1000,
  config: { blocked_users: [] },
};
const mockBanks = [
  {
    bank_id: 'bank1',
    merchant_id: 'merchant1',
    bank_used_for: 'PayIn',
    is_enabled: true,
    is_qr: true,
    is_bank: false,
    config: { is_phonepay: false, is_intent: false },
  },
];

describe('verifyPayinsService tests', () => {
  beforeEach(() => {
    jest.clearAllMocks(); // Clear mocks before each test
  });

  test('should verify payin URL successfully and return result', async () => {
    getPayInUrlService.mockResolvedValue(mockPayIn);
    getMerchantsDao.mockResolvedValue([mockMerchant]);
    getMerchantBankDao.mockResolvedValue(mockBanks);
    updatePayInUrlDao.mockResolvedValue({ id: 'payin1' });
    const userLocation = { user_ip: '192.168.1.1' };
    const result = await verifyPayinsService('123', userLocation, 'false');
    expect(getPayInUrlService).toHaveBeenCalledWith('123');
    expect(getMerchantsDao).toHaveBeenCalledWith({ id: 'merchant1' });
    expect(getMerchantBankDao).toHaveBeenCalledWith({ config_merchants_contains: 'merchant1' });
    expect(updatePayInUrlDao).toHaveBeenCalledWith('payin1', {
      config: expect.any(String),
      one_time_used: false,
    });
    expect(result).toEqual({
      expiryTime: mockPayIn.expiration_date,
      amount: mockPayIn.amount,
      one_time_used: mockPayIn.one_time_used,
      status: mockPayIn.status,
      min_amount: mockMerchant.min_payin,
      max_amount: mockMerchant.max_payin,
      is_qr: true,
      is_phonepay: false,
      is_bank: false,
      redirect_url: mockPayIn.config.urls.return,
    });
    expect(logger.info).toHaveBeenCalledWith('PayIn URL verified successfully:', expect.any(Object));
  });

  test('should throw NotFoundError for invalid merchant order ID', async () => {
    getPayInUrlService.mockRejectedValue(new NotFoundError('Payment Url is incorrect'));

    const userLocation = { user_ip: '192.168.1.1' };
    await expect(verifyPayinsService('123', userLocation, 'false')).rejects.toThrow(NotFoundError);
    expect(logger.error).toHaveBeenCalledWith('Error in verifyPayinsService:', expect.any(NotFoundError));
    expect(getPayInUrlService).toHaveBeenCalledWith('123');
    expect(updatePayInUrlDao).not.toHaveBeenCalled();
    expect(getMerchantsDao).not.toHaveBeenCalled();
    expect(getMerchantBankDao).not.toHaveBeenCalled();
  });

  test('should return error for already used payin URL', async () => {
    const usedPayIn = { ...mockPayIn, one_time_used: true };
    getPayInUrlService.mockResolvedValue(usedPayIn);
    updatePayInUrlDao.mockResolvedValue({ id: 'payin1' });

    const userLocation = { user_ip: '192.168.1.1' };
    const result = await verifyPayinsService('123', userLocation, 'false');

    expect(getPayInUrlService).toHaveBeenCalledWith('123');
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
    const blockedMerchant = {
      id: 'merchant1',
      min_payin: 50,
      max_payin: 1000,
      config: { blocked_users: [{ userId: 'user1' }] },
    };
    getPayInUrlService.mockResolvedValue(mockPayIn);
    getMerchantsDao.mockResolvedValue([blockedMerchant]);
    updatePayInUrlDao.mockResolvedValue({ id: 'payin1' });

    const userLocation = { user_ip: '192.168.1.1' };
    await expect(verifyPayinsService('123', userLocation, 'false')).rejects.toThrow(BadRequestError);
    expect(logger.error).toHaveBeenCalledWith('Error in verifyPayinsService:', expect.any(BadRequestError));
    expect(getPayInUrlService).toHaveBeenCalledWith('123');
    expect(getMerchantsDao).toHaveBeenCalledWith({ id: 'merchant1' });
    expect(updatePayInUrlDao).toHaveBeenCalledWith('payin1', {
      config: expect.any(String),
      one_time_used: false,
    });
    expect(getMerchantBankDao).not.toHaveBeenCalled();
  });

  test('should throw BadRequestError for blocked IP', async () => {
    const blockedMerchant = {
      id: 'merchant1',
      min_payin: 50,
      max_payin: 1000,
      config: { blocked_users: [{ user_ip: '192.168.1.1' }] },
    };
    getPayInUrlService.mockResolvedValue(mockPayIn);
    getMerchantsDao.mockResolvedValue([blockedMerchant]);
    updatePayInUrlDao.mockResolvedValue({ id: 'payin1' });

    const userLocation = { user_ip: '192.168.1.1' };
    await expect(verifyPayinsService('123', userLocation, 'false')).rejects.toThrow(BadRequestError);
    expect(logger.error).toHaveBeenCalledWith('Error in verifyPayinsService:', expect.any(BadRequestError));
    expect(getPayInUrlService).toHaveBeenCalledWith('123');
    expect(getMerchantsDao).toHaveBeenCalledWith({ id: 'merchant1' });
    expect(updatePayInUrlDao).toHaveBeenCalledWith('payin1', {
      config: expect.any(String),
      one_time_used: false,
    });
    expect(getMerchantBankDao).not.toHaveBeenCalled();
  });

  test('should throw InternalServerError when updatePayInUrlDao fails', async () => {
    getPayInUrlService.mockResolvedValue(mockPayIn);
    getMerchantsDao.mockResolvedValue([mockMerchant]);
    updatePayInUrlDao.mockResolvedValue(null);

    const userLocation = { user_ip: '192.168.1.1' };
    await expect(verifyPayinsService('123', userLocation, 'false')).rejects.toThrow(InternalServerError);
    expect(logger.error).toHaveBeenCalledWith('Error in verifyPayinsService:', expect.any(InternalServerError));
    expect(getPayInUrlService).toHaveBeenCalledWith('123');
    expect(getMerchantsDao).toHaveBeenCalledWith({ id: 'merchant1' });
    expect(updatePayInUrlDao).toHaveBeenCalledWith('payin1', {
      config: expect.any(String),
      one_time_used: false,
    });
    expect(getMerchantBankDao).not.toHaveBeenCalled();
  });

  test('should handle oneTimeUsed parameter as true', async () => {
    getPayInUrlService.mockResolvedValue(mockPayIn);
    getMerchantsDao.mockResolvedValue([mockMerchant]);
    updatePayInUrlDao.mockResolvedValue({ id: 'payin1', one_time_used: true });

    const userLocation = { user_ip: '192.168.1.1' };
    const result = await verifyPayinsService('123', userLocation, 'true');

    expect(getPayInUrlService).toHaveBeenCalledWith('123');
    expect(getMerchantsDao).toHaveBeenCalledWith({ id: 'merchant1' });
    expect(updatePayInUrlDao).toHaveBeenCalledWith('payin1', {
      config: expect.any(String),
      one_time_used: true,
    });
    expect(result).toEqual({
      error: 'This payin url is already used',
      result: { redirect_url: 'http://return.url' },
    });
    expect(getMerchantBankDao).not.toHaveBeenCalled();
  });

  test('should add merchantOrderId to usedTokens', async () => {
    getPayInUrlService.mockResolvedValue(mockPayIn);
    getMerchantsDao.mockResolvedValue([mockMerchant]);
    getMerchantBankDao.mockResolvedValue(mockBanks);
    updatePayInUrlDao.mockResolvedValue({ id: 'payin1' });

    const userLocation = { user_ip: '192.168.1.1' };
    await verifyPayinsService('123', userLocation, 'false');

    expect(getPayInUrlService).toHaveBeenCalledWith('123');
    expect(getMerchantsDao).toHaveBeenCalledWith({ id: 'merchant1' });
    expect(getMerchantBankDao).toHaveBeenCalledWith({ config_merchants_contains: 'merchant1' });
    expect(updatePayInUrlDao).toHaveBeenCalledWith('payin1', {
      config: expect.any(String),
      one_time_used: false,
    });
    expect(logger.info).toHaveBeenCalledWith('PayIn URL verified successfully:', expect.objectContaining({ merchantOrderId: '123' }));
  });
});