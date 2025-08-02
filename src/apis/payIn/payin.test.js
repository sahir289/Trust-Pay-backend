const { generatePayInUrlByHashService, generatePayInUrlService } = require('./payInService.js');
const { getMerchantsByCodeDao, getMerchantBankDao, getCompanyByIDDao } = require('../merchants/merchantDao.js');
const { sendBankNotAssignedAlertTelegram } = require('../../utils/sendTelegramMessages.js');
const { createHash } = require('../../utils/bcryptPassword.js');

jest.mock('../merchants/merchantDao.js', () => ({
    getMerchantsByCodeDao: jest.fn(),
    getMerchantBankDao: jest.fn(),
}));
jest.mock('../../utils/sendTelegramMessages.js');
jest.mock('../../utils/bcryptPassword.js');
jest.mock('../../utils/bcryptPassword.js', () => ({
    reactPaymentOrigin: 'http://localhost:8090',
}));



//----------------------generatePayinHash---------------------------------
describe('generatePayInUrlByHashService', () => {
  let mockConn;
  let mockReq;

  beforeEach(() => {
      mockConn = {};   //mocked version of a database connection
      mockReq = {       //mocked request object
          query: {},
          headers: { 'x-api-key': 'test-api-key' },
      };
      jest.clearAllMocks();
  });

  test('should return 400 if required query parameters are missing', async () => {
    //explicitly missing few paramaters to test the error handling
      mockReq.query = { user_id: '123',
        code: 'MERCHANT123',
        };   //payload of actual api

      const result = await generatePayInUrlByHashService(mockConn, mockReq);

      expect(result).toEqual({
          status: 400,
          message: 'Missing required query parameters: user_id, code, or ot',
      });
  });

  test('should return 404 if no merchant found for code', async () => {
      mockReq.query = { user_id: '123', code: 'MERCH1', ot: 'y' };
      getMerchantsByCodeDao.mockResolvedValue([]);

      const result = await generatePayInUrlByHashService(mockConn, mockReq);

      expect(result).toEqual({
          status: 404,
          message: 'Bank Account has not been linked with Merchant',
      });
      expect(getMerchantsByCodeDao).toHaveBeenCalledWith('MERCH1');
  });
  
  test('should return 404 if no merchant found for code', async () => {
    mockReq.query = { user_id: '123', code: 'MERCH1', ot: 'y' };
    getMerchantsByCodeDao.mockResolvedValue([]);

    const result = await generatePayInUrlByHashService(mockConn, mockReq);

    expect(result).toEqual({
      status: 404,
      message: 'Bank Account has not been linked with Merchant',
    });
    expect(getMerchantsByCodeDao).toHaveBeenCalledWith('MERCH1');
  });

  //telegram 
  test('should return 404 and send telegram alert if no bank assigned', async () => {
    mockReq.query = { user_id: '123', code: 'MERCH1', ot: 'y' };
    getMerchantsByCodeDao.mockResolvedValue([{ id: 1, company_id: 100, user_id: '123' }]);
    getCompanyByIDDao.mockResolvedValue([{ config: { telegramBankAlertChatId: 'chat123', telegramBotToken: 'token123' } }]);
    getMerchantBankDao.mockResolvedValue([]);

    const result = await generatePayInUrlByHashService(mockConn, mockReq);

    expect(result).toEqual({
      status: 404,
      message: 'Bank Account has not been linked with Merchant',
    });
    expect(getMerchantBankDao).toHaveBeenCalledWith({ config_merchants_contains: 1 });
    expect(sendBankNotAssignedAlertTelegram).toHaveBeenCalledWith('chat123', 'MERCH1', 'token123');
  });

  test('should return 404 and send telegram alert if all banks are disabled', async () => {
    mockReq.query = { user_id: '123', code: 'MERCH1', ot: 'y' };
    getMerchantsByCodeDao.mockResolvedValue([{ id: 1, company_id: 100, user_id: '123' }]);
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
    getMerchantsByCodeDao.mockResolvedValue([{ id: 1, company_id: 100, user_id: '123' }]);
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
    mockReq.query = { user_id: '123', code: 'MERCH1', ot: 'y', key: 'key123', amount: '1000' };
    getMerchantsByCodeDao.mockResolvedValue([{ id: 1, company_id: 100, user_id: '123' }]);
    getCompanyByIDDao.mockResolvedValue([{ config: { telegramBankAlertChatId: 'chat123', telegramBotToken: 'token123' } }]);
    getMerchantBankDao.mockResolvedValue([{ is_enabled: true, config: { is_phonepay: true }, is_qr: true, is_bank: true }]);
    createHash.mockReturnValue('testHash123');

    const result = await generatePayInUrlByHashService(mockConn, mockReq);

    expect(result).toEqual({
      payInUrl: 'http://localhost:8090/transaction/testHash123?user_id=123&code=MERCH1&ot=y123&key=key123&amount=1000',
    });
    expect(createHash).toHaveBeenCalledWith('MERCH1:key123');
  });

  test('should generate payInUrl without amount in query parameters', async () => {
    mockReq.query = { user_id: '123', code: 'MERCH1', ot: 'y', key: 'key123' };
    getMerchantsByCodeDao.mockResolvedValue([{ id: 1, company_id: 100, user_id: '123' }]);
    getCompanyByIDDao.mockResolvedValue([{ config: { telegramBankAlertChatId: 'chat123', telegramBotToken: 'token123' } }]);
    getMerchantBankDao.mockResolvedValue([{ is_enabled: true, config: { is_phonepay: true }, is_qr: true, is_bank: true }]);
    createHash.mockReturnValue('testHash123');

    const result = await generatePayInUrlByHashService(mockConn, mockReq);

    expect(result).toEqual({
      payInUrl: 'http://localhost:8090/transaction/testHash123?user_id=123&code=MERCH1&ot=y123&key=key123',
    });
    expect(createHash).toHaveBeenCalledWith('MERCH1:key123');
  });

});

//----------------------generatePayin---------------------------------

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
    mockReq.query = { user_id: '123' };

    const result = await generatePayInUrlService(mockConn, mockReq);

    expect(result).toEqual({
      status: 400,
      message: 'Missing required query parameters: user_id, code, or ot',
    });
  });
})


