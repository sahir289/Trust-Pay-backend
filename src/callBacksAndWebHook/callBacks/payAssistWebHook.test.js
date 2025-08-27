import { payAssistTransactionStatusCallback } from '../../callBacksAndWebHook/callBacks/payAsistWebHook.js';
import {
  getPayoutsDao,
} from '../../apis/payOut/payOutDao.js';
import { getCompanyByIDDao } from '../../apis/company/companyDao.js';
import { getBankByIdDao } from '../../apis/bankAccounts/bankaccountDao.js';
import { getVendorsDao } from '../../apis/vendors/vendorDao.js';
import { getUserByCompanyCreatedAtDao } from '../../apis/users/userDao.js';
import { updatePayoutService } from '../../apis/payOut/payOutService.js';
import { beginTransaction, commit, rollback, getConnection } from '../../utils/db.js';
import axios from 'axios';
import { NotFoundError } from '../../utils/appErrors.js';
// import { Status, Role, payAssistErrorCodeMap } from '../../constants/index.js';
import { logger } from '../../utils/logger.js';

jest.mock('../../apis/payOut/payOutDao.js');
jest.mock('../../apis/company/companyDao.js');
jest.mock('../../apis/bankAccounts/bankaccountDao.js');
jest.mock('../../apis/vendors/vendorDao.js');
jest.mock('../../apis/users/userDao.js');
jest.mock('../../apis/payOut/payOutService.js');
jest.mock('../../utils/db.js');
jest.mock('axios');
jest.mock('../../utils/logger.js');

describe('payAssistTransactionStatusCallback', () => {
  let req, res, conn;

  beforeEach(() => {
    req = { body: {} };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    conn = { release: jest.fn() };
    getConnection.mockResolvedValue(conn);
    beginTransaction.mockResolvedValue();
    commit.mockResolvedValue();
    rollback.mockResolvedValue();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return NotFoundError if payout not found', async () => {
    getPayoutsDao.mockResolvedValue(null);
    req.body = { Response: { apitxnid: 1 } };
  
    const result = await payAssistTransactionStatusCallback(req, res);
  
    expect(result).toBeInstanceOf(NotFoundError);  // checks the type
    expect(result.message).toBe('Payment not found'); // checks the message
    expect(conn.release).toHaveBeenCalled();
  });
  
  

  it('should handle approved payout successfully', async () => {
    req.body = { Response: { apitxnid: 1 }, ErrorCode: '0' }; // Add ErrorCode
    getPayoutsDao.mockResolvedValue({ id: 1, company_id: 100 });
    getCompanyByIDDao.mockResolvedValue([{
      config: {
        PAY_ASSIST: {
          walletsPayoutsAgent: 'agent',
          walletsPayoutsApiKey: 'key',
          walletsPayoutsUrl: 'url',
          walletsPayoutsAgentCode: 'code',
          defaultBankId: 10,
        }
      }
    }]);
    getBankByIdDao.mockResolvedValue([{ user_id: 200 }]);
    getVendorsDao.mockResolvedValue([{ id: 300 }]);
    getUserByCompanyCreatedAtDao.mockResolvedValue({ id: 400 });
    axios.post.mockResolvedValue({ data: { ErrorCode: '0', Response: { txnid: 'tx123', message: 'Success' } } });
    updatePayoutService.mockResolvedValue();
  
    const result = await payAssistTransactionStatusCallback(req, res);
  
    expect(updatePayoutService).toHaveBeenCalled();
    expect(commit).toHaveBeenCalledWith(conn);
    expect(conn.release).toHaveBeenCalled();
    expect(result).toBe('Payout Updated Successfully');
  });
  

  it('should handle payout with errorCode "TUP" as pending', async () => {
    req.body = { Response: { apitxnid: 1 }, ErrorCode: 'TUP' };

    getPayoutsDao.mockResolvedValue({ id: 1, company_id: 100 });
    getCompanyByIDDao.mockResolvedValue([{
      config: {
        PAY_ASSIST: {
          walletsPayoutsAgent: 'agent',
          walletsPayoutsApiKey: 'key',
          walletsPayoutsUrl: 'url',
          walletsPayoutsAgentCode: 'code',
          defaultBankId: 10,
        }
      }
    }]);
    getBankByIdDao.mockResolvedValue([{ user_id: 200 }]);
    getVendorsDao.mockResolvedValue([{ id: 300 }]);
    getUserByCompanyCreatedAtDao.mockResolvedValue({ id: 400 });
    axios.post.mockResolvedValue({ data: { ErrorCode: 'TUP', Response: { txnid: 'tx123' } } });
    updatePayoutService.mockResolvedValue();

    const result = await payAssistTransactionStatusCallback(req, res);

    expect(updatePayoutService).toHaveBeenCalled();
    expect(commit).toHaveBeenCalledWith(conn);
    expect(conn.release).toHaveBeenCalled();
    expect(result).toBe('Payout Updated Successfully');
  });

  it('should rollback on error', async () => {
    req.body = { Response: { apitxnid: 1 } };
    getPayoutsDao.mockRejectedValue(new Error('DB error'));

    await payAssistTransactionStatusCallback(req, res);

    expect(rollback).toHaveBeenCalledWith(conn);
    expect(conn.release).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });
});
