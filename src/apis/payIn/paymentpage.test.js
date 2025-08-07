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
  getBankaccountDao: jest.fn()
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


//--------------------------------PROCESS--------------------------------------------------------------
describe('processPayInService', () => {
  const mockConn = {};
  const mockPayload = {
    userSubmittedUtr: 'UTR123',
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
    created_at: new Date(),
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
    utr: 'UTR123',
    amount: 1000,
    bank_id: 'BANK123',
    is_used: false,
  };
  const mockMerchant = {
    id: 'MERCHANT123',
    user_id: 'MERCHANT_USER123',
    payin_commission: 2,
  };

beforeEach(() => {
  jest.clearAllMocks();
});

test('should handle successful payin', async () => {
  getPayInUrlService.mockResolvedValue(mockPayIn);
  checkLockEdit.mockResolvedValue();
  getBankaccountDao.mockResolvedValue([mockBank]);
  getPayInUrlsDao.mockResolvedValue([]);
  getBankResponseDao.mockResolvedValue(mockBankResponse);
  updateBotResponseDao.mockResolvedValue();
  getMerchantsDao.mockResolvedValue([mockMerchant]);
  calculateCommission.mockReturnValue(20);
  updateCalculationTable.mockResolvedValue();
  updatePayInUrlDao.mockResolvedValue();

  const result = await processPayInService(mockConn, mockPayload, mockUpdatedBy);

  expect(getPayInUrlService).toHaveBeenCalledWith('ORDER123', mockConn, true);
  expect(checkLockEdit).toHaveBeenCalledWith(mockConn, 'BANK123UTR123', true);
  expect(getBankaccountDao).toHaveBeenCalledWith({
    id: mockPayIn.bank_acc_id,
    company_id: mockPayIn.company_id,
  });
  expect(getPayInUrlsDao).toHaveBeenCalledWith({ user_submitted_utr: 'UTR123' });
  expect(updateBotResponseDao).toHaveBeenCalledWith('BANK_RESP123', { is_used: true }, mockConn);
  expect(updatePayInUrlDao).toHaveBeenCalledWith(
    mockPayIn.id,
    expect.objectContaining({
      status: Status.SUCCESS,
      amount: 1000,
      user_submitted_utr: 'UTR123',
      is_url_expires: true,
      one_time_used: true,
      user_submitted_image: 'image.jpg',
      is_notified: true,
      updated_by: mockUpdatedBy,
      bank_response_id: 'BANK_RESP123',
      payin_merchant_commission: 20,
    }),
    mockConn
  );
  expect(merchantPayinCallback).toHaveBeenCalledWith(
    mockPayIn.config.urls.notify,
    expect.objectContaining({
      status: Status.SUCCESS,
      merchantOrderId: 'ORDER123',
      payinId: 'PAYIN123',
      amount: 1000,
      req_amount: 1000,
      utr_id: 'UTR123',
    })
  );
  expect(result).toEqual(expect.objectContaining({
    status: Status.SUCCESS,
    merchantOrderId: 'ORDER123',
    payinId: 'PAYIN123',
    amount: 1000,
    req_amount: 1000,
    utr_id: 'UTR123',
  }));
});

test('should handle expired or used payin url', async () => {
  const expiredPayIn = { ...mockPayIn, one_time_used: true, is_url_expires: true };
  getPayInUrlService.mockResolvedValue(expiredPayIn);

  const result = await processPayInService(mockConn, mockPayload, mockUpdatedBy);

  expect(result).toEqual({
    error: 'This payin url is already used',
    result: { redirect_url: expiredPayIn.config.urls.return },
  });
  expect(checkLockEdit).not.toHaveBeenCalled();
});

test('should handle duplicate payin', async () => {
  getPayInUrlService.mockResolvedValue(mockPayIn);
  checkLockEdit.mockResolvedValue();
  getBankaccountDao.mockResolvedValue([mockBank]);
  getPayInUrlsDao.mockResolvedValue([mockPayIn]);
  updatePayInUrlDao.mockResolvedValue();

  const result = await processPayInService(mockConn, mockPayload, mockUpdatedBy);

  expect(updatePayInUrlDao).toHaveBeenCalledWith(
    mockPayIn.id,
    expect.objectContaining({ status: Status.DUPLICATE }),
    mockConn
  );
  expect(merchantPayinCallback).toHaveBeenCalled();
  expect(result).toEqual(expect.objectContaining({
    status: Status.DUPLICATE,
    message: 'Duplicate entry used!',
  }));
});

test('should handle bank mismatch with telegram', async () => {
  const mismatchedBankResponse = { ...mockBankResponse, bank_id: 'BANK456' };
  const botBank = { ...mockBank, id: 'BANK456', nick_name: 'Bank2' };
  getPayInUrlService.mockResolvedValue(mockPayIn);
  checkLockEdit.mockResolvedValue();
  getBankaccountDao
    .mockResolvedValueOnce([mockBank])
    .mockResolvedValueOnce([botBank]);
  getPayInUrlsDao.mockResolvedValue([]);
  getBankResponseDao.mockResolvedValue(mismatchedBankResponse);
  updateBotResponseDao.mockResolvedValue();
  updatePayInUrlDao.mockResolvedValue();
  sendBankMismatchMessageTelegramBot.mockResolvedValue();

  const telegramPayload = { ...mockPayload, from_telegram: true };
  const result = await processPayInService(mockConn, telegramPayload, mockUpdatedBy);

  expect(updatePayInUrlDao).toHaveBeenCalledWith(
    mockPayIn.id,
    expect.objectContaining({ status: Status.BANK_MISMATCH }),
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

test('should handle dispute with telegram', async () => {
  const disputeBankResponse = { ...mockBankResponse, amount: 500 };
  getPayInUrlService.mockResolvedValue(mockPayIn);
  checkLockEdit.mockResolvedValue();
  getBankaccountDao.mockResolvedValue([mockBank]);
  getPayInUrlsDao.mockResolvedValue([]);
  getBankResponseDao.mockResolvedValue(disputeBankResponse);
  updateBotResponseDao.mockResolvedValue();
  updatePayInUrlDao.mockResolvedValue();
  sendDisputeMessageTelegramBot.mockResolvedValue();

  const telegramPayload = { ...mockPayload, from_telegram: true };
  const result = await processPayInService(mockConn, telegramPayload, mockUpdatedBy);

  expect(updatePayInUrlDao).toHaveBeenCalledWith(
    mockPayIn.id,
    expect.objectContaining({ status: Status.DISPUTE }),
    mockConn
  );
  expect(sendDisputeMessageTelegramBot).toHaveBeenCalledWith(
    telegramPayload.telegramMessage.chat.id,
    mockPayload.amount,
    disputeBankResponse.amount,
    telegramPayload.telegramBotToken,
    telegramPayload.telegramMessage.message_id
  );
  expect(result).toBe(true);
});

test('should throw NotFoundError when bank not found', async () => {
  getPayInUrlService.mockResolvedValue(mockPayIn);
  checkLockEdit.mockResolvedValue();
  getBankaccountDao.mockResolvedValue([]);

  await expect(
    processPayInService(mockConn, mockPayload, mockUpdatedBy)
  ).rejects.toThrow(NotFoundError);
});

test('should throw BadRequestError for missing telegram parameters', async () => {
  getPayInUrlService.mockResolvedValue(mockPayIn);
  checkLockEdit.mockResolvedValue();
  getBankaccountDao.mockResolvedValue([mockBank]);
  getPayInUrlsDao.mockResolvedValue([]);
  getBankResponseDao.mockResolvedValue(mockBankResponse);
  updateBotResponseDao.mockResolvedValue();
  updatePayInUrlDao.mockResolvedValue();

  const invalidPayload = { ...mockPayload, from_telegram: true, telegramBotToken: null };

  await expect(
    processPayInService(mockConn, invalidPayload, mockUpdatedBy)
  ).rejects.toThrow(BadRequestError);
});
});