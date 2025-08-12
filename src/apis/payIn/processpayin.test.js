
import { getImageContentFromOCr, calculateDuration } from '../../helpers/index.js';
import { getBankResponseDao, updateBotResponseDao } from '../bankResponse/bankResponseDao.js';
import { calculateCommission } from '../../utils/calculation.js';
import { getMerchantsDao } from '../merchants/merchantDao.js';
import { getCalculationforCronDao } from '../calculation/calculationDao.js';
import { updatePayInUrlDao, getPayInUrlDao, getPayInUrlsDao } from './payInDao.js';
import { getBankaccountDao } from '../bankAccounts/bankaccountDao.js';
import { checkLockEdit } from '../../utils/advisoryLock.js';
import { merchantPayinCallback } from '../../callBacksAndWebHook/merchantCallBacks.js';
import { getVendorsDao } from '../vendors/vendorDao.js';
import { sendBankMismatchMessageTelegramBot } from '../../utils/sendTelegramMessages.js';
import { BadRequestError, NotFoundError } from '../../utils/appErrors.js';
import * as payInService from './payInService.js';

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
const mockPayIn = {
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
const mockMerchant = {
  id: 'MERCHANT123',
  user_id: 'MERCHANT_USER123',
  payin_commission: 2,
};

jest.mock('./payInService.js', () => {
  const actual = jest.requireActual('./payInService.js');
  return {
    ...actual,
    verifyPayinsService: jest.fn(),
    assignedBankToPayInUrlService: jest.fn(),
    // getPayInUrlService: jest.fn().mockImplementation(() => {
    //   return Promise.resolve(mockPayIn);
    // }),
    processPayInByImageService: actual.processPayInByImageService,
    processPayInService: actual.processPayInService,
    updateCalculationTable: jest.fn(), 
  };
});

jest.mock('../../utils/sendTelegramMessages.js', () => ({
  sendBankMismatchMessageTelegramBot: jest.fn(),
  sendDisputeMessageTelegramBot: jest.fn(),
}));

jest.mock('../../helpers/index.js', () => ({
  ...jest.requireActual('../../helpers/index.js'),
  calculateDuration: jest.fn(),
  getImageContentFromOCr: jest.fn(),
}));

jest.mock('../../utils/advisoryLock.js', () => ({
  checkLockEdit: jest.fn(),
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
}));

jest.mock('./payInDao.js', () => ({
  updatePayInUrlDao: jest.fn(),
  getPayInUrlDao: jest.fn(),
  getPayInUrlsDao: jest.fn(),
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

describe('processPayInService', () => {
  let mockConn;
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    jest.spyOn(payInService, 'getPayInUrlService').mockResolvedValue(mockPayIn);
    mockConn = {
      query: jest.fn().mockImplementation(async (query) => {
        if (query.includes('pg_try_advisory_xact_lock')) {
          return { rows: [{ acquired: true }] };
        }
        return { rows: [] };
      }),
    };
    // payInService.getPayInUrlService.mockReset();
    payInService.getPayInUrlService.mockResolvedValue(mockPayIn);
    getPayInUrlDao.mockResolvedValue(mockPayIn);
    checkLockEdit.mockResolvedValue(true);
    getBankaccountDao.mockResolvedValue([mockBank]);
    getPayInUrlsDao.mockResolvedValue([]);
    getBankResponseDao.mockResolvedValue(mockBankResponse);
    updateBotResponseDao.mockResolvedValue();
    getMerchantsDao.mockResolvedValue([mockMerchant]);
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
        user_id: mockMerchant.user_id,
        balance: 0,
        payin_commission: 20,
      },
    ]);
  });
  test('should handle successful payin', async () => {
    const result = await payInService.processPayInService(mockConn, mockPayload, mockUpdatedBy);
    expect(checkLockEdit).toHaveBeenCalledWith(mockConn, 'BANK123UTR123456', true);
    expect(getBankaccountDao).toHaveBeenCalledWith({
      id: mockPayIn.bank_acc_id,
      company_id: mockPayIn.company_id,
    });
    expect(getPayInUrlsDao).toHaveBeenCalledWith({ user_submitted_utr: 'UTR123456' });
    expect(updateBotResponseDao).toHaveBeenCalledWith('BANK_RESP123', { is_used: true }, mockConn);
    expect(getMerchantsDao).toHaveBeenCalledWith({ id: mockPayIn.merchant_id });
    expect(getVendorsDao).toHaveBeenCalledWith({ user_id: mockBank.user_id });
    expect(getCalculationforCronDao).toHaveBeenCalledWith(mockMerchant.user_id);
    expect(updatePayInUrlDao).toHaveBeenCalledWith(
      mockPayIn.id,
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
      mockPayIn.config.urls.notify,
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
      ...mockPayIn,
      one_time_used: true,
      is_url_expires: false,
      config: { urls: { return: 'http://return.url' } },
    };
    payInService.getPayInUrlService.mockResolvedValue(expiredPayIn);
    getPayInUrlDao.mockResolvedValue(expiredPayIn);

    const result = await payInService.processPayInService(mockConn, mockPayload, mockUpdatedBy);

    expect(result).toEqual({
      error: 'This payin url is already used',
      result: { redirect_url: expiredPayIn.config.urls.return },
    });
    expect(checkLockEdit).not.toHaveBeenCalled();
  });

  test('should handle duplicate payin', async () => {
    getPayInUrlsDao.mockResolvedValue([mockPayIn]);
    updatePayInUrlDao.mockResolvedValue();

    const result = await payInService.processPayInService(mockConn, mockPayload, mockUpdatedBy);

    expect(updatePayInUrlDao).toHaveBeenCalledWith(
      mockPayIn.id,
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

    expect(updatePayInUrlDao).toHaveBeenCalledWith(
      mockPayIn.id,
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
  });

  test('should throw BadRequestError for missing telegram parameters', async () => {
    const invalidPayload = { ...mockPayload, from_telegram: true, telegramBotToken: null };
    await expect(
      payInService.processPayInService(mockConn, invalidPayload, mockUpdatedBy)
    ).rejects.toThrow(BadRequestError);
  });
});

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
    getImageContentFromOCr.mockImplementation(async (image) => {
      console.log('getImageContentFromOCr called with:', image);
      return null;
    });
    payInService.getPayInUrlService.mockResolvedValue({
      id: 'PAYIN123',
      amount: 500,
      one_time_used: false,
      is_url_expires: false,
      created_at: new Date('2023-01-01T00:00:00Z'),
      config: { urls: { return: 'http://return.url' } },
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
  });

  test('should process payin successfully when OCR returns valid UTR', async () => {
    getImageContentFromOCr.mockImplementation(async (image) => {
      console.log('getImageContentFromOCr called with:', image);
      return { utr: 'UTR123456' };
    });

    payInService.getPayInUrlService.mockResolvedValue({
      id: 'PAYIN123',
      amount: 1000,
      one_time_used: false,
      is_url_expires: false,
      config: { urls: { return: 'http://return.url' } },
    });

    jest.spyOn(payInService, 'processPayInService').mockResolvedValue({
      status: 'SUCCESS',
      merchantOrderId: 'ORDER123',
      payinId: 'PAYIN123',
      amount: 1000,
      req_amount: 1000,
      utr_id: 'UTR123456',
    });

    let result;
    try {
      result = await payInService.processPayInByImageService(mockConn, payload);
    } catch (error) {
      console.error('Test error:', error);
      throw error;
    }

    expect(getImageContentFromOCr).toHaveBeenCalledWith(payload.base64Image);
    expect(payInService.getPayInUrlService).toHaveBeenCalledWith(payload.merchantOrderId);
    expect(payInService.processPayInService).toHaveBeenCalledWith(mockConn, {
      ...payload,
      userSubmittedUtr: 'UTR123456',
      amount: 1000,
      user_submitted_image: payload.fileKey,
    });
    expect(result).toEqual({
      status: 'SUCCESS',
      merchantOrderId: 'ORDER123',
      payinId: 'PAYIN123',
      amount: 1000,
      req_amount: 1000,
      utr_id: 'UTR123456',
    });
  });

  test('should return error when payin URL is already used', async () => {
    const expiredPayIn = {
      id: 'PAYIN123',
      amount: 500,
      one_time_used: true,
      is_url_expires: false,
      config: { urls: { return: 'http://return.url' } },
    };
    payInService.getPayInUrlService.mockResolvedValue(expiredPayIn);
    getPayInUrlDao.mockResolvedValue(expiredPayIn);

    const result = await payInService.processPayInByImageService(mockConn, payload);

    expect(getImageContentFromOCr).toHaveBeenCalledWith(payload.base64Image);
    expect(payInService.getPayInUrlService).toHaveBeenCalledWith(payload.merchantOrderId);
    expect(result).toEqual({
      error: 'This payin url is already used',
      result: { redirect_url: 'http://return.url' },
    });
  });

  test('should update payin and return IMG_PENDING when OCR content or utr missing', async () => {
    getImageContentFromOCr.mockImplementation(async (image) => {
      console.log('getImageContentFromOCr called with:', image);
      return null;
    });

    const payInDataMock = {
      id: 'PAYIN123',
      amount: 500,
      one_time_used: false,
      is_url_expires: false,
      created_at: new Date('2023-01-01T00:00:00Z'),
      config: { urls: { return: 'http://return.url' } },
    };

    payInService.getPayInUrlService.mockResolvedValue(payInDataMock);
    calculateDuration.mockImplementation((date) => {
      console.log('calculateDuration called with:', date);
      return 3600;
    });
    updatePayInUrlDao.mockResolvedValue({
      ...payInDataMock,
      status: 'IMG_PENDING',
      amount: 500,
      is_url_expires: true,
      one_time_used: true,
      user_submitted_image: payload.fileKey,
      duration: 3600,
    });

    let result;
    try {
      result = await payInService.processPayInByImageService(mockConn, payload);
    } catch (error) {
      console.error('Test error:', error);
      throw error;
    }

    expect(getImageContentFromOCr).toHaveBeenCalledWith(payload.base64Image);
    expect(payInService.getPayInUrlService).toHaveBeenCalledWith(payload.merchantOrderId);
    expect(calculateDuration).toHaveBeenCalledWith(payInDataMock.created_at);
    expect(updatePayInUrlDao).toHaveBeenCalledWith(payInDataMock.id, {
      status: 'IMG_PENDING',
      amount: payload.amount,
      is_url_expires: true,
      one_time_used: true,
      user_submitted_image: payload.fileKey,
      duration: 3600,
    });

    expect(result).toEqual({
      status: 'IMG_PENDING',
      amount: payload.amount,
      merchant_order_id: payload.merchantOrderId,
      return_url: payInDataMock.config.urls.return,
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