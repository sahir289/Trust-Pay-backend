import { verifyPayinsService, assignedBankToPayInUrlService } from './payInService.js';
import * as payInService from './payInService.js';
import { getMerchantsDao, getMerchantsByCodeDao } from '../merchants/merchantDao.js';
import { getMerchantBankDao, getBankaccountDao } from '../bankAccounts/bankaccountDao.js';
import { getBankResponseDao, updateBotResponseDao } from '../bankResponse/bankResponseDao.js';
import { getCalculationforCronDao } from '../calculation/calculationDao.js';
import { getVendorsDao } from '../vendors/vendorDao.js';
import { updatePayInUrlDao, getPayInUrlDao, getPayInUrlsDao } from './payInDao.js';
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
  class InternalServerError extends Error {}
  class BadRequestError extends Error {}
  class NotFoundError extends Error {}

  return { InternalServerError, BadRequestError, NotFoundError };
});

jest.mock('../company/companyDao.js', () => ({
  getCompanyByIDDao: jest.fn(),
}));

jest.mock('dayjs', () => {
  const mockDayjsInstance = {
    add: jest.fn().mockReturnThis(),
    tz: jest.fn().mockReturnThis(),
    toISOString: jest.fn().mockReturnValue('2025-09-08T12:00:00Z'),
  };
  const mockDayjs = jest.fn(() => mockDayjsInstance);
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
  getPayInUrlDao: jest.fn(),
  getPayInUrlsDao: jest.fn(),
}));

jest.mock('../../utils/logger.js', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
  },
}));

jest.mock('../../utils/bcryptPassword.js', () => ({
  createHash: jest.fn(),
}));

// Global beforeEach to reset mocks
beforeEach(() => {
  jest.resetAllMocks();
});

// verifyPayinsService Tests
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

    expect(getPayInUrlDao).toHaveBeenCalledWith({ merchant_order_id: '123' });
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
    const usedPayIn = { ...mockPayIn, one_time_used: true };
    getPayInUrlDao.mockResolvedValue(usedPayIn);
    updatePayInUrlDao.mockResolvedValue({ id: usedPayIn.id });

    const userLocation = { user_ip: '192.168.1.1' };
    const result = await verifyPayinsService('123', userLocation, 'false');

    expect(getPayInUrlDao).toHaveBeenCalledWith({ merchant_order_id: '123' });
    expect(updatePayInUrlDao).toHaveBeenCalledWith(usedPayIn.id, {
      config: expect.any(String),
      one_time_used: true,
    });
    expect(result).toEqual({
      error: 'This payin url is already used',
      result: { redirect_url: mockPayIn.config.urls.return },
    });
    expect(getMerchantsDao).not.toHaveBeenCalled();
    expect(getMerchantBankDao).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  test('should throw InternalServerError if updatePayInUrlDao returns null', async () => {
    getPayInUrlDao.mockResolvedValue({
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
    getPayInUrlDao.mockResolvedValue(mockPayIn);
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

// assignedBankToPayInUrlService Tests
describe('assignedBankToPayInUrlService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should handle PayIn with ASSIGNED status when type is banktransfer', async () => {
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
    getPayInUrlDao.mockResolvedValue({
      ...mockPayIn,
      status: 'ASSIGNED',
      bank_acc_id: 'bank1',
      company_id: 'company1',
      upi_short_code: 'UPI123',
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

// processPayInService Tests
describe('processPayInService', () => {
  let mockConn;
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
    // Mock getPayInUrlService specifically for this suite
    payInService.getPayInUrlService = jest.fn();
    payInService.getPayInUrlService.mockResolvedValue(mockPayInProcess);
    getPayInUrlDao.mockResolvedValue(mockPayInProcess);
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

  test('should handle successful payin', async () => {
    const result = await payInService.processPayInService(mockConn, mockPayload, mockUpdatedBy);

    expect(checkLockEdit).toHaveBeenCalledWith(mockConn, 'BANK123UTR123456', true);
    expect(getBankaccountDao).toHaveBeenCalledWith({
      id: mockPayInProcess.bank_acc_id,
      company_id: mockPayInProcess.company_id,
    });
    expect(getPayInUrlsDao).toHaveBeenCalledWith({ user_submitted_utr: 'UTR123456' });
    expect(updateBotResponseDao).toHaveBeenCalledWith('BANK_RESP123', { is_used: true }, mockConn);
    expect(getMerchantsDao).toHaveBeenCalledWith({ id: mockPayInProcess.merchant_id });
    expect(getVendorsDao).toHaveBeenCalledWith({ user_id: mockBank.user_id });
    expect(getCalculationforCronDao).toHaveBeenCalledWith(mockMerchantProcess.user_id);
    expect(updatePayInUrlDao).toHaveBeenCalledWith(
      mockPayInProcess.id,
      expect.objectContaining({
        status: 'SUCCESS',
        amount: 1000,
        user_submitted_utr: 'UTR123456',
        is_url_expires: true,
        one_time_used: true,
        user_submitted_image: 'image.jpg',
        is_notified: true,
        updated_by: mockUpdatedBy,
        bank_response_id: 'BANK_RESP123',
        payin_merchant_commission: 20,
        payin_vendor_commission: expect.any(Number),
      }),
      mockConn
    );
    expect(merchantPayinCallback).toHaveBeenCalledWith(
      mockPayInProcess.config.urls.notify,
      expect.objectContaining({
        status: 'SUCCESS',
        merchantOrderId: 'ORDER123',
        payinId: 'PAYIN123',
        amount: 1000,
        req_amount: 1000,
        utr_id: 'UTR123456',
      })
    );
    expect(result).toEqual(expect.objectContaining({
      status: 'SUCCESS',
      merchantOrderId: 'ORDER123',
      payinId: 'PAYIN123',
      amount: 1000,
      req_amount: 1000,
      utr_id: 'UTR123456',
    }));
  });

  test('should handle expired or used payin url', async () => {
    const expiredPayIn = {
      ...mockPayInProcess,
      one_time_used: true,
      is_url_expires: false,
      config: { urls: { return: 'http://return.url' } },
    };
    payInService.getPayInUrlService.mockResolvedValue(expiredPayIn);
    getPayInUrlDao.mockResolvedValue(expiredPayIn);

    const result = await payInService.processPayInService(mockConn, mockPayload, mockUpdatedBy);

    expect(getPayInUrlDao).toHaveBeenCalledWith({ merchant_order_id: mockPayload.merchantOrderId });
    expect(result).toEqual({
      error: 'This payin url is already used',
      result: { redirect_url: expiredPayIn.config.urls.return },
    });
    expect(checkLockEdit).not.toHaveBeenCalled();
  });

  test('should handle duplicate payin', async () => {
    getPayInUrlsDao.mockResolvedValue([mockPayInProcess]);
    updatePayInUrlDao.mockResolvedValue();

    const result = await payInService.processPayInService(mockConn, mockPayload, mockUpdatedBy);

    expect(getPayInUrlsDao).toHaveBeenCalledWith({ user_submitted_utr: 'UTR123456' });
    expect(updatePayInUrlDao).toHaveBeenCalledWith(
      mockPayInProcess.id,
      expect.objectContaining({ status: 'DUPLICATE' }),
      mockConn
    );
    expect(merchantPayinCallback).toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({
      amount: 1000,
      merchantOrderId: 'ORDER123',
      message: 'Duplicate entry found!',
      payinId: 'PAYIN123',
      req_amount: 1000,
      status: 'DUPLICATE',
      utr_id: 'UTR123456',
    }));
  });

  test('should handle bank mismatch with telegram', async () => {
    const mismatchedBankResponse = { ...mockBankResponse, bank_id: 'BANK456' };
    const botBank = { ...mockBank, id: 'BANK456', nick_name: 'Bank2' };
    getBankaccountDao
      .mockResolvedValueOnce([mockBank])
      .mockResolvedValueOnce([botBank]);
    getBankResponseDao.mockResolvedValue(mismatchedBankResponse);
    updateBotResponseDao.mockResolvedValue();
    updatePayInUrlDao.mockResolvedValue();
    sendBankMismatchMessageTelegramBot.mockResolvedValue();

    const telegramPayload = { ...mockPayload, from_telegram: true };
    const result = await payInService.processPayInService(mockConn, telegramPayload, mockUpdatedBy);

    expect(getBankaccountDao).toHaveBeenCalledWith({
      id: mockPayInProcess.bank_acc_id,
      company_id: mockPayInProcess.company_id,
    });
    expect(getBankaccountDao).toHaveBeenCalledWith({ id: 'BANK456' });
    expect(updatePayInUrlDao).toHaveBeenCalledWith(
      mockPayInProcess.id,
      expect.objectContaining({ status: 'BANK_MISMATCH' }),
      mockConn
    );
    expect(sendBankMismatchMessageTelegramBot).toHaveBeenCalledWith(
      telegramPayload.telegramMessage.chat.id,
      mockBank.nick_name,
      botBank.nick_name,
      telegramPayload.telegramBotToken,
      telegramPayload.telegramMessage.message_id
    );
    expect(result).toBe(true);
  });

  test('should throw NotFoundError when bank not found', async () => {
    getBankaccountDao.mockResolvedValue([]);

    await expect(
      payInService.processPayInService(mockConn, mockPayload, mockUpdatedBy)
    ).rejects.toThrow(NotFoundError);

    expect(getBankaccountDao).toHaveBeenCalledWith({
      id: mockPayInProcess.bank_acc_id,
      company_id: mockPayInProcess.company_id,
    });
  });

  test('should throw BadRequestError for missing telegram parameters', async () => {
    const invalidPayload = { ...mockPayload, from_telegram: true, telegramBotToken: null };
    payInService.getPayInUrlService.mockResolvedValue(mockPayInProcess);

    await expect(
      payInService.processPayInService(mockConn, invalidPayload, mockUpdatedBy)
    ).rejects.toThrow(BadRequestError);
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
    // Mock getPayInUrlService specifically for this suite
    payInService.getPayInUrlService = jest.fn();
    payInService.getPayInUrlService.mockResolvedValue({
      id: 'PAYIN123',
      merchant_order_id: 'order123',
      amount: 500,
      one_time_used: false,
      is_url_expires: false,
      created_at: new Date('2023-01-01T00:00:00Z'),
      config: { urls: { return: 'http://return.url', notify: 'http://notify.url' } },
    });
    getPayInUrlDao.mockResolvedValue({
      id: 'PAYIN123',
      merchant_order_id: 'order123',
      amount: 500,
      one_time_used: false,
      is_url_expires: false,
      created_at: new Date('2023-01-01T00:00:00Z'),
      config: { urls: { return: 'http://return.url', notify: 'http://notify.url' } },
    });
    calculateDuration.mockImplementation((date) => {
      console.log('calculateDuration called with:', date);
      return 3600;
    });
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
    getImageContentFromOCr.mockImplementation(async (image) => {
      console.log('getImageContentFromOCr called with:', image);
      return null;
    });
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
    getPayInUrlDao.mockResolvedValue(validPayIn);
    payInService.getPayInUrlService.mockResolvedValue(validPayIn);

    const result = await payInService.processPayInByImageService(mockConn, payload);

    expect(updatePayInUrlDao).toHaveBeenCalledWith('PAYIN123', {
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

    const result = await payInService.generatePayInUrlByHashService(mockConn, mockReq);

    expect(result).toEqual({
      status: 400,
      message: 'Missing required query parameters: user_id, code, or ot',
    });
  });

  test('should return 404 and send telegram alert if no bank assigned', async () => {
    mockReq.query = { user_id: '123', code: 'MERCH1', ot: 'y' };
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
    mockReq.query = { user_id: '123', code: 'MERCH1', ot: 'y', key: 'key123', amount: '1000' };
    getMerchantsByCodeDao.mockResolvedValue([{ id: '1234567544346578766', company_id: 100, user_id: '123' }]);
    getCompanyByIDDao.mockResolvedValue([{ config: { telegramBankAlertChatId: 'chat123', telegramBotToken: 'token123' } }]);
    getMerchantBankDao.mockResolvedValue([{ is_enabled: true, config: { is_phonepay: true }, is_qr: true, is_bank: true }]);
    const mockHash = 'b23366d457dc6e5cabda35d9fce6cc449eff5a47a98e36bc37486c55197632fd';
    createHash.mockReturnValue(mockHash);
    sendBankNotAssignedAlertTelegram.mockResolvedValue();

    const result = await payInService.generatePayInUrlByHashService(mockConn, mockReq);
    expect(result).toEqual({
      payInUrl: `http://localhost:5174/transaction/b23366d457dc6e5cabda35d9fce6cc449eff5a47a98e36bc37486c55197632fd?user_id=123&code=MERCH1&ot=y&key=key123&amount=1000`,
    });
  });

  test('should generate payInUrl without amount in query parameters', async () => {
    mockReq.query = { user_id: '123', code: 'MERCH1', ot: 'y', key: 'key123' };
    getMerchantsByCodeDao.mockResolvedValue([{ id: '1234567544346578766', company_id: 100, user_id: '123' }]);
    getCompanyByIDDao.mockResolvedValue([{ config: { telegramBankAlertChatId: 'chat123', telegramBotToken: 'token123' } }]);
    getMerchantBankDao.mockResolvedValue([{ is_enabled: true, config: { is_phonepay: true }, is_qr: true, is_bank: true }]);
    const mockHash = 'b23366d457dc6e5cabda35d9fce6cc449eff5a47a98e36bc37486c55197632fd';
    createHash.mockReturnValue(mockHash);

    const result = await payInService.generatePayInUrlByHashService(mockConn, mockReq);
    expect(result).toEqual({
      payInUrl: 'http://localhost:5174/transaction/b23366d457dc6e5cabda35d9fce6cc449eff5a47a98e36bc37486c55197632fd?user_id=123&code=MERCH1&ot=y&key=key123',
    });
  });

  test('if bank config is undefined', async () => {
    mockReq.query = { user_id: '123', code: 'MERCH1', ot: 'y' };
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
    jest.mock('../../utils/db.js', () => (fn) => async (...args) => fn(...args));
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
    getPayInUrlDao.mockResolvedValue(null);

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
    getPayInUrlDao.mockResolvedValue({ id: 'existing_order' });

    const result = await payInService.generatePayInUrlService({}, mockReq.query, 'test_user', '192.168.1.1', true);

    expect(getMerchantsByCodeDao).toHaveBeenCalledWith('MERCHANT123');
    expect(getPayInUrlDao).toHaveBeenCalledWith({ merchant_order_id: 'order123' });
    expect(result).toEqual({
      status: 400,
      message: 'Merchant Order ID already exists',
    });
  });

  test('should return 400 and "Merchant does not exist" message if merchant not found', async () => {
    getMerchantsByCodeDao.mockResolvedValue([]);
    getPayInUrlDao.mockResolvedValue(null);

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
    getPayInUrlDao.mockResolvedValue(null);

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
    getPayInUrlDao.mockResolvedValue(null);

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
});

// getPayInUrlService Tests
describe('getPayInUrlService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(1630000000000);
  });

  afterEach(() => {
    jest.spyOn(Date, 'now').mockRestore();
  });

  test('should return payIn object when URL is valid', async () => {
    const mockPayIn = {
      id: 'PAYIN123',
      merchant_order_id: '123',
      config: { urls: { return: 'http://return.url', notify: 'http://notify.url' } },
      is_url_expires: false,
      one_time_used: false,
      expiration_date: 1630000001000,
      status: 'INITIATED',
      amount: 500,
    };
    getPayInUrlDao.mockResolvedValue(mockPayIn);

    const result = await payInService.getPayInUrlService('123', {}, true);

    expect(getPayInUrlDao).toHaveBeenCalledWith({ merchant_order_id: '123' });
    expect(result).toEqual(mockPayIn);
    expect(updatePayInUrlDao).not.toHaveBeenCalled();
    expect(merchantPayinCallback).not.toHaveBeenCalled();
  });

  test('should throw NotFoundError when payIn is not found', async () => {
    getPayInUrlDao.mockResolvedValue(null);

    await expect(payInService.getPayInUrlService('123', {})).rejects.toThrow(NotFoundError);
    expect(getPayInUrlDao).toHaveBeenCalledWith({ merchant_order_id: '123' });
    expect(updatePayInUrlDao).not.toHaveBeenCalled();
    expect(merchantPayinCallback).not.toHaveBeenCalled();
  });

  test('should return error and redirect URL when URL is expired and tele_check is true', async () => {
    const mockPayIn = {
      id: 'PAYIN123',
      merchant_order_id: '123',
      config: { urls: { return: 'http://return.url', notify: 'http://notify.url' } },
      is_url_expires: true,
      one_time_used: false,
      expiration_date: 1629999999999,
      status: 'INITIATED',
      amount: 500,
    };
    getPayInUrlDao.mockResolvedValue(mockPayIn);

    const result = await payInService.getPayInUrlService('123', {}, true);

    expect(getPayInUrlDao).toHaveBeenCalledWith({ merchant_order_id: '123' });
    expect(result).toEqual({
      error: 'Url is expired',
      result: { redirect_url: 'http://return.url' },
    });
    expect(updatePayInUrlDao).not.toHaveBeenCalled();
    expect(merchantPayinCallback).not.toHaveBeenCalled();
  });

  test('should return error and redirect URL when one_time_used is true', async () => {
    const mockPayIn = {
      id: 'PAYIN123',
      merchant_order_id: '123',
      config: { urls: { return: 'http://return.url', notify: 'http://notify.url' } },
      is_url_expires: false,
      one_time_used: true,
      expiration_date: 1630000001000,
      status: 'INITIATED',
      amount: 500,
    };
    getPayInUrlDao.mockResolvedValue(mockPayIn);

    const result = await payInService.getPayInUrlService('123', {}, true);

    expect(getPayInUrlDao).toHaveBeenCalledWith({ merchant_order_id: '123' });
    expect(result).toEqual({
      error: 'Url is expired',
      result: { redirect_url: 'http://return.url' },
    });
    expect(updatePayInUrlDao).not.toHaveBeenCalled();
    expect(merchantPayinCallback).not.toHaveBeenCalled();
  });

  test('should update payIn and notify merchant when URL is expired and status is not INITIATED', async () => {
    const mockPayIn = {
      id: 'PAYIN123',
      merchant_order_id: '123',
      config: { urls: { return: 'http://return.url', notify: 'http://notify.url' } },
      is_url_expires: false,
      one_time_used: false,
      expiration_date: 1629999999999,
      status: 'PENDING',
      amount: 500,
    };
    getPayInUrlDao.mockResolvedValue(mockPayIn);
    updatePayInUrlDao.mockResolvedValue();

    await payInService.getPayInUrlService('123', {});

    expect(getPayInUrlDao).toHaveBeenCalledWith({ merchant_order_id: '123' });
    expect(updatePayInUrlDao).toHaveBeenCalledWith(
      'PAYIN123',
      { is_url_expires: true, status: 'DROPPED' },
      {}
    );
    expect(merchantPayinCallback).toHaveBeenCalledWith(
      'http://notify.url',
      expect.objectContaining({
        status: 'DROPPED',
        merchantOrderId: '123',
        payinId: 'PAYIN123',
      })
    );
  });

  test('should skip expiration check when tele_check is false', async () => {
    const mockPayIn = {
      id: 'PAYIN123',
      merchant_order_id: '123',
      config: { urls: { return: 'http://return.url', notify: 'http://notify.url' } },
      is_url_expires: true,
      one_time_used: true,
      expiration_date: 1629999999999,
      status: 'INITIATED',
      amount: 500,
    };
    getPayInUrlDao.mockResolvedValue(mockPayIn);

    const result = await payInService.getPayInUrlService('123', {}, false);

    expect(getPayInUrlDao).toHaveBeenCalledWith({ merchant_order_id: '123' });
    expect(result).toEqual(mockPayIn);
    expect(updatePayInUrlDao).not.toHaveBeenCalled();
    expect(merchantPayinCallback).not.toHaveBeenCalled();
  });

  test('should log error and rethrow when an error occurs', async () => {
    const error = new Error('Database error');
    getPayInUrlDao.mockRejectedValue(error);

    await expect(payInService.getPayInUrlService('123', {})).rejects.toThrow('Database error');
    expect(getPayInUrlDao).toHaveBeenCalledWith({ merchant_order_id: '123' });
    expect(logger.error).toHaveBeenCalledWith('Error in getPayInUrlService:', error);
    expect(updatePayInUrlDao).not.toHaveBeenCalled();
    expect(merchantPayinCallback).not.toHaveBeenCalled();
  });
});