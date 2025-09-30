// tataPayTransactionStatusCallback.test.js
import axios from 'axios';
import { tataPayTransactionStatusCallback } from '../../callBacksAndWebHook/callBacks/tataPayWebHook.js';
import { getBankByIdDao } from '../../apis/bankAccounts/bankaccountDao.js';
import { getCompanyByIDDao } from '../../apis/company/companyDao.js';
import { getPayoutByTxnId } from '../../apis/payOut/payOutDao.js';
import { updatePayoutService } from '../../apis/payOut/payOutService.js';
import { getUserByCompanyCreatedAtDao } from '../../apis/users/userDao.js';
import { getVendorsDao } from '../../apis/vendors/vendorDao.js';
import { beginTransaction, commit, getConnection, rollback } from '../../utils/db.js';
import { logger } from '../../utils/logger.js';
import { Status } from '../../constants/index.js';

// Mock dependencies
jest.mock('axios');
jest.mock('../../apis/bankAccounts/bankaccountDao.js');
jest.mock('../../apis/company/companyDao.js');
jest.mock('../../apis/payOut/payOutDao.js');
jest.mock('../../apis/payOut/payOutService.js');
jest.mock('../../apis/users/userDao.js');
jest.mock('../../apis/vendors/vendorDao.js');
jest.mock('../../utils/db.js');
jest.mock('../../utils/logger.js');

describe('tataPayTransactionStatusCallback', () => {
  let req, res, conn;

  beforeEach(() => {
    // Mock request and response objects
    req = { body: { payoutId: '12345' } };
    res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };

    // Mock database connection
    conn = {
      release: jest.fn(),
    };
    getConnection.mockResolvedValue(conn);
    beginTransaction.mockResolvedValue();
    commit.mockResolvedValue();
    rollback.mockResolvedValue();

    // Mock logger
    logger.info = jest.fn();
    logger.error = jest.fn();

    // Reset mocks
    jest.clearAllMocks();
  });

  // Test Case 1: Missing payoutId in request body
  test('should return 404 if payoutId is missing', async () => {
    req.body = { payoutId: '' };

    await tataPayTransactionStatusCallback(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith('Payment not found');
    expect(getConnection).not.toHaveBeenCalled();
  });

  // Test Case 2: Payout not found in database
  test('should return 404 if payout is not found', async () => {
    getPayoutByTxnId.mockResolvedValue(null);

    await tataPayTransactionStatusCallback(req, res);

    expect(getPayoutByTxnId).toHaveBeenCalledWith('12345');
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith('Payment not found');
    expect(getConnection).toHaveBeenCalled();
    expect(conn.release).toHaveBeenCalled();
  });

  // Test Case 3: Successful payout update with approved status
  test('should update payout with approved status', async () => {
    const mockPayout = {
      id: 1,
      company_id: 'company1',
      status: Status.PENDING,
    };
    const mockCompany = [{
      id: 'company1',
      config: {
        TATA_PAY: {
          walletsPayoutsApiKey: 'apiKey',
          walletsPayoutsUrl: 'https://api.tatapay.com',
          defaultBankId: 'bank1',
        },
      },
    }];
    const mockBank = [{ user_id: 'user1' }];
    const mockVendor = [{ id: 'vendor1' }];
    const mockAdminUser = { id: 'admin1' };
    const mockAxiosResponse = {
      data: {
        payouts: [{
          status: 'approved',
          _id: 'txn123',
          utr: 'utr123',
        }],
      },
    };

    getPayoutByTxnId.mockResolvedValue(mockPayout);
    getCompanyByIDDao.mockResolvedValue(mockCompany);
    getBankByIdDao.mockResolvedValue(mockBank);
    getVendorsDao.mockResolvedValue(mockVendor);
    getUserByCompanyCreatedAtDao.mockResolvedValue(mockAdminUser);
    axios.get.mockResolvedValue(mockAxiosResponse);
    updatePayoutService.mockResolvedValue();

    await tataPayTransactionStatusCallback(req, res);

    expect(getPayoutByTxnId).toHaveBeenCalledWith('12345');
    expect(getCompanyByIDDao).toHaveBeenCalledWith({ id: mockPayout.company_id });
    expect(axios.get).toHaveBeenCalledWith(
      'https://api.tatapay.com/Search_payout',
      expect.objectContaining({
        headers: { 'x-api-key': 'apiKey' },
        params: { searchKey: '12345', page: 1, limit: 10 },
        timeout: 15000,
        maxRedirects: 3,
      }),
    );
    expect(updatePayoutService).toHaveBeenCalledWith(
      conn,
      { id: mockPayout.id, company_id: mockPayout.company_id },
      expect.objectContaining({
        status: Status.APPROVED,
        utr_id: 'utr123',
        bank_acc_id: 'bank1',
        vendor_id: 'vendor1',
        updated_by: 'admin1',
      }),
    );
    expect(commit).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith('Payout Updated Successfully');
    expect(conn.release).toHaveBeenCalled();
  });

  // Test Case 4: Payout with pending status
  test('should update payout with pending status', async () => {
    const mockPayout = {
      id: 1,
      company_id: 'company1',
      status: Status.PENDING,
    };
    const mockCompany = [{
      id: 'company1',
      config: {
        TATA_PAY: {
          walletsPayoutsApiKey: 'apiKey',
          walletsPayoutsUrl: 'https://api.tatapay.com',
          defaultBankId: 'bank1',
        },
      },
    }];
    const mockBank = [{ user_id: 'user1' }];
    const mockVendor = [{ id: 'vendor1' }];
    const mockAdminUser = { id: 'admin1' };
    const mockAxiosResponse = {
      data: {
        payouts: [{
          status: 'processing',
          _id: 'txn123',
        }],
      },
    };

    getPayoutByTxnId.mockResolvedValue(mockPayout);
    getCompanyByIDDao.mockResolvedValue(mockCompany);
    getBankByIdDao.mockResolvedValue(mockBank);
    getVendorsDao.mockResolvedValue(mockVendor);
    getUserByCompanyCreatedAtDao.mockResolvedValue(mockAdminUser);
    axios.get.mockResolvedValue(mockAxiosResponse);
    updatePayoutService.mockResolvedValue();

    await tataPayTransactionStatusCallback(req, res);

    expect(updatePayoutService).toHaveBeenCalledWith(
      conn,
      { id: mockPayout.id, company_id: mockPayout.company_id },
      expect.objectContaining({
        status: Status.PENDING,
        bank_acc_id: 'bank1',
        vendor_id: 'vendor1',
        updated_by: 'admin1',
      }),
    );
    expect(commit).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith('Payout Updated Successfully');
    expect(conn.release).toHaveBeenCalled();
  });

  // Test Case 5: Payout with rejected status (not previously approved)
  test('should update payout with rejected status', async () => {
    const mockPayout = {
      id: 1,
      company_id: 'company1',
      status: Status.PENDING,
    };
    const mockCompany = [{
      id: 'company1',
      config: {
        TATA_PAY: {
          walletsPayoutsApiKey: 'apiKey',
          walletsPayoutsUrl: 'https://api.tatapay.com',
          defaultBankId: 'bank1',
        },
      },
    }];
    const mockBank = [{ user_id: 'user1' }];
    const mockVendor = [{ id: 'vendor1' }];
    const mockAdminUser = { id: 'admin1' };
    const mockAxiosResponse = {
      data: {
        payouts: [{
          status: 'rejected',
          _id: 'txn123',
          remark: 'Insufficient funds',
        }],
      },
    };

    getPayoutByTxnId.mockResolvedValue(mockPayout);
    getCompanyByIDDao.mockResolvedValue(mockCompany);
    getBankByIdDao.mockResolvedValue(mockBank);
    getVendorsDao.mockResolvedValue(mockVendor);
    getUserByCompanyCreatedAtDao.mockResolvedValue(mockAdminUser);
    axios.get.mockResolvedValue(mockAxiosResponse);
    updatePayoutService.mockResolvedValue();

    await tataPayTransactionStatusCallback(req, res);

    expect(updatePayoutService).toHaveBeenCalledWith(
      conn,
      { id: mockPayout.id, company_id: mockPayout.company_id },
      expect.objectContaining({
        config: expect.objectContaining({
          rejected_reason: 'Insufficient funds',
        }),
        rejected_at: expect.any(String),
      }),
    );
    expect(commit).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith('Payout Updated Successfully');
    expect(conn.release).toHaveBeenCalled();
  });

  // Test Case 6: Payout with rejected status (previously approved, reversed)
  test('should update payout with reversed status if previously approved', async () => {
    const mockPayout = {
      id: 1,
      company_id: 'company1',
      status: Status.APPROVED,
    };
    const mockCompany = [{
      id: 'company1',
      config: {
        TATA_PAY: {
          walletsPayoutsApiKey: 'apiKey',
          walletsPayoutsUrl: 'https://api.tatapay.com',
          defaultBankId: 'bank1',
        },
      },
    }];
    const mockBank = [{ user_id: 'user1' }];
    const mockVendor = [{ id: 'vendor1' }];
    const mockAdminUser = { id: 'admin1' };
    const mockAxiosResponse = {
      data: {
        payouts: [{
          status: 'rejected',
          _id: 'txn123',
          remark: 'Chargeback',
        }],
      },
    };

    getPayoutByTxnId.mockResolvedValue(mockPayout);
    getCompanyByIDDao.mockResolvedValue(mockCompany);
    getBankByIdDao.mockResolvedValue(mockBank);
    getVendorsDao.mockResolvedValue(mockVendor);
    getUserByCompanyCreatedAtDao.mockResolvedValue(mockAdminUser);
    axios.get.mockResolvedValue(mockAxiosResponse);
    updatePayoutService.mockResolvedValue();

    await tataPayTransactionStatusCallback(req, res);

    expect(updatePayoutService).toHaveBeenCalledWith(
      conn,
      { id: mockPayout.id, company_id: mockPayout.company_id },
      expect.objectContaining({
        status: Status.REVERSED,
        rejected_at: expect.any(String),
      }),
    );
    expect(commit).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith('Payout Updated Successfully');
    expect(conn.release).toHaveBeenCalled();
  });

  // Test Case 7: Invalid response from TataPay (empty payouts array)
  test('should return 400 if payouts array is empty', async () => {
    const mockPayout = {
      id: 1,
      company_id: 'company1',
      status: Status.PENDING,
    };
    const mockCompany = [{
      id: 'company1',
      config: {
        TATA_PAY: {
          walletsPayoutsApiKey: 'apiKey',
          walletsPayoutsUrl: 'https://api.tatapay.com',
          defaultBankId: 'bank1',
        },
      },
    }];
    const mockAxiosResponse = {
      data: {
        payouts: [],
      },
    };

    getPayoutByTxnId.mockResolvedValue(mockPayout);
    getCompanyByIDDao.mockResolvedValue(mockCompany);
    axios.get.mockResolvedValue(mockAxiosResponse);

    await tataPayTransactionStatusCallback(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith('Invalid response from payment provider');
    expect(logger.error).toHaveBeenCalledWith(
      'Invalid response from TataPay: payouts array is missing or empty',
      mockAxiosResponse.data,
    );
    expect(conn.release).toHaveBeenCalled();
  });

  // Test Case 8: Unknown status from TataPay
  test('should return 400 for unknown status', async () => {
    const mockPayout = {
      id: 1,
      company_id: 'company1',
      status: Status.PENDING,
    };
    const mockCompany = [{
      id: 'company1',
      config: {
        TATA_PAY: {
          walletsPayoutsApiKey: 'apiKey',
          walletsPayoutsUrl: 'https://api.tatapay.com',
          defaultBankId: 'bank1',
        },
      },
    }];
    const mockAxiosResponse = {
      data: {
        payouts: [{
          status: 'unknown',
          _id: 'txn123',
        }],
      },
    };

    getPayoutByTxnId.mockResolvedValue(mockPayout);
    getCompanyByIDDao.mockResolvedValue(mockCompany);
    axios.get.mockResolvedValue(mockAxiosResponse);

    await tataPayTransactionStatusCallback(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith('Unknown status from payment provider');
    expect(conn.release).toHaveBeenCalled();
  });

  // Test Case 9: Axios retry logic on network error
  test('should retry on network error and succeed on second attempt', async () => {
    const mockPayout = {
      id: 1,
      company_id: 'company1',
      status: Status.PENDING,
    };
    const mockCompany = [{
      id: 'company1',
      config: {
        TATA_PAY: {
          walletsPayoutsApiKey: 'apiKey',
          walletsPayoutsUrl: 'https://api.tatapay.com',
          defaultBankId: 'bank1',
        },
      },
    }];
    const mockBank = [{ user_id: 'user1' }];
    const mockVendor = [{ id: 'vendor1' }];
    const mockAdminUser = { id: 'admin1' };
    const mockAxiosResponse = {
      data: {
        payouts: [{
          status: 'approved',
          _id: 'txn123',
          utr: 'utr123',
        }],
      },
    };

    getPayoutByTxnId.mockResolvedValue(mockPayout);
    getCompanyByIDDao.mockResolvedValue(mockCompany);
    getBankByIdDao.mockResolvedValue(mockBank);
    getVendorsDao.mockResolvedValue(mockVendor);
    getUserByCompanyCreatedAtDao.mockResolvedValue(mockAdminUser);
    updatePayoutService.mockResolvedValue();

    // Mock axios to fail on first attempt and succeed on second
    axios.get
      .mockRejectedValueOnce(new Error('Network Error'))
      .mockResolvedValueOnce(mockAxiosResponse);

    await tataPayTransactionStatusCallback(req, res);

    expect(axios.get).toHaveBeenCalledTimes(2);
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('TataPay payoutStatus response'),
      mockAxiosResponse.data,
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith('Payout Updated Successfully');
    expect(conn.release).toHaveBeenCalled();
  });

  // Test Case 10: Axios retry logic fails after max retries
  test('should fail after max retries on network error', async () => {
    const mockPayout = {
      id: 1,
      company_id: 'company1',
      status: Status.PENDING,
    };
    const mockCompany = [{
      id: 'company1',
      config: {
        TATA_PAY: {
          walletsPayoutsApiKey: 'apiKey',
          walletsPayoutsUrl: 'https://api.tatapay.com',
          defaultBankId: 'bank1',
        },
      },
    }];

    getPayoutByTxnId.mockResolvedValue(mockPayout);
    getCompanyByIDDao.mockResolvedValue(mockCompany);
    axios.get.mockRejectedValue(new Error('Network Error'));

    await tataPayTransactionStatusCallback(req, res);

    expect(axios.get).toHaveBeenCalledTimes(2); // 2 retries
    expect(logger.error).toHaveBeenCalledWith(
      'getting error while updating payout',
      expect.any(Error),
    );
    expect(rollback).toHaveBeenCalled();
    expect(conn.release).toHaveBeenCalled();
  });

  // Test Case 11: Client error (4xx) does not trigger retry
  test('should not retry on 4xx error', async () => {
    const mockPayout = {
      id: 1,
      company_id: 'company1',
      status: Status.PENDING,
    };
    const mockCompany = [{
      id: 'company1',
      config: {
        TATA_PAY: {
          walletsPayoutsApiKey: 'apiKey',
          walletsPayoutsUrl: 'https://api.tatapay.com',
          defaultBankId: 'bank1',
        },
      },
    }];

    getPayoutByTxnId.mockResolvedValue(mockPayout);
    getCompanyByIDDao.mockResolvedValue(mockCompany);
    axios.get.mockRejectedValue({
      response: { status: 400, data: { ErrorMessage: 'Bad Request' } },
    });

    await tataPayTransactionStatusCallback(req, res);

    expect(axios.get).toHaveBeenCalledTimes(1); // No retries
    expect(logger.error).toHaveBeenCalledWith(
      'getting error while updating payout',
      expect.any(Object),
    );
    expect(rollback).toHaveBeenCalled();
    expect(conn.release).toHaveBeenCalled();
  });

  // Test Case 12: Error during payout update rolls back transaction
  test('should rollback transaction on update error', async () => {
    const mockPayout = {
      id: 1,
      company_id: 'company1',
      status: Status.PENDING,
    };
    const mockCompany = [{
      id: 'company1',
      config: {
        TATA_PAY: {
          walletsPayoutsApiKey: 'apiKey',
          walletsPayoutsUrl: 'https://api.tatapay.com',
          defaultBankId: 'bank1',
        },
      },
    }];
    const mockBank = [{ user_id: 'user1' }];
    const mockVendor = [{ id: 'vendor1' }];
    const mockAdminUser = { id: 'admin1' };
    const mockAxiosResponse = {
      data: {
        payouts: [{
          status: 'approved',
          _id: 'txn123',
          utr: 'utr123',
        }],
      },
    };

    getPayoutByTxnId.mockResolvedValue(mockPayout);
    getCompanyByIDDao.mockResolvedValue(mockCompany);
    getBankByIdDao.mockResolvedValue(mockBank);
    getVendorsDao.mockResolvedValue(mockVendor);
    getUserByCompanyCreatedAtDao.mockResolvedValue(mockAdminUser);
    axios.get.mockResolvedValue(mockAxiosResponse);
    updatePayoutService.mockRejectedValue(new Error('Update failed'));

    await tataPayTransactionStatusCallback(req, res);

    expect(rollback).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      'getting error while updating payout',
      expect.any(Error),
    );
    expect(conn.release).toHaveBeenCalled();
  });
});