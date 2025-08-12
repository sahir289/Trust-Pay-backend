import {
  generateHashForPayIn,
  generatePayInUrl,
  validatePayInUrl,
} from './payInController.js';
import * as payInService from './payInService.js';
import * as schemas from '../../schemas/payInSchema.js';
import * as helpers from '../../helpers/index.js';
import * as responseHandlers from '../../utils/responseHandlers.js';
import {  ValidationError } from '../../utils/appErrors.js';
import { createHash, compareHash } from '../../utils/hashUtils.js';
import config from '../../config/config.js';

jest.mock('./payInService.js');
jest.mock('../../schemas/payInSchema.js');
jest.mock('../../helpers/index.js');
jest.mock('../../utils/responseHandlers.js');
jest.mock('@aws-sdk/client-s3');
jest.mock('../../helpers/Aws.js');
jest.mock('../../utils/hashUtils.js');
jest.mock('../merchants/merchantDao.js', () => ({
  getMerchantByCodeAndApiKey: jest.fn(),
  getMerchantsDao: jest.fn(),
}));
jest.mock('../company/companyDao.js', () => ({
  getCompanyByIDDao: jest.fn(),
}));
jest.mock('../bankAccounts/bankaccountDao.js', () => ({
  getMerchantBankDao: jest.fn(),
}));
jest.mock('../../utils/sendTelegramMessages.js', () => ({
  sendBankNotAssignedAlertTelegram: jest.fn(),
}));
jest.mock('../../utils/db.js', () => ({
  transactionWrapper: jest.fn((fn) => fn),
}));

describe('PayIn Controller', () => {
  let req, res;

  beforeEach(() => {
    req = {
      params: {},
      query: {},
      body: {},
      headers: {},
      file: undefined,
      user: { user_id: 'user123', company_id: 'comp123', user_name: 'testuser' },
      user_location: '127.0.0.1',
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    jest.clearAllMocks();
  });

  describe('generateHashForPayIn', () => {
    it('should return success response when service succeeds', async () => {
      const mockResult = { id: 'abc123' };
      payInService.generatePayInUrlByHashService.mockResolvedValue(mockResult);

      await generateHashForPayIn(req, res);

      expect(responseHandlers.sendSuccess).toHaveBeenCalledWith(
        res,
        mockResult,
        'PayIn hash generated successfully',
      );
    });

    it('should return error response when service returns 400 or 404', async () => {
      const mockError = { status: 400, message: 'Bad Request' };
      payInService.generatePayInUrlByHashService.mockResolvedValue(mockError);

      await generateHashForPayIn(req, res);

      expect(responseHandlers.sendError).toHaveBeenCalledWith(
        res,
        mockError.message,
        mockError.status,
      );
    });
  });

  describe('generatePayInUrl', () => {
    beforeEach(() => {
      schemas.ASSIGN_PAYIN_SCHEMA.validate = jest.fn(() => ({ error: null }));
      payInService.generatePayInUrlService.mockResolvedValue({
        expiration_date: '2025-01-01',
        merchant_order_id: 'order123',
        id: 'payin123',
        status: 200,
      });
      helpers.decodeAuthToken.mockReturnValue({ user_id: 'user123' });
      createHash.mockReturnValue('hashedcode');
      compareHash.mockReturnValue(true);
      const { getMerchantByCodeAndApiKey, getMerchantsDao } = require('../merchants/merchantDao.js');
      getMerchantByCodeAndApiKey.mockResolvedValue({
        company_id: 'comp123',
        config: { keys: { public: 'publickey' } },
      });
      getMerchantsDao.mockResolvedValue([
        { id: 'merchantid', company_id: 'comp123', user_id: 'user123' },
      ]);
      const { getCompanyByIDDao } = require('../company/companyDao.js');
      getCompanyByIDDao.mockResolvedValue([
        {
          config: {
            telegramBankAlertChatId: 'chatid',
            telegramBotToken: 'token',
          },
        },
      ]);
      const { getMerchantBankDao } = require('../bankAccounts/bankaccountDao.js');
      getMerchantBankDao.mockResolvedValue([
        { is_enabled: true, config: { is_phonepay: true } },
      ]);
      config.reactPaymentOrigin = 'https://example.com';
    });

    it('should throw ValidationError if validation fails', async () => {
      schemas.ASSIGN_PAYIN_SCHEMA.validate.mockReturnValueOnce({
        error: {
          details: [{ message: 'Invalid payload' }],
        },
      });

      await expect(generatePayInUrl(req, res)).rejects.toThrow(ValidationError);
    });

    it('should return error if API key is missing', async () => {
      req.query = { code: 'code123' };
      req.headers = {};

      await generatePayInUrl(req, res);

      expect(responseHandlers.sendError).toHaveBeenCalledWith(
        res,
        'Enter valid Api key',
        404,
      );
    });

    it('should return error if merchant is invalid', async () => {
      req.query = { code: 'code123', key: 'key123' };
      const { getMerchantByCodeAndApiKey } = require('../merchants/merchantDao.js');
      getMerchantByCodeAndApiKey.mockResolvedValue(null);

      await generatePayInUrl(req, res);

      expect(responseHandlers.sendError).toHaveBeenCalledWith(
        res,
        'Invalid merchant code or API key',
        400,
      );
    });

    it('should return error if bank not assigned', async () => {
      req.query = {
        code: 'code123',
        key: 'key123',
        amount: '100',
        currency: 'USD',
        merchant_order_id: 'order123',
        hash_code: 'validhash',
      };
      const { getMerchantBankDao } = require('../bankAccounts/bankaccountDao.js');
      getMerchantBankDao.mockResolvedValue([]);
      const { sendBankNotAssignedAlertTelegram } = require('../../utils/sendTelegramMessages.js');
      sendBankNotAssignedAlertTelegram.mockResolvedValue();

      await generatePayInUrl(req, res);

      expect(responseHandlers.sendError).toHaveBeenCalledWith(
        res,
        'Bank Account has not been linked with Merchant',
        404,
      );
      expect(sendBankNotAssignedAlertTelegram).toHaveBeenCalledWith(
        'chatid',
        'code123',
        'token',
      );
    });

    it('should return success with generated payin url', async () => {
      req.query = { code: 'validCode', key: 'validApiKey', fromUi: false };
      req.headers = { 'x-api-key': 'validApiKey', authorization: 'validToken' };
      req.ip = '127.0.0.1';

      await generatePayInUrl(req, res);

      expect(responseHandlers.sendNewSuccess).toHaveBeenCalledWith(
        res,
        expect.objectContaining({
          payInUrl: expect.stringContaining('hashedcode'),
          payinId: 'payin123',
          merchantOrderId: 'order123',
          status: 200,
        }),
        'PayIn is generated & url is sent successfully',
      );
    });

    it('should return error if hash code does not match', async () => {
      req.query = { code: 'validCode', key: 'validApiKey', hash_code: 'invalidHash' };
      req.headers = { 'x-api-key': 'validApiKey' };
      compareHash.mockReturnValue(false);

      await generatePayInUrl(req, res);

      expect(responseHandlers.sendError).toHaveBeenCalledWith(
        res,
        'Hash code does not match',
        400,
      );
    });
  });

  describe('validatePayInUrl', () => {
    it('should throw ValidationError if validation fails', async () => {
      schemas.VALIDATE_PAYIN_SCHEMA.validate.mockReturnValue({
        error: { details: [{ message: 'Validation error' }] },
      });
      req.params = { merchantOrderId: 'order123' };

      await expect(validatePayInUrl(req, res)).rejects.toThrow(ValidationError);
    });

    it('should send success if verifyPayinsService returns', async () => {
      schemas.VALIDATE_PAYIN_SCHEMA.validate.mockReturnValue({ error: null });
      payInService.verifyPayinsService.mockResolvedValue({ status: 'valid' });
      req.params = { merchantOrderId: 'order123' };
      req.query = { isReload: 'true' };
      req.user_location = 'loc';

      await validatePayInUrl(req, res);

      expect(responseHandlers.sendSuccess).toHaveBeenCalledWith(
        res,
        expect.objectContaining({ status: 'valid', merchant_order_id: 'order123' }),
        'Payment Url is correct',
      );
    });
  });
});