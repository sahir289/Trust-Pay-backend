const { zenTechIndWebhook } = require('./zenTechInd');
const { transactionWrapper } = require('../../utils/db');
const { logger } = require('../../utils/logger');
const { sendSuccess } = require('../../utils/responseHandlers');
const { createBankResponseWebHookService } = require('../bankResponse/bankResponseServices');
const { getPayInIntentDao } = require('../payIn/payInDao');
const { processPayInWebHookService } = require('../payIn/payInService');
const { generateHash } = require('../../zentechind/zentechInd');

jest.mock('../../utils/db');
jest.mock('../../utils/logger');
jest.mock('../../utils/responseHandlers');
jest.mock('../bankResponse/bankResponseServices');
jest.mock('../payIn/payInDao');
jest.mock('../payIn/payInService');
jest.mock('../../zentechind/zentechInd');
jest.mock('../../../version', () => ({
  getVersion: jest.fn()
}));

describe('zenTechIndWebhook', () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {
        transaction: {
          order_id: '12345',
          utr: 'UTR123',
          amount: '1000',
          status: 'success',
          hash: 'validHash',
        },
      },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    sendSuccess.mockClear();
    logger.error.mockClear();
    logger.info.mockClear();
    generateHash.mockClear();
    getPayInIntentDao.mockClear();
    createBankResponseWebHookService.mockClear();
    processPayInWebHookService.mockClear();
    transactionWrapper.mockClear();
  });

  test('should process webhook successfully with valid hash and status success', async () => {
    const mockPayIn = { bank_acc_id: 'bank123', company_id: 'comp123' };
    const mockBankResponse = { id: 'bankResponse123' };
    const mockPayInProcessed = { id: 'payIn123' };

    generateHash.mockReturnValue('validHash');
    getPayInIntentDao.mockResolvedValue(mockPayIn);
    createBankResponseWebHookService.mockResolvedValue(mockBankResponse);
    processPayInWebHookService.mockResolvedValue(mockPayInProcessed);
    transactionWrapper.mockImplementation((fn) => async (...args) => await fn(...args));

    await zenTechIndWebhook(req, res);

    expect(sendSuccess).toHaveBeenCalledWith(res, 200, 'Webhook received successfully');
    expect(generateHash).toHaveBeenCalledWith(req.body.transaction);
    expect(getPayInIntentDao).toHaveBeenCalledWith('12345');
    expect(createBankResponseWebHookService).toHaveBeenCalledWith(
      '1000 nil UTR123 bank123',
      'comp123',
      'BOT',
      'zenTechInd'
    );
    expect(logger.info).toHaveBeenCalledWith('Bank response created:', mockBankResponse);
    expect(transactionWrapper).toHaveBeenCalledWith(processPayInWebHookService);
    expect(processPayInWebHookService).toHaveBeenCalledWith(
      {
        merchantOrderId: '12345',
        userSubmittedUtr: 'UTR123',
        amount: 1000,
        status: 'success',
      },
      ''
    );
    expect(logger.info).toHaveBeenCalledWith('PayIn processed:', mockPayInProcessed);
  });

  test('should log error and return early if hash is invalid', async () => {
    generateHash.mockReturnValue('invalidHash');

    await zenTechIndWebhook(req, res);

    expect(sendSuccess).toHaveBeenCalledWith(res, 200, 'Webhook received successfully');
    expect(generateHash).toHaveBeenCalledWith(req.body.transaction);
    expect(logger.error).toHaveBeenCalledWith('Invalid hash in ZenTechInd webhook');
  });

  test('should handle errors gracefully and log them', async () => {
    const error = new Error('Database error');
    generateHash.mockReturnValue('validHash');
    getPayInIntentDao.mockRejectedValue(error);

    await zenTechIndWebhook(req, res);

    expect(sendSuccess).toHaveBeenCalledWith(res, 200, 'Webhook received successfully');
    expect(generateHash).toHaveBeenCalledWith(req.body.transaction);
    expect(logger.error).toHaveBeenCalledWith('zenTechInd webhook error:', error);
    expect(getPayInIntentDao).toHaveBeenCalledWith('12345');
    expect(createBankResponseWebHookService).not.toHaveBeenCalled();
    expect(processPayInWebHookService).not.toHaveBeenCalled();
  });

  test('should not call createBankResponseWebHookService if status is not success', async () => {
    req.body.transaction.status = 'failed';
    generateHash.mockReturnValue('validHash');
    getPayInIntentDao.mockResolvedValue({ bank_acc_id: 'bank123', company_id: 'comp123' });
    processPayInWebHookService.mockResolvedValue({ id: 'payIn123' });
    transactionWrapper.mockImplementation((fn) => async (...args) => await fn(...args));

    await zenTechIndWebhook(req, res);

    expect(sendSuccess).toHaveBeenCalledWith(res, 200, 'Webhook received successfully');
    expect(createBankResponseWebHookService).not.toHaveBeenCalled();
    expect(processPayInWebHookService).toHaveBeenCalledWith(
      {
        merchantOrderId: '12345',
        userSubmittedUtr: 'UTR123',
        amount: 1000,
        status: 'failed',
      },
      ''
    );
  });
});
