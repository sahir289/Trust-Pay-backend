import { payAssistTransactionStatusCallback } from '../../callBacksAndWebHook/callBacks/payAsistWebHook.js';
import { getPayoutsDao } from '../../apis/payOut/payOutDao.js';
import { getCompanyByIDDao } from '../../apis/company/companyDao.js';
import { getBankByIdDao } from '../../apis/bankAccounts/bankaccountDao.js';
import { getVendorsDao } from '../../apis/vendors/vendorDao.js';
import { getUserByCompanyCreatedAtDao } from '../../apis/users/userDao.js';
import { updatePayoutService } from '../../apis/payOut/payOutService.js';
import { beginTransaction, commit, rollback, getConnection } from '../../utils/db.js';
import axios from 'axios';
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
    res = { status: jest.fn().mockReturnThis(), send: jest.fn() };
    conn = { release: jest.fn() };
    getConnection.mockResolvedValue(conn);
    beginTransaction.mockResolvedValue();
    commit.mockResolvedValue();
    rollback.mockResolvedValue();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return NotFoundError if apitxnid is missing or empty', async () => {
    req.body = { Response: {} }; // Missing apitxnid

    await payAssistTransactionStatusCallback(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith('Payment not found');
    expect(conn.release).not.toHaveBeenCalled(); // No connection acquired yet
  });

  it('should return NotFoundError if payout not found', async () => {
    req.body = { Response: { apitxnid: 1 } };
    getPayoutsDao.mockResolvedValue([]); // Simulate no payout found

    await payAssistTransactionStatusCallback(req, res);

    expect(getPayoutsDao).toHaveBeenCalledWith({ id: 1 });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith('Payment not found');
    expect(conn.release).toHaveBeenCalled();
  });

  it('should handle approved payout successfully', async () => {
    req.body = { Response: { apitxnid: 1, txnid: 'tx123' }, ErrorCode: '0' };
    getPayoutsDao.mockResolvedValue([{ id: 1, company_id: 100 }]);
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
    // Mock axios.post to return a successful payout status
    axios.post.mockResolvedValue({
      data: {
        ErrorCode: '0',
        Response: { txnid: 'tx123', message: 'Transaction Successful' }
      }
    });
    updatePayoutService.mockResolvedValue();
  
    await payAssistTransactionStatusCallback(req, res);
  
    expect(getPayoutsDao).toHaveBeenCalledWith({ id: 1 });
    expect(getCompanyByIDDao).toHaveBeenCalledWith({ id: 100 });
    expect(getBankByIdDao).toHaveBeenCalledWith({ id: 10 });
    expect(getVendorsDao).toHaveBeenCalledWith({ user_id: 200 });
    expect(getUserByCompanyCreatedAtDao).toHaveBeenCalledWith(100, 'ADMIN');
    expect(axios.post).toHaveBeenCalledWith(
      'url/payoutStatus',
      { apitxnid: 1 },
      { headers: { APIAGENT: 'agent', APIKEY: 'key' } }
    );
    expect(updatePayoutService).toHaveBeenCalledWith(
      conn,
      { id: 1, company_id: 100 },
      expect.objectContaining({
        bank_acc_id: 10,
        vendor_id: 300,
        config: expect.objectContaining({
          method: 'PayAssist',
          description: 'Payout processing via PayAssist',
          txnid: 'tx123',
        }),
        status: 'APPROVED',
        approved_at: expect.any(String),
      })
    );
    expect(commit).toHaveBeenCalledWith(conn);
    expect(conn.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith('Payout Updated Successfully');
  });

  it('should handle payout with errorCode "TUP" as pending', async () => {
    req.body = { Response: { apitxnid: 1 }, ErrorCode: 'TUP' };
    getPayoutsDao.mockResolvedValue([{ id: 1, company_id: 100 }]);
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

    await payAssistTransactionStatusCallback(req, res);

    expect(axios.post).toHaveBeenCalledWith(
      'url/payoutStatus',
      { apitxnid: 1 },
      { headers: { APIAGENT: 'agent', APIKEY: 'key' } }
    );
    expect(updatePayoutService).toHaveBeenCalledWith(
      conn,
      { id: 1, company_id: 100 },
      expect.objectContaining({
        bank_acc_id: 10,
        vendor_id: 300,
        config: expect.objectContaining({
          method: 'PayAssist',
          description: 'Payout processing via PayAssist',
          txnid: 'tx123',
        }),
        status: 'PENDING',
      })
    );
    expect(commit).toHaveBeenCalledWith(conn);
    expect(conn.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith('Payout Updated Successfully');
  });

  it('should handle failed payout with errorCode other than TUP or 4', async () => {
    req.body = { Response: { apitxnid: 1 }, ErrorCode: '14' };
    getPayoutsDao.mockResolvedValue([{ id: 1, company_id: 100 }]);
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
    axios.post.mockResolvedValue({ data: { ErrorCode: '14', Response: { txnid: 'tx123' } } });
    updatePayoutService.mockResolvedValue();

    await payAssistTransactionStatusCallback(req, res);

    expect(axios.post).toHaveBeenCalledWith(
      'url/payoutStatus',
      { apitxnid: 1 },
      { headers: { APIAGENT: 'agent', APIKEY: 'key' } }
    );
    expect(updatePayoutService).toHaveBeenCalledWith(
      conn,
      { id: 1, company_id: 100 },
      expect.objectContaining({
        bank_acc_id: 10,
        vendor_id: 300,
        config: expect.objectContaining({
          method: 'PayAssist',
          description: 'Payout processing via PayAssist',
          txnid: 'tx123',
          rejected_reason: expect.any(String),
        }),
        rejected_at: expect.any(String),
      })
    );
    expect(commit).toHaveBeenCalledWith(conn);
    expect(conn.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith('Payout Updated Successfully');
  });

  it('should handle error when company configuration not found', async () => {
    req.body = { Response: { apitxnid: '123' }, ErrorCode: '0' };
    getPayoutsDao.mockResolvedValue([{ id: '123', company_id: 100 }]);
    getCompanyByIDDao.mockResolvedValue([]);
  
    await expect(payAssistTransactionStatusCallback(req, res)).rejects.toThrow();
  
    expect(getPayoutsDao).toHaveBeenCalledWith({ id: '123' });
    expect(getCompanyByIDDao).toHaveBeenCalledWith({ id: 100 });
    expect(rollback).toHaveBeenCalledWith(conn);
    expect(conn.release).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith('getting error while updating payout', expect.any(Error));
  });

  it('should handle error when company configuration not found', async () => {
    req.body = { Response: { apitxnid: '123' }, ErrorCode: '0' };
    getPayoutsDao.mockResolvedValue([{ id: '123', company_id: 100 }]);
    getCompanyByIDDao.mockResolvedValue([]);
  
    await expect(payAssistTransactionStatusCallback(req, res)).rejects.toThrow(
      'Cannot read properties of undefined (reading \'config\')'
    );
  
    expect(getPayoutsDao).toHaveBeenCalledWith({ id: '123' });
    expect(getCompanyByIDDao).toHaveBeenCalledWith({ id: 100 });
    expect(rollback).toHaveBeenCalledWith(conn);
    expect(conn.release).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      'getting error while updating payout',
      expect.any(Error)
    );
  });
});