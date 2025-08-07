import { verifyPayinsService, getPayInUrlService, assignedBankToPayInUrlService, checkIsPayInExpired } from './payInService.js';
import { updatePayInUrlDao, getPayInUrlDao } from './payInDao.js';
import { getMerchantsDao } from '../merchants/merchantDao.js';
import { getMerchantBankDao , getBankaccountDao } from '../bankAccounts/bankaccountDao.js';
import { logger } from '../../utils/logger.js';
import { BadRequestError, InternalServerError, NotFoundError } from '../../utils/appErrors.js';

// Mock dependencies
jest.mock('./payInService.js', () => ({
  verifyPayinsService: jest.requireActual('./payInService.js').verifyPayinsService,
  assignedBankToPayInUrlService: jest.requireActual('./payInService.js').assignedBankToPayInUrlService,
  getPayInUrlService: jest.fn(),
}));

// jest.mock('./payInService.js', () => ({
//   getPayInUrlService: jest.fn(),
// }));

jest.mock('./payInDao.js', () => ({
  updatePayInUrlDao: jest.fn(),
  getPayInUrlDao: jest.fn(),
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

const mockPayIn = {
  id: 'b23366d457dc6e5cabda35d9fce6cc449eff5a47a98e36bc37486c55197632fd',
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

describe('verifyPayinsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should verify payin URL successfully and return result', async () => {
    getMerchantsDao.mockResolvedValue([mockMerchant]);
    getMerchantBankDao.mockResolvedValue(mockBanks);
    updatePayInUrlDao.mockResolvedValue({ id: mockPayIn.id });
    getPayInUrlDao.mockResolvedValue(mockPayIn);

    const userLocation = { user_ip: '192.168.1.1' };
    const result = await verifyPayinsService('123', userLocation, 'false');

    expect(getPayInUrlDao).toHaveBeenCalledWith({"merchant_order_id": "123"});
    expect(getMerchantsDao).toHaveBeenCalledWith({ id: 'merchant1' });
    expect(getMerchantBankDao).toHaveBeenCalledWith({ config_merchants_contains: 'merchant1' });
    expect(updatePayInUrlDao).toHaveBeenCalledWith(mockPayIn.id, {
      config: JSON.stringify({
        urls: mockPayIn.config.urls,
        user: userLocation,
      }),
      one_time_used: 'false',
    });
    expect(result).toEqual({
      expiryTime: mockPayIn.expiration_date,
      amount: mockPayIn.amount,
      one_time_used: false,
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

  test('should return error for already used payin URL', async () => {
    const mockPayIn = {
      id: 'b23366d457dc6e5cabda35d9fce6cc449eff5a47a98e36bc37486c55197632fd',
      merchant_id: 'merchant1',
      one_time_used: true, 
      config: { urls: { return: 'http://return.url' } },
    };
    getPayInUrlService.mockResolvedValue(mockPayIn);
  
    updatePayInUrlDao.mockResolvedValue({ id: mockPayIn.id });
  
    const userLocation = { user_ip: '192.168.1.1' };
  
    const result = await verifyPayinsService('123', userLocation, 'false');
    expect(result).toEqual({
      error: 'This payin url is already used',
      result: { redirect_url: 'http://return.url' },
    });
  
    expect(updatePayInUrlDao).toHaveBeenCalledWith(mockPayIn.id, {
      config: expect.any(String), 
      one_time_used: true,
    });
  
    expect(getMerchantsDao).not.toHaveBeenCalled();
    expect(getMerchantBankDao).not.toHaveBeenCalled();
  
    expect(logger.error).not.toHaveBeenCalled();
  });

  test('should return error for already used payin URL', async () => {
    const usedPayIn = { ...mockPayIn, one_time_used: true };
    getPayInUrlService.mockResolvedValue(usedPayIn);
    updatePayInUrlDao.mockResolvedValue({ id: usedPayIn.id });

    const result = await verifyPayinsService('123', { user_ip: '192.168.1.1' }, 'false');

    expect(updatePayInUrlDao).toHaveBeenCalledWith(usedPayIn.id, {
      config: expect.any(String),
      one_time_used: true,
    });
    expect(result).toEqual({
      error: 'This payin url is already used',
      result: { redirect_url: mockPayIn.config.urls.return },
    });
  });

  test('should throw BadRequestError for blocked IP', async () => {
    const blockedMerchant = {
      ...mockMerchant,
      config: { blocked_users: [{ user_ip: '192.168.1.1' }] },
    };
    getPayInUrlService.mockResolvedValue(mockPayIn);
    getMerchantsDao.mockResolvedValue(blockedMerchant.config.blocked_users);
    console.log(blockedMerchant.config.blocked_users, 'blocked____users')
    updatePayInUrlDao.mockResolvedValue({ id: mockPayIn.id });
    await expect(verifyPayinsService('123', [{ user_ip: '192.168.1.1' }], false)).rejects.toThrow(BadRequestError);
  });

  test('should throw InternalServerError if updatePayInUrlDao returns null', async () => {
    getPayInUrlService.mockResolvedValue(mockPayIn);
    getMerchantsDao.mockResolvedValue([mockMerchant]);
    updatePayInUrlDao.mockResolvedValue(null);

    await expect(verifyPayinsService('123', { user_ip: '192.168.1.1' }, 'false')).rejects.toThrow(InternalServerError);
  });

  test('should handle oneTimeUsed as true string', async () => {
    getPayInUrlService.mockResolvedValue(mockPayIn);
    getMerchantsDao.mockResolvedValue([mockMerchant]);
    updatePayInUrlDao.mockResolvedValue({ id: mockPayIn.id, one_time_used: true });

    const result = await verifyPayinsService('123', { user_ip: '192.168.1.1' }, 'true');

    expect(updatePayInUrlDao).toHaveBeenCalledWith(mockPayIn.id, {
      config: expect.any(String),
      one_time_used: true,
    });
    expect(result).toEqual({
      error: 'This payin url is already used',
      result: { redirect_url: mockPayIn.config.urls.return },
    });
  });

});


describe('assignedBankToPayInUrlService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should handle PayIn with ASSIGNED status', async () => {
    getPayInUrlDao.mockResolvedValue({ ...mockPayIn, status: 'ASSIGNED', bank_acc_id: 'bank1', company_id: 'company1' });
    getBankaccountDao.mockResolvedValue([{ nick_name: 'Bank1', acc_holder_name: 'Holder', acc_no: '123456', ifsc: 'IFSC123' }]);
  
    const result = await assignedBankToPayInUrlService('123', 1000, 'BANK_TRANSFER');
  
    expect(result).toEqual({
      return: mockPayIn.config.urls.return,
      bank: {
        nick_name: 'Bank1',
        acc_holder_name: 'Holder',
        acc_no: '123456',
        ifsc: 'IFSC123',
      },
    });
  });
  
  test('should throw error for invalid amount', async () => {
    getPayInUrlDao.mockResolvedValue(mockPayIn);
    getMerchantsDao.mockResolvedValue([{ ...mockMerchant, min_payin: 5000, max_payin: 10000 }]);
  
    await expect(assignedBankToPayInUrlService('123', 1000, 'BANK_TRANSFER')).resolves.toEqual({
      message: 'Amount must be between 5000 and 10000',
    });
  });
  
  test('should throw error when no enabled banks found', async () => {
    getPayInUrlDao.mockResolvedValue(mockPayIn);
    getMerchantsDao.mockResolvedValue([mockMerchant]);
    getMerchantBankDao.mockResolvedValue([]);
    updatePayInUrlDao.mockResolvedValue({ id: mockPayIn.id });
  
    await expect(assignedBankToPayInUrlService('123', 1000, 'BANK_TRANSFER')).rejects.toThrow('No enabled bank found!');
  });
});