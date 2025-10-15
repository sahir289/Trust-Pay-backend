import { clickrrWebhook } from './clickrr'; 
import { Method } from '../../constants/index.js';
import { NotFoundError } from '../../utils/appErrors.js';
import { beginTransaction, getConnection, rollback } from '../../utils/db.js';
import { logger } from '../../utils/logger.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { getCompanyIdByMerchantOrderIdDao } from '../payOut/payOutDao.js';
import { updatePayoutService } from '../payOut/payOutService.js';

jest.mock('../../utils/db.js', () => ({
  beginTransaction: jest.fn(),
  getConnection: jest.fn(),
  rollback: jest.fn(),
}));

jest.mock('../../utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../../utils/responseHandlers.js', () => ({
  sendSuccess: jest.fn(),
}));

jest.mock('../payOut/payOutDao.js', () => ({
  getCompanyIdByMerchantOrderIdDao: jest.fn(),
}));

jest.mock('../payOut/payOutService.js', () => ({
  updatePayoutService: jest.fn(),
}));

describe('clickrrWebhook', () => {
  let mockReq;
  let mockRes;
  let mockConn;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = {
      body: {
        referenceId: 'test-merchant-order-id',
        txnStatus: 'SUCCESS',
        utr: 'test-utr',
        config: { someConfig: 'value' },
      },
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockConn = {
      release: jest.fn(),
    };
    getConnection.mockResolvedValue(mockConn);
    beginTransaction.mockResolvedValue();
    rollback.mockResolvedValue();
    sendSuccess.mockImplementation((res, data, message) => {
      res.status(200).json({ success: true, data, message });
    });
  });

  it('should handle successful webhook with valid payload and company details', async () => {
    const mockCompanyDetails = { id: 123, company_id: 456 };
    getCompanyIdByMerchantOrderIdDao.mockResolvedValue(mockCompanyDetails);
    updatePayoutService.mockResolvedValue({ success: true });

    await clickrrWebhook(mockReq, mockRes);

    expect(sendSuccess).toHaveBeenCalledWith(mockRes, {}, 'Webhook received successfully');
    expect(getConnection).toHaveBeenCalled();
    expect(beginTransaction).toHaveBeenCalledWith(mockConn);
    expect(getCompanyIdByMerchantOrderIdDao).toHaveBeenCalledWith('test-merchant-order-id');
    expect(logger.info).toHaveBeenCalledWith('Payout updated from Clickrr webhook:', mockReq.body);
    expect(updatePayoutService).toHaveBeenCalledWith(mockConn, { id: 123, company_id: 456 }, {
      txnStatus: 'SUCCESS',
      utr_id: 'test-utr',
      config: {
        someConfig: 'value',
        method: Method.CLICKRR,
      },
    });
    expect(logger.info).toHaveBeenCalledWith('Payout processed:', { success: true });
    expect(mockConn.release).toHaveBeenCalled();
  });

  it('should throw NotFoundError and rollback when company details not found', async () => {
    getCompanyIdByMerchantOrderIdDao.mockResolvedValue(null);

    await clickrrWebhook(mockReq, mockRes);

    expect(sendSuccess).toHaveBeenCalledWith(mockRes, {}, 'Webhook received successfully');
    expect(getConnection).toHaveBeenCalled();
    expect(beginTransaction).toHaveBeenCalledWith(mockConn);
    expect(getCompanyIdByMerchantOrderIdDao).toHaveBeenCalledWith('test-merchant-order-id');
    expect(logger.error).toHaveBeenCalledWith('Clickrr webhook error:', expect.any(NotFoundError));
    expect(rollback).toHaveBeenCalledWith(mockConn);
    expect(logger.error).toHaveBeenCalledWith('Transaction rolled back due to error:', expect.any(NotFoundError));
    expect(mockConn.release).toHaveBeenCalled();
    expect(updatePayoutService).not.toHaveBeenCalled();
  });

  it('should handle error in updatePayoutService and rollback transaction', async () => {
    const mockCompanyDetails = { id: 123, company_id: 456 };
    getCompanyIdByMerchantOrderIdDao.mockResolvedValue(mockCompanyDetails);
    const mockError = new Error('Update failed');
    updatePayoutService.mockRejectedValue(mockError);

    await clickrrWebhook(mockReq, mockRes);

    expect(sendSuccess).toHaveBeenCalledWith(mockRes, {}, 'Webhook received successfully');
    expect(getConnection).toHaveBeenCalled();
    expect(beginTransaction).toHaveBeenCalledWith(mockConn);
    expect(getCompanyIdByMerchantOrderIdDao).toHaveBeenCalledWith('test-merchant-order-id');
    expect(logger.info).toHaveBeenCalledWith('Payout updated from Clickrr webhook:', mockReq.body);
    expect(updatePayoutService).toHaveBeenCalledWith(mockConn, { id: 123, company_id: 456 }, expect.any(Object));
    expect(logger.error).toHaveBeenCalledWith('Clickrr webhook error:', mockError);
    expect(rollback).toHaveBeenCalledWith(mockConn);
    expect(logger.error).toHaveBeenCalledWith('Transaction rolled back due to error:', mockError);
    expect(mockConn.release).toHaveBeenCalled();
  });

it('should handle rollback failure and log it', async () => {
    const mockCompanyDetails = { id: 123, company_id: 456 };
    getCompanyIdByMerchantOrderIdDao.mockResolvedValue(mockCompanyDetails);
    const mockError = new Error('Update failed');
    const mockRollbackError = new Error('Rollback failed');
    updatePayoutService.mockRejectedValue(mockError);
    rollback.mockRejectedValue(mockRollbackError);

    await clickrrWebhook(mockReq, mockRes);

    expect(sendSuccess).toHaveBeenCalledWith(mockRes, {}, 'Webhook received successfully');
    expect(getConnection).toHaveBeenCalled();
    expect(beginTransaction).toHaveBeenCalledWith(mockConn);
    expect(getCompanyIdByMerchantOrderIdDao).toHaveBeenCalledWith('test-merchant-order-id');
    expect(logger.info).toHaveBeenCalledWith('Payout updated from Clickrr webhook:', mockReq.body);
    expect(updatePayoutService).toHaveBeenCalledWith(mockConn, { id: 123, company_id: 456 }, expect.any(Object));
    expect(logger.error).toHaveBeenCalledWith('Clickrr webhook error:', mockError);
    expect(rollback).toHaveBeenCalledWith(mockConn);
    expect(logger.error).toHaveBeenCalledWith('Rollback failed:', mockRollbackError);
    expect(mockConn.release).toHaveBeenCalled();
  });

  it('should handle missing payload fields gracefully', async () => {
    mockReq.body = { referenceId: 'test-merchant-order-id' };
    const mockCompanyDetails = { id: 123, company_id: 456 };
    getCompanyIdByMerchantOrderIdDao.mockResolvedValue(mockCompanyDetails);
    updatePayoutService.mockResolvedValue({ success: true });

    await clickrrWebhook(mockReq, mockRes);

    expect(updatePayoutService).toHaveBeenCalledWith(mockConn, { id: 123, company_id: 456 }, {
      txnStatus: undefined,
      utr_id: undefined,
      config: {
        method: Method.CLICKRR,
      },
    });
  });

  it('should release connection even if getConnection fails', async () => {
    getConnection.mockRejectedValue(new Error('Connection failed'));

    await clickrrWebhook(mockReq, mockRes);

    expect(sendSuccess).toHaveBeenCalledWith(mockRes, {}, 'Webhook received successfully');
    expect(getConnection).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith('Clickrr webhook error:', new Error('Connection failed'));
    expect(mockConn.release).not.toHaveBeenCalled();
  });
});
