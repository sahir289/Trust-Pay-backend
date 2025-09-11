jest.mock('../../utils/sockets.js', () => ({
  newTableEntry: jest.fn().mockResolvedValue(), // Mock newTableEntry globally
}));

import { verifyPayinsService, assignedBankToPayInUrlService } from './payInService.js';
import * as payInService from './payInService.js';
import { getMerchantsDao, getMerchantsByCodeDao } from '../merchants/merchantDao.js';
import { getMerchantBankDao, getBankaccountDao } from '../bankAccounts/bankaccountDao.js';
import { getBankResponseDao, updateBotResponseDao } from '../bankResponse/bankResponseDao.js';
import { getCalculationforCronDao } from '../calculation/calculationDao.js';
import { getVendorsDao } from '../vendors/vendorDao.js';
import { generatePayInUrlDao, updatePayInUrlDao, getPayInUrlsDao, getPayInForCheckDao, getPayinsForServiccDao } from './payInDao.js';
import { logger } from '../../utils/logger.js';
import { InternalServerError, BadRequestError, NotFoundError } from '../../utils/appErrors.js';
import { getImageContentFromOCr, calculateDuration } from '../../helpers/index.js';
import { calculateCommission } from '../../utils/calculation.js';
import { checkLockEdit } from '../../utils/advisoryLock.js';
import { merchantPayinCallback } from '../../callBacksAndWebHook/merchantCallBacks.js';
import { sendBankMismatchMessageTelegramBot, sendBankNotAssignedAlertTelegram } from '../../utils/sendTelegramMessages.js';
import { getCompanyByIDDao } from '../company/companyDao.js';
import { createHash } from '../../utils/bcryptPassword.js';
import { nanoid } from 'nanoid';
import { newTableEntry } from '../../utils/sockets.js';
const mockPayload = {
  userSubmittedUtr: 'UTR123456',
  merchantOrderId: 'ORDER123',
  amount: 1000,
  from_telegram: false,
  telegramMessage: { chat: { id: 'CHAT123' }, message_id: 'MSG123' },
  telegramBotToken: 'BOT_TOKEN',
  user_submitted_image: 'image.jpg',
};
const mockUpdatedBy = 'user123';
const mockPayInProcess = {
  id: 'PAYIN123',
  bank_acc_id: 'BANK123',
  company_id: 'COMPANY123',
  merchant_order_id: 'ORDER123',
  status: 'PENDING',
  one_time_used: false,
  is_url_expires: false,
  created_at: new Date('2023-01-01T00:00:00.000Z'),
  config: { urls: { notify: 'http://notify.url', return: 'http://return.url' } },
  merchant_id: 'MERCHANT123',
  amount: 1000,
};
const mockBank = {
  id: 'BANK123',
  nick_name: 'Bank1',
  user_id: 'USER123',
  company_id: 'COMPANY123',
};
const mockBankResponse = {
  id: 'BANK_RESP123',
  utr: 'UTR123456',
  amount: 1000,
  bank_id: 'BANK123',
  is_used: false,
};
const mockMerchantProcess = {
  id: 'MERCHANT123',
  user_id: 'MERCHANT_USER123',
  payin_commission: 2,
};

const mockPayIn = {
  id: 'b23366d457dc6e5cabda35d9fce6cc449eff5a47a98e36bc37486c55197632fd',
  merchant_id: 'merchant1',
  merchant_order_id: '123',
  config: { urls: { return: 'http://return.url', notify: 'http://notify.url' } },
  expiration_date: 1630000001000,
  amount: 100,
  one_time_used: false,
  status: 'INITIATED',
  user: 'user1',
  company_id: 'COMPANY123',
  bank_acc_id: 'BANK123'
};
const mockMerchant = {
  id: 'merchant1',
  name: 'Test Merchant',
  min_payin: 50,
  max_payin: 1000,
  config: { blocked_users: [] },
};

// Mock setups
jest.mock('./payInService.js', () => {
  const actual = jest.requireActual('./payInService.js');
  return {
    ...actual,
    verifyPayinsService: actual.verifyPayinsService,
    assignedBankToPayInUrlService: actual.assignedBankToPayInUrlService,
    processPayInService: actual.processPayInService,
    processPayInByImageService: actual.processPayInByImageService,
    generatePayInUrlByHashService: actual.generatePayInUrlByHashService,
    updateCalculationTable: jest.fn(),
    checkLockEdit: jest.fn(),
    getPayInUrlService: jest.fn(),
  };
});

jest.mock('../../utils/sendTelegramMessages.js', () => ({
  sendBankMismatchMessageTelegramBot: jest.fn(),
  sendDisputeMessageTelegramBot: jest.fn(),
  sendBankNotAssignedAlertTelegram: jest.fn(),
}));

jest.mock('../../helpers/index.js', () => ({
  ...jest.requireActual('../../helpers/index.js'),
  calculateDuration: jest.fn(),
  getImageContentFromOCr: jest.fn(),
}));

jest.mock('../../utils/advisoryLock.js', () => ({
  checkLockEdit: jest.fn(),
}));

jest.mock('../../utils/appErrors.js', () => {
  class InternalServerError extends Error { }
  class BadRequestError extends Error { }
  class NotFoundError extends Error { }

  return { InternalServerError, BadRequestError, NotFoundError };
});

jest.mock('../company/companyDao.js', () => ({
  getCompanyByIDDao: jest.fn(),
}));

jest.mock('dayjs', () => {
  const actual = jest.requireActual('dayjs');
  const mockDayjs = (date) => {
    const instance = actual(date);
    instance.add = (value, unit) => actual(date).add(value, unit);
    instance.toISOString = jest.fn().mockReturnValue('2025-09-08T12:00:00Z');
    return instance;
  };
  mockDayjs.extend = jest.fn();
  return mockDayjs;
});

jest.mock('../../callBacksAndWebHook/merchantCallBacks.js', () => ({
  merchantPayinCallback: jest.fn(),
}));

jest.mock('../bankResponse/bankResponseDao.js', () => ({
  getBankResponseDao: jest.fn(),
  updateBotResponseDao: jest.fn(),
}));

jest.mock('../vendors/vendorDao.js', () => ({
  getVendorsDao: jest.fn(),
}));

jest.mock('../merchants/merchantDao.js', () => ({
  getMerchantsDao: jest.fn(),
  getMerchantsByCodeDao: jest.fn(),
}));

jest.mock('../bankAccounts/bankaccountDao.js', () => ({
  getMerchantBankDao: jest.fn(),
  getBankaccountDao: jest.fn(),
}));

jest.mock('../../utils/calculation.js', () => ({
  calculateCommission: jest.fn(),
}));

jest.mock('../calculation/calculationDao.js', () => ({
  getCalculationforCronDao: jest.fn(),
  updateCalculationBalanceDao: jest.fn(),
}));

jest.mock('nanoid', () => ({
  nanoid: jest.fn(() => 'QokKC'),
}));

jest.mock('./payInDao.js', () => ({
  generatePayInUrlDao: jest.fn(),
  updatePayInUrlDao: jest.fn(),
  // getPayInUrlDao: jest.fn(),
  getPayInUrlsDao: jest.fn(),
  getPayInForCheckDao: jest.fn(),
  getPayinsForServiccDao: jest.fn(),
}));

jest.mock('../../utils/logger.js', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    log: jest.fn(),
  },
}));

jest.mock('../../utils/bcryptPassword.js', () => ({
  createHash: jest.fn(),
}));

// Global beforeEach to reset mocks
beforeEach(() => {
  jest.resetAllMocks();
});

describe('verifyPayinsService', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(global.Set.prototype, 'has').mockReturnValue(false);
    jest.spyOn(global.Set.prototype, 'add').mockImplementation(function () {
      return this;
    });
  });

  test('should verify payin URL successfully and return result', async () => {
    const mockPayIn = {
      id: 'some-id',
      merchant_id: 'merchant1',
      expiration_date: '2025-12-31',
      amount: 100,
      status: 'PENDING',
      one_time_used: false,
      config: {
        urls: {
          return: 'http://example.com/return',
        },
      },
      created_by: 'user1',
    };
    const mockMerchant = {
      id: 'merchant1',
      min_payin: 10,
      max_payin: 1000,
    };
    const mockBanks = [
      {
        bank_used_for: 'PayIn',
        is_enabled: true,
        is_qr: true,
        is_bank: false,
        config: { is_phonepay: false },
      },
    ];

    const mockConn = {
      query: jest.fn().mockResolvedValue({
        rows: [{ id: 'user1', role: 'USER' }],
        rowCount: 1,
      }),
    };

    getPayinsForServiccDao.mockImplementation(async () => {
      return mockPayIn;
    });
    getMerchantsDao.mockResolvedValue([mockMerchant]);
    getMerchantBankDao.mockResolvedValue(mockBanks);
    updatePayInUrlDao.mockResolvedValue({ id: mockPayIn.id });

    const userLocation = { user_ip: '192.168.1.1' };
    let result;
    result = await verifyPayinsService(mockConn, '123', userLocation, 'false');
    // expect(payInService.getPayInUrlService).toHaveBeenCalledWith('123', mockConn);
    expect(getPayinsForServiccDao).toHaveBeenCalledWith({ merchant_order_id: '123' });
    expect(getMerchantsDao).toHaveBeenCalledWith({ id: 'merchant1' });
    expect(getMerchantBankDao).toHaveBeenCalledWith({ config_merchants_contains: 'merchant1' });
    expect(updatePayInUrlDao).toHaveBeenCalledWith(
      mockPayIn.id,
      expect.objectContaining({
        config: expect.stringMatching(
          /"urls":\{"return":"http:\/\/example\.com\/return"\}.*"user":\{"user_ip":"192\.168\.1\.1"\}/
        ),
        one_time_used: expect.stringMatching(/false/),
      })
    );
    expect(result).toEqual({
      expiryTime: mockPayIn.expiration_date,
      isAdmin: false,
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

  test('should throw NotFoundError for invalid merchant order id', async () => {
    payInService.getPayInUrlService.mockResolvedValue(null);
    await expect(
      verifyPayinsService({}, '123', { user_ip: '192.168.1.1' }, 'false')
    ).rejects.toThrow(new NotFoundError('Payment Url is incorrect'));
  });

  test('should return error for already used payin URL', async () => {
    const usedPayIn = {
      id: 'payin1',
      merchant_id: 'merchant1',
      merchant_order_id: '123',
      one_time_used: true,
      config: { urls: { return: 'http://return.url' } },
      amount: 100,
      expiration_date: '2025-12-31',
      status: 'PENDING',
      created_by: 'user1',
    };

    // Mock database connection
    const mockConn = {
      query: jest.fn().mockResolvedValue({
        rows: [{ id: 'user1', role: 'USER' }], // Mock user data
        rowCount: 1,
      }),
    };

    // Mock DAO calls
    getPayinsForServiccDao.mockResolvedValue(usedPayIn);
    getMerchantsDao.mockResolvedValue([mockMerchant]);
    updatePayInUrlDao.mockResolvedValue({ id: usedPayIn.id });

    const userLocation = { user_ip: '192.168.1.1' };
    const result = await verifyPayinsService(mockConn, '123', userLocation, 'false');

    expect(getPayinsForServiccDao).toHaveBeenCalledWith({ merchant_order_id: '123' });
    expect(mockConn.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT'),
      ['user1']
    );
    expect(updatePayInUrlDao).toHaveBeenCalledWith(usedPayIn.id, {
      config: expect.any(String),
      one_time_used: true,
    });
    expect(result).toEqual({
      error: 'This payin url is already used',
      result: { redirect_url: usedPayIn.config.urls.return },
    });
    expect(getMerchantsDao).toHaveBeenCalledWith({ id: usedPayIn.merchant_id });
    // expect(logger.error).not.toHaveBeenCalled();
  });

  test('should throw InternalServerError if updatePayInUrlDao returns null', async () => {
    const mockMerchant = {
      id: 'merchant1',
      code: 'M123',
      min_payin: 10,
      max_payin: 1000,
    };
    getPayinsForServiccDao.mockResolvedValue({
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

    await expect(
      verifyPayinsService(null, '123', { user_ip: '192.168.1.1' }, 'false')
    ).rejects.toThrow(InternalServerError);
  });

  test('should handle oneTimeUsed as true string', async () => {
    const mockPayIn = {
      id: 'payin123',
      merchant_id: 'merchant123',
      bank_acc_id: 'bank123',
      config: { urls: { return: 'http://return.url' } },
      one_time_used: false,
      created_by: 'user123',
    };
    const mockMerchant = { id: 'merchant123', code: 'MERCH123' };
    const mockBankAccount = [{ id: 'bank123', user_id: 'user456', nick_name: 'Bank Account' }];
    const mockVendor = [{ code: 'VENDOR123' }];
  
    const mockConn = {
      query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    };
  
    getPayinsForServiccDao.mockResolvedValue(mockPayIn); // Corrected typo
    getMerchantsDao.mockResolvedValue([mockMerchant]);
    getBankaccountDao.mockResolvedValue(mockBankAccount);
    getVendorsDao.mockResolvedValue(mockVendor);
    updatePayInUrlDao.mockResolvedValue({ id: mockPayIn.id, one_time_used: true });
    jest.spyOn(global.Set.prototype, 'has').mockReturnValue(false);
  
    const result = await verifyPayinsService(
      mockConn,
      '123',
      { user_ip: '192.168.1.1' },
      'true'
    );
  
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

// assignedBankToPayInUrlService Tests
describe('assignedBankToPayInUrlService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  test('should handle PayIn with ASSIGNED status when type is banktransfer', async () => {
    // Mock the payin with ASSIGNED status
    getPayinsForServiccDao.mockResolvedValue({
      ...mockPayIn,
      status: 'ASSIGNED',
      bank_acc_id: 'bank1',
      company_id: 'company1',
    });

    // Mock bank account lookup
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

    const result = await assignedBankToPayInUrlService(
      '123',      // merchant order id
      1000,       // amount
      'bank_transfer' // type
    );

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
    const mockPayIn = {
      id: 'payin1',
      merchant_id: 'merchant1',
      one_time_used: false,
      config: { urls: { return: 'http://return.url' } },
      amount: 100,
      expiration_date: '2025-12-31',
      status: 'active',
    };
    // Mock payIn with ASSIGNED status and upi_short_code
    getPayinsForServiccDao.mockResolvedValue({
      ...mockPayIn,
      status: 'ASSIGNED',
      bank_acc_id: 'bank1',
      company_id: 'company1',
      upi_short_code: 'UPI123',
    });

    // Mock UPI bank account details
    getBankaccountDao.mockResolvedValue([
      {
        id: '8765432567876',
        company_id: '98765457679087',
        upi_id: '54321@gfds',
        acc_holder_name: 'Holder',
        code: 'UPI123',
      },
    ]);

    const result = await assignedBankToPayInUrlService(
      '123',      // merchant order id
      1000,       // amount
      'upi'       // type (not banktransfer)
    );

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
    getPayinsForServiccDao.mockResolvedValue(mockPayIn);
    getMerchantsDao.mockResolvedValue([{ ...mockMerchant, min_payin: 5000, max_payin: 10000 }]);

    await expect(
      assignedBankToPayInUrlService('123', 1000, 'BANK_TRANSFER', 'MERCHANT')
    ).resolves.toEqual({
      message: 'Amount must be between 5000 and 10000',
    });

  });

  test('should throw error when no enabled banks found', async () => {
    getPayinsForServiccDao.mockResolvedValue(mockPayIn);
    getMerchantsDao.mockResolvedValue([mockMerchant]);
    getMerchantBankDao.mockResolvedValue([]);
    updatePayInUrlDao.mockResolvedValue({ id: mockPayIn.id });

    await expect(
      assignedBankToPayInUrlService('123', 1000, 'BANK_TRANSFER')
    ).rejects.toThrow('No enabled bank found!');
  });
});

// processPayInService Tests
describe('processPayInService', () => {
  let mockConn;
  
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();

    mockConn = {
      query: jest.fn().mockImplementation(async (query) => {
        if (query.includes('pg_try_advisory_xact_lock')) {
          return { rows: [{ acquired: true }] };
        }
        return { rows: [] };
      }),
    };
    payInService.getPayInUrlService.mockResolvedValue(mockPayInProcess);
    checkLockEdit.mockResolvedValue(true);
    getBankaccountDao.mockResolvedValue([mockBank]);
    getPayInUrlsDao.mockResolvedValue([]);
    getBankResponseDao.mockResolvedValue(mockBankResponse);
    updateBotResponseDao.mockResolvedValue();
    getMerchantsDao.mockResolvedValue([mockMerchantProcess]);
    calculateCommission.mockReturnValue(20);
    payInService.updateCalculationTable.mockResolvedValue();
    updatePayInUrlDao.mockResolvedValue();
    getVendorsDao.mockResolvedValue([
      {
        user_id: mockBank.user_id,
        payin_commission: 1.5,
      },
    ]);
    getCalculationforCronDao.mockResolvedValue([
      {
        user_id: mockMerchantProcess.user_id,
        balance: 0,
        payin_commission: 20,
      },
    ]);
  });

  test('should handle duplicate payin', async () => {
    // Mock newTableEntry as a Jest function
    getPayinsForServiccDao.mockResolvedValue(mockPayInProcess);
    payInService.getPayInUrlService.mockResolvedValue(mockPayInProcess);
    getPayInForCheckDao.mockResolvedValue([mockPayInProcess]); // Simulate duplicate
    getBankaccountDao.mockResolvedValue([{ id: 'BANK123', user_id: 'USER123', nick_name: 'Bank1' }]);
    getVendorsDao.mockResolvedValue([{ id: 'VENDOR123', code: 'VENDOR_CODE' }]);
    getBankResponseDao.mockResolvedValue({}); // Empty bank response
    updatePayInUrlDao.mockResolvedValue();
    checkLockEdit.mockResolvedValue();
    merchantPayinCallback.mockImplementation(() => {});
  
    const mockPayload = {
      merchantOrderId: 'ORDER123',
      userSubmittedUtr: 'UTR123456',
      amount: 1000,
    };
  
    const result = await payInService.processPayInService(mockConn, mockPayload, mockUpdatedBy);
  
    expect(getPayInForCheckDao).toHaveBeenCalledWith({
      user_submitted_utr: mockPayload.userSubmittedUtr,
      company_id: mockPayInProcess.company_id,
    });
    expect(updatePayInUrlDao).toHaveBeenCalledWith(
      mockPayInProcess.id,
      expect.objectContaining({ status: 'DUPLICATE' }),
      mockConn
    );
    expect(newTableEntry).toHaveBeenCalledWith(
      'Payin',
      expect.objectContaining({ status: 'DUPLICATE' })
    );
    expect(merchantPayinCallback).toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({
      status: 'DUPLICATE',
      message: 'Duplicate entry found!',
    }));
  });

  test('should handle expired or used payin url', async () => {
    const expiredPayIn = {
      ...mockPayInProcess,
      one_time_used: true,
      is_url_expires: false,
      config: { urls: { return: 'http://return.url' } },
    };
  
    // Ensure all relevant mocks are set up correctly
    getPayinsForServiccDao.mockResolvedValue(expiredPayIn);
    getPayInForCheckDao.mockResolvedValue([]);
  
    const mockPayload = {
      merchantOrderId: 'ORDER123',
      amount: 100,
      userSubmittedUtr: 'UTR123',
      from_telegram: false,
      telegramMessage: null,
      telegramBotToken: null,
      user_submitted_image: null,
    };
  
    // Call the service
    const result = await payInService.processPayInService(
      mockConn,
      mockPayload,
      mockUpdatedBy,
      true
    );
    expect(getPayinsForServiccDao).toHaveBeenCalledWith({ merchant_order_id: 'ORDER123' });
    expect(result).toEqual({
      error: 'This payin url is already used',
      result: { redirect_url: expiredPayIn.config.urls.return },
    });
    expect(checkLockEdit).not.toHaveBeenCalled();
    expect(getPayInForCheckDao).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  test('should handle duplicate payin', async () => {
    const mockPayIn = {
      ...mockPayInProcess,
      id: 'PAYIN123',
      merchant_order_id: 'ORDER123',
      amount: 1000,
      user_submitted_utr: 'UTR123456',
      bank_acc_id: 'BANK123',
      company_id: 'COMPANY123',
      status: 'PENDING',
      config: { urls: { notify: 'http://notify.url' } },
      created_at: new Date().toISOString(),
    };
  
    // Mock DAOs and services
    getPayinsForServiccDao.mockResolvedValue(mockPayIn);
    payInService.getPayInUrlService.mockResolvedValue(mockPayIn);
    getPayInForCheckDao.mockResolvedValue([mockPayInProcess]); // Simulate duplicate
    getBankaccountDao.mockResolvedValue([{ id: 'BANK123', user_id: 'USER123', nick_name: 'Bank1' }]);
    getVendorsDao.mockResolvedValue([{ id: 'VENDOR123', code: 'VENDOR_CODE' }]);
    getBankResponseDao.mockResolvedValue({}); // Empty bank response
    updatePayInUrlDao.mockResolvedValue();
    newTableEntry.mockResolvedValue();
    checkLockEdit.mockResolvedValue();
    merchantPayinCallback.mockImplementation(() => {});
  
    const mockPayload = {
      merchantOrderId: 'ORDER123',
      userSubmittedUtr: 'UTR123456',
      amount: 1000,
    };
  
    const result = await payInService.processPayInService(mockConn, mockPayload, mockUpdatedBy);
  
    expect(getPayInForCheckDao).toHaveBeenCalledWith({
      user_submitted_utr: mockPayload.userSubmittedUtr,
      company_id: mockPayIn.company_id,
    });
    expect(updatePayInUrlDao).toHaveBeenCalledWith(
      mockPayInProcess.id,
      expect.objectContaining({ status: 'DUPLICATE' }),
      mockConn
    );
    expect(merchantPayinCallback).toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({
      amount: undefined,
      merchantOrderId: 'ORDER123',
      message: 'Duplicate entry found!',
      payinId: 'PAYIN123',
      req_amount: 1000,
      status: 'DUPLICATE',
      utr_id: 'UTR123456',
    }));
  });

  test('should handle bank mismatch with telegram', async () => {
    const mockPayIn = {
      id: 'PAYIN123',
      merchant_order_id: 'ORDER123',
      amount: 1000,
      user_submitted_utr: 'UTR123456',
      bank_acc_id: 'BANK123',
      company_id: 'COMPANY123',
      status: 'PENDING',
      config: { urls: { notify: 'http://notify.url', return: 'http://return.url' } },
      created_at: new Date().toISOString(),
    };

    const mockPayload = {
      merchantOrderId: 'ORDER123',
      userSubmittedUtr: 'UTR123456',
      amount: 1000,
      from_telegram: true,
      telegramMessage: { chat: { id: 'CHAT123' }, message_id: 'MSG123' },
      telegramBotToken: 'TOKEN123',
    };

    // Mock dependencies
    getPayinsForServiccDao.mockResolvedValue(mockPayIn);
    payInService.getPayInUrlService.mockResolvedValue(mockPayIn);
    getPayInForCheckDao.mockResolvedValue([]); // No duplicates
    getBankaccountDao
      .mockResolvedValueOnce([{ id: 'BANK123', user_id: 'USER123', nick_name: 'Bank1', config: { is_freeze: false } }])
      .mockResolvedValueOnce([{ id: 'BANK456', user_id: 'USER456', nick_name: 'Bank2', config: { is_freeze: false } }]);
    getVendorsDao.mockResolvedValue([{ id: 'VENDOR123', code: 'VENDOR_CODE' }]);
    getBankResponseDao.mockResolvedValue({ id: 'RESPONSE123', bank_id: 'BANK456', utr: 'UTR123456', amount: 1000 });
    updatePayInUrlDao.mockResolvedValue();
    checkLockEdit.mockResolvedValue();
    merchantPayinCallback.mockImplementation(() => {});
    sendBankMismatchMessageTelegramBot.mockResolvedValue();

    const result = await payInService.processPayInService(mockConn, mockPayload, mockUpdatedBy);

    // Assertions
    expect(getPayInForCheckDao).toHaveBeenCalledWith({
      user_submitted_utr: mockPayload.userSubmittedUtr,
      company_id: mockPayIn.company_id,
    });
    expect(updatePayInUrlDao).toHaveBeenCalledWith(
      mockPayIn.id,
      expect.objectContaining({ status: 'BANK_MISMATCH' }),
      mockConn
    );
    expect(newTableEntry).toHaveBeenCalledTimes(2);
    expect(newTableEntry).toHaveBeenCalledWith(
      'Payin',
      expect.objectContaining({ status: 'BANK_MISMATCH' })
    );
    expect(newTableEntry).toHaveBeenCalledWith(
      'BankResponse',
      expect.objectContaining({ id: 'RESPONSE123', data: expect.any(Object) })
    );
    expect(sendBankMismatchMessageTelegramBot).toHaveBeenCalledWith(
      mockPayload.telegramMessage.chat.id,
      'Bank1',
      'Bank1',
      mockPayload.telegramBotToken,
      mockPayload.telegramMessage.message_id
    );
    expect(merchantPayinCallback).toHaveBeenCalled();
    expect(result).toEqual(true);
  });

  test('should throw NotFoundError when bank not found', async () => {
    getPayinsForServiccDao.mockResolvedValue(mockPayIn);
    getBankaccountDao.mockResolvedValue([]);

    await expect(
      payInService.processPayInService(mockConn, mockPayload, mockUpdatedBy)
    ).rejects.toThrow(NotFoundError);

    expect(getBankaccountDao).toHaveBeenCalledWith({
      id: mockPayInProcess.bank_acc_id,
      company_id: mockPayInProcess.company_id,
    });
  });

  test('should throw NotFoundError if bank is missing', async () => {
    const payload = {
      ...mockPayload,
      from_telegram: false,
    };
    const mockVendor = {
      id: 'vendor_123',
      user_id: 'user_456',
      first_name: 'John',
      last_name: 'Doe',
      code: 'VENDOR001',
      payin_commission: 2.5, // Example commission percentage
      payout_commission: 1.5,
      created_at: '2025-01-01T10:00:00Z',
      updated_at: '2025-09-01T12:00:00Z',
      config: {}, // Config object, can be customized if needed
      full_name: 'John Doe',
      designation_name: 'VENDOR',
      balance: 1000.0, // Example balance
    };
  
    getPayinsForServiccDao.mockResolvedValue(mockPayIn);
    payInService.getPayInUrlService.mockResolvedValue(mockPayInProcess);
    getPayInForCheckDao.mockResolvedValue([]);
    getBankaccountDao.mockResolvedValue([]); // No bank found
    getVendorsDao.mockResolvedValue([mockVendor]);
  
    await expect(
      payInService.processPayInService(mockConn, payload, mockUpdatedBy)
    ).rejects.toThrow(NotFoundError);
  });

  test('should throw BadRequestError for missing telegram parameters', async () => {
    const invalidPayload = {
      ...mockPayload,
      from_telegram: true,
      telegramBotToken: null,
      telegramMessage: null,
    };
    const mockVendor = {
      id: 'vendor_123',
      user_id: 'user_456',
      first_name: 'John',
      last_name: 'Doe',
      code: 'VENDOR001',
      payin_commission: 2.5, // Example commission percentage
      payout_commission: 1.5,
      created_at: '2025-01-01T10:00:00Z',
      updated_at: '2025-09-01T12:00:00Z',
      config: {}, // Config object, can be customized if needed
      full_name: 'John Doe',
      designation_name: 'VENDOR',
      balance: 1000.0, // Example balance
    };
  
    // Mock dependencies
    getPayinsForServiccDao.mockResolvedValue(mockPayIn);
    payInService.getPayInUrlService.mockResolvedValue(mockPayInProcess);
    getPayInForCheckDao.mockResolvedValue([]);
    getBankaccountDao.mockResolvedValue([{ ...mockPayIn.bank_acc_id, config: { is_freeze: false } }]); // Mock bank with config
    getVendorsDao.mockResolvedValue([mockVendor]);
  
    await expect(
      payInService.processPayInService(mockConn, invalidPayload, mockUpdatedBy)
    ).rejects.toThrow(BadRequestError);
  });

  test('should process successfully when designation is ADMIN and bank is frozen', async () => {
    const mockPayIn = {
      ...mockPayInProcess,
      status: 'PENDING',
      bank_acc_id: 'BANK123',
      company_id: 'COMPANY123',
    };
    const mockPayload = {
      merchantOrderId: 'ORDER123',
      userSubmittedUtr: 'UTR123456',
      amount: 1000,
      from_telegram: false,
    };
    const mockBankFrozen = {
      ...mockBank,
      config: { is_freeze: true },
    };

    getPayinsForServiccDao.mockResolvedValue(mockPayIn);
    payInService.getPayInUrlService.mockResolvedValue(mockPayIn);
    getPayInForCheckDao.mockResolvedValue([]); // No duplicates
    getBankaccountDao.mockResolvedValue([mockBankFrozen]);
    getBankResponseDao.mockResolvedValue({ id: 'RESPONSE123', bank_id: 'BANK123', utr: 'UTR123456', amount: 1000 });
    updatePayInUrlDao.mockResolvedValue();
    merchantPayinCallback.mockImplementation(() => {});

    const result = await payInService.processPayInService(mockConn, mockPayload, mockUpdatedBy, true, false, 'ADMIN');

    expect(updatePayInUrlDao).toHaveBeenCalledWith(
      mockPayIn.id,
      expect.objectContaining({ status: 'SUCCESS' }),
      mockConn
    );
    expect(result).toEqual(expect.objectContaining({
      status: 'SUCCESS',
      merchantOrderId: 'ORDER123',
      payinId: 'PAYIN123',
      amount: 1000,
      req_amount: 1000,
      utr_id: 'UTR123456',
    }));
    expect(merchantPayinCallback).toHaveBeenCalled();
  });

  test('should throw error when designation is not ADMIN and bank is frozen', async () => {
    const mockPayIn = {
      ...mockPayInProcess,
      status: 'PENDING',
      bank_acc_id: 'BANK123',
      company_id: 'COMPANY123',
    };
    const mockPayload = {
      merchantOrderId: 'ORDER123',
      userSubmittedUtr: 'UTR123456',
      amount: 1000,
      from_telegram: false,
    };
    const mockBankFrozen = {
      ...mockBank,
      config: { is_freeze: true },
    };

    getPayinsForServiccDao.mockResolvedValue(mockPayIn);
    payInService.getPayInUrlService.mockResolvedValue(mockPayIn);
    getPayInForCheckDao.mockResolvedValue([]); // No duplicates
    getBankaccountDao.mockResolvedValue([mockBankFrozen]);

    await expect(
      payInService.processPayInService(mockConn, mockPayload, mockUpdatedBy, true, false, 'USER')
    ).resolves.toEqual({
      message: 'Bank Account is freezed. Please contact admin',
    });

    expect(getBankaccountDao).toHaveBeenCalledWith({
      id: mockPayIn.bank_acc_id,
      company_id: mockPayIn.company_id,
    });
    expect(updatePayInUrlDao).not.toHaveBeenCalled();
  });

  test('should do nothing when designation is not provided and bank is frozen', async () => {
    const mockPayIn = {
      ...mockPayInProcess,
      status: 'PENDING',
      bank_acc_id: 'BANK123',
      company_id: 'COMPANY123',
    };
    const mockPayload = {
      merchantOrderId: 'ORDER123',
      userSubmittedUtr: 'UTR123456',
      amount: 1000,
      from_telegram: false,
    };
    const mockBankFrozen = {
      ...mockBank,
      config: { is_freeze: true },
    };

    getPayinsForServiccDao.mockResolvedValue(mockPayIn);
    payInService.getPayInUrlService.mockResolvedValue(mockPayIn);
    getPayInForCheckDao.mockResolvedValue([]); // No duplicates
    getBankaccountDao.mockResolvedValue([mockBankFrozen]);
    getBankResponseDao.mockResolvedValue({}); // Empty bank response
    updatePayInUrlDao.mockResolvedValue();
    merchantPayinCallback.mockImplementation(() => {});

    const result = await payInService.processPayInService(mockConn, mockPayload, mockUpdatedBy, true, false);

    expect(updatePayInUrlDao).toHaveBeenCalledWith(
      mockPayIn.id,
      expect.objectContaining({ status: 'PENDING' }),
      mockConn
    );
    expect(result).toEqual(expect.objectContaining({
      status: 'PENDING',
      merchantOrderId: 'ORDER123',
      payinId: 'PAYIN123',
      req_amount: 1000,
      utr_id: 'UTR123456',
    }));
    expect(merchantPayinCallback).toHaveBeenCalled();
  });
});


// processPayInByImageService Tests
describe('processPayInByImageService', () => {
  let mockConn;
  const payload = {
    base64Image: 'someBase64ImageString',
    merchantOrderId: 'order123',
    amount: 500,
    fileKey: 'file-key-xyz',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockConn = {
      query: jest.fn().mockImplementation(async (query) => {
        if (query.includes('pg_try_advisory_xact_lock')) {
          return { rows: [{ acquired: true }] };
        }
        return { rows: [] };
      }),
    };
    payInService.getPayInUrlService.mockResolvedValue({
      id: 'PAYIN123',
      merchant_order_id: 'order123',
      amount: 500,
      one_time_used: false,
      is_url_expires: false,
      created_at: new Date('2023-01-01T00:00:00Z'),
      config: { urls: { return: 'http://return.url', notify: 'http://notify.url' } },
    });

    calculateDuration.mockImplementation(() => 3600);
    updatePayInUrlDao.mockResolvedValue({
      id: 'PAYIN123',
      amount: 500,
      status: 'IMG_PENDING',
      is_url_expires: true,
      one_time_used: true,
      user_submitted_image: payload.fileKey,
      duration: 3600,
      config: { urls: { return: 'http://return.url' } },
    });
    getImageContentFromOCr.mockImplementation(async () => null);
  });

  test('should update payin and return IMG_PENDING when OCR content or utr missing', async () => {
    const validPayIn = {
      id: 'PAYIN123',
      merchant_order_id: 'order123',
      amount: 500,
      one_time_used: false,
      is_url_expires: false,
      config: { urls: { return: 'http://return.url' } },
    };
    getPayinsForServiccDao.mockResolvedValue(mockPayIn);
    payInService.getPayInUrlService.mockResolvedValue(validPayIn);

    const result = await payInService.processPayInByImageService(mockConn, payload);

    expect(updatePayInUrlDao).toHaveBeenCalledWith('b23366d457dc6e5cabda35d9fce6cc449eff5a47a98e36bc37486c55197632fd', {
      status: 'IMG_PENDING',
      amount: 500,
      is_url_expires: true,
      one_time_used: true,
      user_submitted_image: payload.fileKey,
      duration: 3600,
    });

    expect(result).toEqual({
      status: 'IMG_PENDING',
      amount: 500,
      merchant_order_id: 'order123',
      return_url: 'http://return.url',
    });
  });

  test('should throw error when getImageContentFromOCr fails', async () => {
    const testError = new Error('OCR error');
    getImageContentFromOCr.mockRejectedValue(testError);

    await expect(payInService.processPayInByImageService(mockConn, payload)).rejects.toThrow('OCR error');
    expect(getImageContentFromOCr).toHaveBeenCalledWith(payload.base64Image);
    expect(payInService.getPayInUrlService).not.toHaveBeenCalled();
  });
});

// generatePayInUrlByHashService Tests
describe('generatePayInUrlByHashService', () => {
  let mockConn;
  let mockReq;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConn = {
      query: jest.fn().mockImplementation(async (query) => {
        if (query.includes('pg_try_advisory_xact_lock')) {
          return { rows: [{ acquired: true }] };
        }
        return { rows: [] };
      }),
    };
    mockReq = {
      query: {},
      headers: { 'x-api-key': 'test-api-key' },
    };
  });

  test('should return 400 if required query parameters are missing', async () => {
    mockReq.query = {
      user_id: '123',
      code: 'MERCH1',
    };
    mockReq.user = {
      role_id: '123',
      role: 'ADMIN',
    };

    const result = await payInService.generatePayInUrlByHashService(mockConn, mockReq);

    expect(result).toEqual({
      status: 400,
      message: 'Missing required query parameters: user_id, code, or ot',
    });
  });

  test('should return 404 and send telegram alert if no bank assigned', async () => {
    mockReq.query = { user_id: '123', code: 'MERCH1', ot: 'y' };
    mockReq.user = {
      role_id: '123',
      role: 'ADMIN',
    };
    getMerchantsByCodeDao.mockResolvedValue([{ id: '1234567544346578766', company_id: 100, user_id: '123' }]);
    getCompanyByIDDao.mockResolvedValue([{ config: { telegramBankAlertChatId: 'chat123', telegramBotToken: 'token123' } }]);
    getMerchantBankDao.mockResolvedValue([]);

    const result = await payInService.generatePayInUrlByHashService(mockConn, mockReq);

    expect(result).toEqual({
      status: 404,
      message: 'Bank Account has not been linked with Merchant',
    });
    expect(getMerchantBankDao).toHaveBeenCalledWith({
      config_merchants_contains: '1234567544346578766',
    });
    expect(sendBankNotAssignedAlertTelegram).toHaveBeenCalledWith('chat123', 'MERCH1', 'token123');
  });

  test('should return 404 and send telegram alert if all banks are disabled', async () => {
    mockReq.query = { user_id: '123', code: 'MERCH1', ot: 'y' };
    mockReq.user = {
      role_id: '123',
      role: 'ADMIN',
    };
    getMerchantsByCodeDao.mockResolvedValue([{ id: '1234567544346578766', company_id: 100, user_id: '123' }]);
    getCompanyByIDDao.mockResolvedValue([{ config: { telegramBankAlertChatId: 'chat123', telegramBotToken: 'token123' } }]);
    getMerchantBankDao.mockResolvedValue([{ is_enabled: false }]);

    const result = await payInService.generatePayInUrlByHashService(mockConn, mockReq);

    expect(result).toEqual({
      status: 404,
      message: 'Bank Account has not been linked with Merchant',
    });
    expect(sendBankNotAssignedAlertTelegram).toHaveBeenCalledWith('chat123', 'MERCH1', 'token123');
  });

  test('should return 404 if all payment options are disabled', async () => {
    mockReq.query = { user_id: '123', code: 'MERCH1', ot: 'y' };
    mockReq.user = {
      role_id: '123',
      role: 'ADMIN',
    };
    getMerchantsByCodeDao.mockResolvedValue([{ id: '1234567544346578766', company_id: 100, user_id: '123' }]);
    getCompanyByIDDao.mockResolvedValue([{ config: { telegramBankAlertChatId: 'chat123', telegramBotToken: 'token123' } }]);
    getMerchantBankDao.mockResolvedValue([
      { is_enabled: true, config: { is_phonepay: false }, is_qr: false, is_bank: false },
    ]);

    const result = await payInService.generatePayInUrlByHashService(mockConn, mockReq);

    expect(result).toEqual({
      status: 404,
      message: 'No Payment Methods Enabled!',
    });
  });

  test('should generate payInUrl with query parameters including amount', async () => {
    process.env.REACT_PAYMENT_ORIGIN = 'http://localhost:5174';
    mockReq.user = {
      role_id: '123',
      role: 'ADMIN',
    };
    mockReq.query = { user_id: '123', code: 'MERCH1', ot: 'y', key: 'key123', amount: '1000' };
    getMerchantsByCodeDao.mockResolvedValue([{ id: '1234567544346578766', company_id: 100, user_id: '123' }]);
    getCompanyByIDDao.mockResolvedValue([{ config: { telegramBankAlertChatId: 'chat123', telegramBotToken: 'token123' } }]);
    getMerchantBankDao.mockResolvedValue([{ is_enabled: true, config: { is_phonepay: true }, is_qr: true, is_bank: true }]);
    const mockHash = 'b23366d457dc6e5cabda35d9fce6cc449eff5a47a98e36bc37486c55197632fd';
    createHash.mockReturnValue(mockHash);
    sendBankNotAssignedAlertTelegram.mockResolvedValue();

    const result = await payInService.generatePayInUrlByHashService(mockConn, mockReq);
    expect(result).toEqual({
      payInUrl: `http://localhost:5174/transaction/b23366d457dc6e5cabda35d9fce6cc449eff5a47a98e36bc37486c55197632fd?user_id=123&code=MERCH1&ot=y&key=key123&amount=1000&token=123`,
    });
  });

  test('should generate payInUrl without amount in query parameters', async () => {
    mockReq.query = { user_id: '123', code: 'MERCH1', ot: 'y', key: 'key123' };
    mockReq.user = {
      role_id: '123',
      role: 'ADMIN',
    };
    getMerchantsByCodeDao.mockResolvedValue([{ id: '1234567544346578766', company_id: 100, user_id: '123' }]);
    getCompanyByIDDao.mockResolvedValue([{ config: { telegramBankAlertChatId: 'chat123', telegramBotToken: 'token123' } }]);
    getMerchantBankDao.mockResolvedValue([{ is_enabled: true, config: { is_phonepay: true }, is_qr: true, is_bank: true }]);
    const mockHash = 'b23366d457dc6e5cabda35d9fce6cc449eff5a47a98e36bc37486c55197632fd';
    createHash.mockReturnValue(mockHash);

    const result = await payInService.generatePayInUrlByHashService(mockConn, mockReq);
    expect(result).toEqual({
      payInUrl: 'http://localhost:5174/transaction/b23366d457dc6e5cabda35d9fce6cc449eff5a47a98e36bc37486c55197632fd?user_id=123&code=MERCH1&ot=y&key=key123&token=123',
    });
  });

  test('if bank config is undefined', async () => {
    mockReq.query = { user_id: '123', code: 'MERCH1', ot: 'y' };
    mockReq.user = {
      role_id: '123',
      role: 'ADMIN',
    };
    getMerchantsByCodeDao.mockResolvedValue([{ id: '1234567544346578766', company_id: 100, user_id: '123' }]);
    getCompanyByIDDao.mockResolvedValue([{ config: { telegramBankAlertChatId: 'chat123', telegramBotToken: 'token123' } }]);
    getMerchantBankDao.mockResolvedValue([
      { is_enabled: true, config: undefined, is_qr: false, is_bank: false },
    ]);

    const result = await payInService.generatePayInUrlByHashService(mockConn, mockReq);

    expect(result).toEqual({
      status: 404,
      message: 'No Payment Methods Enabled!',
    });
    expect(getMerchantsByCodeDao).toHaveBeenCalledWith('MERCH1');
    expect(getMerchantBankDao).toHaveBeenCalledWith({
      config_merchants_contains: '1234567544346578766',
    });
  });

  test('if disabled banks and no payment methods enabled', async () => {
    mockReq.query = { user_id: '123', code: 'MERCH1', ot: 'y', key: 'test-api-key' };
    mockReq.user = {
      role_id: '123',
      role: 'ADMIN',
    };
    getMerchantsByCodeDao.mockResolvedValue([{ id: '1234567544346578766', company_id: 100, user_id: '123' }]);
    getCompanyByIDDao.mockResolvedValue([{ config: { telegramBankAlertChatId: 'chat123', telegramBotToken: 'token123' } }]);
    getMerchantBankDao.mockResolvedValue([]);

    const result = await payInService.generatePayInUrlByHashService(mockConn, mockReq);

    expect(result).toEqual({
      status: 404,
      message: 'Bank Account has not been linked with Merchant',
    });
    expect(getMerchantsByCodeDao).toHaveBeenCalledWith('MERCH1');
    expect(getMerchantBankDao).toHaveBeenCalledWith({
      config_merchants_contains: '1234567544346578766',
    });
  });

  test('if bank is enabled but no payment methods found', async () => {
    mockReq.query = { user_id: '123', code: 'MERCH1', ot: 'y' };
    mockReq.user = {
      role_id: '123',
      role: 'ADMIN',
    };
    getMerchantsByCodeDao.mockResolvedValue([{ id: '1234567544346578766', company_id: 100, user_id: '123' }]);
    getCompanyByIDDao.mockResolvedValue([{ config: { telegramBankAlertChatId: 'chat123', telegramBotToken: 'token123' } }]);
    getMerchantBankDao.mockResolvedValue([
      { is_enabled: false },
      { is_enabled: true, config: { is_phonepay: false }, is_qr: false, is_bank: false },
    ]);

    const result = await payInService.generatePayInUrlByHashService(mockConn, mockReq);

    expect(result).toEqual({
      status: 404,
      message: 'No Payment Methods Enabled!',
    });
    expect(getMerchantsByCodeDao).toHaveBeenCalledWith('MERCH1');
    expect(getMerchantBankDao).toHaveBeenCalledWith({
      config_merchants_contains: '1234567544346578766',
    });
  });
});

// generatePayInUrlService Tests
describe('generatePayInUrlService', () => {
  let mockConn;
  let mockReq;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConn = {};
    mockReq = {
      query: {},
      headers: { 'x-api-key': 'test-api-key' },
    };
    nanoid.mockReturnValue('QokKC');
  });

  test('should return 400 if IP is not whitelisted and fromUI is false', async () => {
    getMerchantsByCodeDao.mockResolvedValue([
      {
        id: 'merchant1',
        config: {
          whitelist_ips: ['10.0.0.1', '10.0.0.2'],
          keys: { private: 'test-api-key', public: 'test-api-key' },
          urls: { return: 'https://example.com/return', payin_notify: 'https://example.com/notify' },
        },
        min_payin: 100,
        max_payin: 10000,
        company_id: 'company1',
      },
    ]);
    getPayInForCheckDao.mockResolvedValue([]);

    const payload = {
      code: 'MERCHANT123',
      user_id: '123',
      merchant_order_id: 'order123',
      amount: 1000,
      returnUrl: 'https://example.com/return',
      notifyUrl: 'https://example.com/notify',
      ot: 'n',
      api_key: 'test-api-key',
      x_api_key: 'test-api-key',
    };

    const result = await payInService.generatePayInUrlService({}, payload, 'test_user', '10.0.0.8', false);

    expect(getMerchantsByCodeDao).toHaveBeenCalledWith('MERCHANT123');
    expect(result).toEqual({
      status: 400,
      message: 'IP not whitelisted',
    });
  });

  test('should return 400 if merchant order ID already exists', async () => {
    mockReq.query = {
      user_id: '123',
      code: 'MERCHANT123',
      ot: 'n',
      amount: 1000,
      merchant_order_id: 'order123',
      returnUrl: 'https://example.com/return',
      notifyUrl: 'https://example.com/notify',
      api_key: 'test-api-key',
      x_api_key: 'test-api-key',
    };
    getMerchantsByCodeDao.mockResolvedValue([
      {
        id: 'merchant1',
        config: { whitelist_ips: [], keys: { private: 'test-api-key', public: 'test-api-key' } },
        min_payin: 100,
        max_payin: 10000,
        company_id: 'company1',
      },
    ]);
    getPayInForCheckDao.mockResolvedValue([{ id: 'existing_order' }]);

    const result = await payInService.generatePayInUrlService({}, mockReq.query, 'test_user', '192.168.1.1', true);

    expect(getMerchantsByCodeDao).toHaveBeenCalledWith('MERCHANT123');
    expect(getPayInForCheckDao).toHaveBeenCalledWith({ merchant_order_id: 'order123' });
    expect(result).toEqual({
      status: 400,
      message: 'Merchant Order ID already exists',
    });
  });

  test('should return 400 and "Merchant does not exist" message if merchant not found', async () => {
    getMerchantsByCodeDao.mockResolvedValue([]);
    getPayInForCheckDao.mockResolvedValue([]);

    const payload = {
      code: 'MERCHANT123',
      user_id: 'user123',
      merchant_order_id: 'ORDER123',
      amount: 100,
      returnUrl: 'https://return.url',
      notifyUrl: 'https://notify.url',
      ot: 'n',
      api_key: 'privKey',
      x_api_key: 'privKey',
    };

    const result = await payInService.generatePayInUrlService(
      mockConn,
      payload,
      'test_user',
      '10.0.0.8',
      false,
    );

    expect(getMerchantsByCodeDao).toHaveBeenCalledWith(payload.code);
    expect(result).toEqual({
      status: 400,
      message: 'Merchant does not exist',
    });
  });

  test('should return 404 if API key is invalid (api_key present but incorrect)', async () => {
    const payload = {
      code: 'MERCHANT123',
      user_id: 'user123',
      amount: 100,
      api_key: 'invalid-api-key',
    };
    getMerchantsByCodeDao.mockResolvedValue([
      {
        id: 'merchant1',
        config: {
          keys: {
            private: 'correct-private-key',
            public: 'correct-public-key',
          },
          whitelist_ips: [],
        },
        min_payin: 10,
        max_payin: 1000,
        company_id: 'company1',
      },
    ]);
    getPayInForCheckDao.mockResolvedValue([]);

    const result = await payInService.generatePayInUrlService(mockConn, payload, 'creator123', '127.0.0.1', false);

    expect(result).toEqual({
      status: 404,
      message: 'Enter valid Api key',
    });
  });

  test('should return 400 if amount is not between minimum and maximum', async () => {
    const payload = {
      code: 'MERCHANT123',
      user_id: 'user123',
      amount: 50,
      api_key: 'correct-private-key',
    };
    getMerchantsByCodeDao.mockResolvedValue([
      {
        id: 'merchant1',
        config: {
          keys: {
            private: 'correct-private-key',
            public: 'correct-public-key',
          },
          whitelist_ips: [],
        },
        min_payin: 100,
        max_payin: 10000,
        company_id: 'company1',
      },
    ]);
    getPayInForCheckDao.mockResolvedValue([]);

    const result = await payInService.generatePayInUrlService(mockConn, payload, 'creator123', '127.0.0.1', false);

    expect(result).toEqual({
      status: 400,
      message: 'Amount must be between 100 and 10000',
    });
  });

  test('should throw BadRequestError on unexpected error', async () => {
    getMerchantsByCodeDao.mockRejectedValue(new Error('Database error'));
    await expect(
      payInService.generatePayInUrlService(
        mockConn,
        mockReq.query,
        'test_user',
        '192.168.1.1',
        true
      )
    ).rejects.toThrow('Database error');
  });

  test('should handle invalid amount range for non-admin', async () => {
    const payload = {
      code: 'MERCHANT123',
      user_id: '123',
      amount: 50,
      api_key: 'test-api-key',
    };
    getMerchantsByCodeDao.mockResolvedValue([{
      id: 'merchant1',
      config: { keys: { private: 'test-api-key' }, whitelist_ips: [] },
      min_payin: 100,
      max_payin: 10000,
      company_id: 'company1',
    }]);
    getPayInForCheckDao.mockResolvedValue([]);

    const result = await payInService.generatePayInUrlService({}, payload, 'test_user', '192.168.1.1', true);
    expect(result).toEqual({
      status: 400,
      message: 'Amount must be between 100 and 10000',
    });
  });

  test('should allow invalid amount for admin role', async () => {
    const payload = {
      code: 'MERCHANT123',
      user_id: '123',
      amount: 50,
      api_key: 'test-api-key',
    };
    getMerchantsByCodeDao.mockResolvedValue([{
      id: 'merchant1',
      config: { keys: { private: 'test-api-key' }, whitelist_ips: [] },
      min_payin: 100,
      max_payin: 10000,
      company_id: 'company1',
    }]);
    getPayInForCheckDao.mockResolvedValue([]);
    generatePayInUrlDao.mockResolvedValue({ id: 'new-payin' });

    const result = await payInService.generatePayInUrlService({}, payload, 'admin_user', 'ADMIN', '192.168.1.1', true);
    expect(result).toEqual({ id: 'new-payin' });
  });
});

