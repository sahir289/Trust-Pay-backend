import { verifyPayinsService, assignedBankToPayInUrlService, getPayInUrlService } from './payInService.js';
import { updatePayInUrlDao, getPayInUrlDao } from './payInDao.js';
import { getMerchantsDao } from '../merchants/merchantDao.js';
import { getMerchantBankDao , getBankaccountDao } from '../bankAccounts/bankaccountDao.js';
import { logger } from '../../utils/logger.js';
import { InternalServerError } from '../../utils/appErrors.js';

jest.mock('./payInService.js', () => ({
  verifyPayinsService: jest.requireActual('./payInService.js').verifyPayinsService,
  assignedBankToPayInUrlService: jest.requireActual('./payInService.js').assignedBankToPayInUrlService,
  getPayInUrlService: jest.fn(),
  checkLockEdit: jest.fn(),
  updateCalculationTable : jest.fn(),
   processPayInService: jest.requireActual('./payInService.js').processPayInService,

}));

// jest.mock('./payInService.js', () => ({
//   getPayInUrlService: jest.fn(),
// }));

jest.mock('./payInDao.js', () => ({
  updatePayInUrlDao: jest.fn(),
  getPayInUrlDao: jest.fn(),
  getPayInUrlsDao: jest.fn(),
}));

jest.mock('../merchants/merchantDao.js', () => ({
  getMerchantsDao: jest.fn(),
}));

jest.mock('../bankAccounts/bankaccountDao.js', () => ({
  getMerchantBankDao: jest.fn(),
  getBankaccountDao: jest.fn()
}));

jest.mock('../bankResponse/bankResponseDao.js', () => ({
  getBankResponseDao: jest.fn(),
  updateBotResponseDao: jest.fn(),
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

  test('should throw InternalServerError if updatePayInUrlDao returns null', async () => {
    getPayInUrlService.mockResolvedValue({
      id: 'payin1',
      merchant_id: 'merchant1',
      one_time_used: false,
      config: { urls: { return: 'http://return.url' } },
      amount: 100,
      expiration_date: '2025-12-31',
      status: 'active',
    });
    getMerchantsDao.mockResolvedValue([mockMerchant]);
    updatePayInUrlDao.mockResolvedValue(null);
    jest.spyOn(global.Set.prototype, 'has').mockReturnValue(false);
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


//--------------------------------ASSINGED--------------------------------------------------------------

describe('assignedBankToPayInUrlService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should handle PayIn with ASSIGNED status when type is banktransfer', async () => {
    jest.mock('./payInService.js', () => ({
      BankTypes: {
        BANK_TRANSFER: 'BANK_TRANSFER',
        UPI: 'UPI',
        PHONE_PE: 'PHONE_PE',
        INTENT: 'INTENT',
      },
    }));

    getPayInUrlDao.mockResolvedValue({
      ...mockPayIn,
      status: 'ASSIGNED',
      bank_acc_id: 'bank1',
      company_id: 'company1',
    });

    getBankaccountDao.mockResolvedValue([
      {
        id: '8765432567876',
        company_id: '98765457679087',
        nick_name: 'Bank1',
        acc_holder_name: 'Holder',
        acc_no: '123456',
        ifsc: 'IFSC123',
      },
    ]);

    const result = await assignedBankToPayInUrlService('123', 1000, 'bank_transfer');
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

  test('should handle PayIn with ASSIGNED status when type is not banktransfer', async () => {
    jest.mock('./payInService.js', () => ({
      BankTypes: {
        BANK_TRANSFER: 'bank_transfer',
        UPI: 'upi',
        PHONE_PE: 'phone_pe',
        INTENT: 'intent',
      },
    }));

    getPayInUrlDao.mockResolvedValue({
      ...mockPayIn,
      status: 'ASSIGNED',
      bank_acc_id: 'bank1',
      company_id: 'company1',
      upi_short_code: 'UPI123'
    });

    getBankaccountDao.mockResolvedValue([
      {
        id: '8765432567876',
        company_id: '98765457679087',
        upi_id: '54321@gfds',
        acc_holder_name: 'Holder',
        code: 'UPI123',
      },
    ]);

    const result = await assignedBankToPayInUrlService('123', 1000, 'upi');
    expect(result).toEqual({
      return: mockPayIn.config.urls.return,
      bank: {
        upi_id: '54321@gfds',
        acc_holder_name: 'Holder',
        code: 'UPI123',
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


