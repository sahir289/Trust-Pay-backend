const { generatePayInUrlByHashService, getPayInUrlService } = require('./payInService.js');
const { getMerchantsByCodeDao } = require('../merchants/merchantDao.js');
const { getMerchantBankDao } = require('../bankAccounts/bankaccountDao.js');
const { getCompanyByIDDao } = require('../company/companyDao.js');
const { sendBankNotAssignedAlertTelegram } = require('../../utils/sendTelegramMessages.js');
const { createHash } = require('../../utils/bcryptPassword.js');
const { getPayInUrlDao, updatePayInUrlDao } = require('./payInDao');
const { merchantPayinCallback } = require('../../callBacksAndWebHook/merchantCallBacks.js');
const { NotFoundError, Status } = require('../../utils/constants.js');
jest.mock('./payInDao');
jest.mock('../../callBacksAndWebHook/merchantCallBacks.js');
jest.mock('../../utils/logger');
jest.mock('../merchants/merchantDao.js', () => ({
    getMerchantsByCodeDao: jest.fn(),
}));
jest.mock('../company/companyDao.js');
jest.mock('../bankAccounts/bankaccountDao.js');
jest.mock('../../utils/sendTelegramMessages.js');
jest.mock('../../utils/bcryptPassword.js');
jest.mock('../../utils/bcryptPassword.js', () => ({
  createHash: jest.fn(), 
  reactPaymentOrigin: 'http://localhost:8090',
}));

//toHaveBeenCalledWith is a matcher function used to assert that a mock function was called with specific arguments.

//----------------------generatePayinHash---------------------------------
describe('generatePayInUrlByHashService', () => {
  let mockConn;
  let mockReq;

  beforeEach(() => {
      mockConn = {};  
      mockReq = {    
          query: {},
          headers: { 'x-api-key': 'test-api-key' },
      };
      jest.clearAllMocks();
  });

  test('should return 400 if required query parameters are missing', async () => {
      mockReq.query = { 
        user_id: '123',
        code: 'MERCHANT123',
        };  

      const result = await generatePayInUrlByHashService(mockConn, mockReq);

      expect(result).toEqual({
          status: 400,
          message: 'Missing required query parameters: user_id, code, or ot',
      });
  });

  test('should return 404 and send telegram alert if no bank assigned', async () => {
    mockReq.query = { user_id: '123', code: 'MERCH1', ot: 'y' };
  
    getMerchantsByCodeDao.mockResolvedValue([
      { id: '1234567544346578766', company_id: 100, user_id: '123' }
    ]);
  
    getCompanyByIDDao.mockResolvedValue([
      {
        config: {
          telegramBankAlertChatId: 'chat123',
          telegramBotToken: 'token123'
        }
      }
    ]);
  
    getMerchantBankDao.mockResolvedValue([]); 
  
    const result = await generatePayInUrlByHashService(mockConn, mockReq);
  
    expect(result).toEqual({
      status: 404,
      message: 'Bank Account has not been linked with Merchant',
    });
  
    expect(getMerchantBankDao).toHaveBeenCalledWith({
      config_merchants_contains: '1234567544346578766',
    });
  
    expect(sendBankNotAssignedAlertTelegram).toHaveBeenCalledWith(
      'chat123',
      'MERCH1',
      'token123'
    );
  });
  
  test('should return 404 if no merchant found for code', async () => {
    const mockMerchant = [{
      id: 1,
      user_id: 123,
      first_name: 'John',
      last_name: 'Doe',
      code: 'MERCH1',
      min_payin: 100,
      max_payin: 10000,
      payin_commission: 0.02,
      payout_commission: 0.015,
      min_payout: 50,
      max_payout: 5000,
      config: { someConfig: 'value' },
      company_id: 456,
      created_by: 'admin_user',
      updated_by: 'admin_user',
      created_at: new Date('2025-01-01T10:00:00Z'),
      updated_at: new Date('2025-01-02T10:00:00Z'),
      designation_id: 789,
      full_name: 'John Doe',
      designation_name: 'Merchant Manager'
    }];
    mockReq.query = { user_id: '123', code: 'MERCH1', ot: 'y' };
    getMerchantsByCodeDao.mockResolvedValue(mockMerchant);
    
    getMerchantBankDao.mockResolvedValue([]);
  
    const result = await generatePayInUrlByHashService(mockConn, mockReq);
  
    expect(result).toEqual({
      status: 404,
      message: 'Bank Account has not been linked with Merchant',
    });
    expect(getMerchantsByCodeDao).toHaveBeenCalledWith('MERCH1');
    expect(getMerchantBankDao).toHaveBeenCalledWith({
      config_merchants_contains: mockMerchant[0].id,
    });
  });

  test('should return 404 and send telegram alert if no bank assigned', async () => {
    mockReq.query = { user_id: '123', code: 'MERCH1', ot: 'y' };
    getMerchantsByCodeDao.mockResolvedValue([{ id: '1234567544346578766', company_id: 100, user_id: '123' }]);
    getCompanyByIDDao.mockResolvedValue([{ config: { telegramBankAlertChatId: 'chat123', telegramBotToken: 'token123' } }]);
    getMerchantBankDao.mockResolvedValue([]);
  
    const result = await generatePayInUrlByHashService(mockConn, mockReq);
  
    expect(result).toEqual({
      status: 404,
      message: 'Bank Account has not been linked with Merchant',
    });
    expect(getMerchantBankDao).toHaveBeenCalledWith({ config_merchants_contains: '1234567544346578766' });
    expect(sendBankNotAssignedAlertTelegram).toHaveBeenCalledWith('chat123', 'MERCH1', 'token123');
  });
  

  test('should return 404 and send telegram alert if all banks are disabled', async () => {
    mockReq.query = { user_id: '123', code: 'MERCH1', ot: 'y' };
    getMerchantsByCodeDao.mockResolvedValue([{ id: '1234567544346578766', company_id: 100, user_id: '123' }]);
    getCompanyByIDDao.mockResolvedValue([{ config: { telegramBankAlertChatId: 'chat123', telegramBotToken: 'token123' } }]);
    getMerchantBankDao.mockResolvedValue([{ is_enabled: false }]);

    const result = await generatePayInUrlByHashService(mockConn, mockReq);

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

    const result = await generatePayInUrlByHashService(mockConn, mockReq);

    expect(result).toEqual({
      status: 404,
      message: 'No Payment Methods Enabled!',
    });
  });


  test('should generate payInUrl with query parameters including amount', async () => {
    process.env.REACT_PAYMENT_ORIGIN = 'http://localhost:5174';
  
    const mockReq = {
      query: { user_id: '123', code: 'MERCH1', ot: 'y', key: 'key123', amount: '1000' },
    };
    const mockConn = {};
    getMerchantsByCodeDao.mockResolvedValue([{ id: '1234567544346578766', company_id: 100, user_id: '123' }]);
    getCompanyByIDDao.mockResolvedValue([{ config: { telegramBankAlertChatId: 'chat123', telegramBotToken: 'token123' } }]);
    getMerchantBankDao.mockResolvedValue([{ is_enabled: true, config: { is_phonepay: true }, is_qr: true, is_bank: true }]);
    const mockHash = 'b23366d457dc6e5cabda35d9fce6cc449eff5a47a98e36bc37486c55197632fd';
    createHash.mockReturnValue(mockHash);
    sendBankNotAssignedAlertTelegram.mockResolvedValue();
  
    const result = await generatePayInUrlByHashService(mockConn, mockReq);
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

    const result = await generatePayInUrlByHashService(mockConn, mockReq);
    expect(result).toEqual({
      payInUrl: 'http://localhost:5174/transaction/b23366d457dc6e5cabda35d9fce6cc449eff5a47a98e36bc37486c55197632fd?user_id=123&code=MERCH1&ot=y&key=key123',
    });
  });
});

//----------------------generatePayInUrlService---------------------------------

describe('generatePayInUrlService', ()=>{
  let mockConn;
  let mockReq;

  beforeEach(() => {
    mockConn = {};
    mockReq = {
      query: {},
      headers : { 'x-api-key' : 'test-api-key'},
    };
    jest.clearAllMocks();
  });

  test('should return 400 if required query parameters are missing', async () => {
     mockReq.query = {
       user_id: '123', code: 'MERCHANT123'
    };
     mockConn = {};
  
    const result = await generatePayInUrlByHashService(mockConn, mockReq);
  
    expect(result).toEqual({
      status: 400,
      message: 'Missing required query parameters: user_id, code, or ot',
    });
  });
})

//----------------------getPayInUrlService---------------------------------

describe('getPayInUrlService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock Date.now
    jest.spyOn(Date, 'now').mockReturnValue(1630000000000); // Mon, 30 Aug 2021 20:26:40 GMT
    getPayInUrlDao.mockImplementation(({ merchant_order_id }) => {
      return Promise.resolve({
        merchant_order_id,
        config: { urls: { return: 'http://return.url', notify: 'http://notify.url' } },
        is_url_expires: false,
        one_time_used: false,
        expiration_date: 1630000001000,
        status: Status.INITIATED,
        amount: 100,
        utr: 'utr123',
        id: 'payin1'
      });
    });
    updatePayInUrlDao.mockResolvedValue();
    merchantPayinCallback.mockResolvedValue();
  });

  afterEach(() => {
    jest.spyOn(Date, 'now').mockRestore();
  });

  test('should return payIn object when URL is valid', async () => {
    const mockPayIn = {
      merchant_order_id: '123',
      config: { urls: { return: 'http://return.url', notify: 'http://notify.url' } },
      is_url_expires: false,
      one_time_used: false,
      expiration_date: 1630000001000, 
      status: 'INITIATED',
      amount: 100,
      utr: 'utr123',
      id: 'payin1'
    };

    getPayInUrlDao.mockResolvedValueOnce(mockPayIn);

    const result = await getPayInUrlService('123', {}, true);

    expect(getPayInUrlDao).toHaveBeenCalledWith({ merchant_order_id: '123' });
    expect(result).toEqual(mockPayIn);
    expect(updatePayInUrlDao).not.toHaveBeenCalled();
    expect(merchantPayinCallback).not.toHaveBeenCalled();
  });

  test('should throw NotFoundError when payIn is not found', async () => {
    getPayInUrlDao.mockResolvedValueOnce(null);

    await expect(getPayInUrlService('123', {})).rejects.toThrow(NotFoundError);

    expect(getPayInUrlDao).toHaveBeenCalledWith({ merchant_order_id: '123' });
    expect(updatePayInUrlDao).not.toHaveBeenCalled();
    expect(merchantPayinCallback).not.toHaveBeenCalled();
  });

  test('should return error and redirect URL when URL is expired and tele_check is true', async () => {
    const mockPayIn = {
      merchant_order_id: '123',
      config: { urls: { return: 'http://return.url', notify: 'http://notify.url' } },
      is_url_expires: true,
      one_time_used: false,
      expiration_date: 1629999999999,
      status: 'INITIATED',
      amount: 100,
      utr: 'utr123',
      id: 'payin1'
    };

    getPayInUrlDao.mockResolvedValueOnce(mockPayIn);

    const result = await getPayInUrlService('123', {}, true);

    expect(getPayInUrlDao).toHaveBeenCalledWith({ merchant_order_id: '123' });
    expect(result).toEqual({
      error: 'Url is expired',
      result: { redirect_url: 'http://return.url' }
    });
    expect(updatePayInUrlDao).not.toHaveBeenCalled();
    expect(merchantPayinCallback).not.toHaveBeenCalled();
  });

  test('should return error and redirect URL when one_time_used is true', async () => {
    const mockPayIn = {
      merchant_order_id: '123',
      config: { urls: { return: 'http://return.url', notify: 'http://notify.url' } },
      is_url_expires: true,
      one_time_used: true,
      expiration_date: 1630000001000,
      status: 'INITIATED',
      amount: 100,
      utr: 'utr123',
      id: 'payin1'
    };
  
    getPayInUrlDao.mockResolvedValueOnce(mockPayIn);
  
    const result = await getPayInUrlService('123', {}, true);
  
    expect(getPayInUrlDao).toHaveBeenCalledWith({ merchant_order_id: '123' });
    expect(result).toEqual({
      error: 'Url is expired',
      result: { redirect_url: 'http://return.url' }
    });
    expect(updatePayInUrlDao).not.toHaveBeenCalled();
    expect(merchantPayinCallback).not.toHaveBeenCalled();
  });

  test('should update payIn and notify merchant when URL is expired and status is not INITIATED', async () => {
    const mockPayIn = {
      merchant_order_id: '123',
      config: { urls: { notify: 'http://notify.url', return: 'http://return.url' } },
      is_url_expires: false,
      one_time_used: false,
      expiration_date: 1629999999999, 
      status: 'PENDING',
      amount: 100,
      utr: 'utr123',
      id: 'payin1'
    };

    getPayInUrlDao.mockResolvedValueOnce(mockPayIn);
    updatePayInUrlDao.mockResolvedValueOnce();
    merchantPayinCallback.mockResolvedValueOnce();

    await getPayInUrlService('123', {});

    expect(getPayInUrlDao).toHaveBeenCalledWith({ merchant_order_id: '123' });
    expect(updatePayInUrlDao).toHaveBeenCalledWith(
      '123',
      {
        is_url_expires: true,
        status: 'DROPPED'
      },
      {}
    );
    expect(merchantPayinCallback).toHaveBeenCalledWith('http://notify.url', {
      status: 'DROPPED',
      merchantOrderId: '123',
      payinId: 'payin1',
      amount: null,
      req_amount: 100,
      utr_id: 'utr123'
    });
  });

  test('should skip expiration check when tele_check is false', async () => {
    const mockPayIn = {
      merchant_order_id: '123',
      config: { urls: { return: 'http://return.url', notify: 'http://notify.url' } },
      is_url_expires: true,
      one_time_used: true,
      expiration_date: 1629999999999,
      status: 'INITIATED',
      amount: 100,
      utr: 'utr123',
      id: 'payin1'
    };

    getPayInUrlDao.mockResolvedValueOnce(mockPayIn);

    const result = await getPayInUrlService('123', {}, false);

    expect(getPayInUrlDao).toHaveBeenCalledWith({ merchant_order_id: '123' });
    expect(result).toEqual(mockPayIn);
    expect(updatePayInUrlDao).not.toHaveBeenCalled();
    expect(merchantPayinCallback).not.toHaveBeenCalled();
  });

  test('should log error and rethrow when an error occurs', async () => {
    const error = new Error('Database error');
    getPayInUrlDao.mockRejectedValueOnce(error);

    await expect(getPayInUrlService('123', {})).rejects.toThrow('Database error');
    expect(getPayInUrlDao).toHaveBeenCalledWith({ merchant_order_id: '123' });
    expect(updatePayInUrlDao).not.toHaveBeenCalled();
    expect(merchantPayinCallback).not.toHaveBeenCalled();
  });
});






 