import gatherDataForCompany from './dashboardReportService.js';
import config from '../../config/config.js';

import { 
  getMerchantsForDashboardReportDao 
} from '../merchants/merchantDao.js';
import { 
  getCalculationDashBoardReportDao 
} from '../calculation/calculationDao.js';
import { 
  getBankaccountDashBoardReportDao 
} from '../bankAccounts/bankaccountDao.js';
import { 
  sendTelegramDashboardReportMessage 
} from '../../utils/sendTelegramMessages.js';
import { 
  getConnection 
} from '../../utils/db.js';
import { 
  getVendorsDashBoardReportDao 
} from '../vendors/vendorDao.js';
import { 
  getUserHierarchysDashBoardReportDao 
} from '../userHierarchy/userHierarchyDao.js';
import { 
  getCompanyDao 
} from '../company/companyDao.js';
import { 
  getBankHistoryDao 
} from '../bankHistory/bankHistoryDao.js';
import { BadRequestError, NotFoundError } from '../../utils/appErrors.js';

jest.mock('../merchants/merchantDao.js');
jest.mock('../calculation/calculationDao.js');
jest.mock('../bankAccounts/bankaccountDao.js');
jest.mock('../../utils/sendTelegramMessages.js');
jest.mock('../../utils/db.js');
jest.mock('../vendors/vendorDao.js');
jest.mock('../userHierarchy/userHierarchyDao.js');
jest.mock('../company/companyDao.js');
jest.mock('../bankHistory/bankHistoryDao.js');

jest.mock('../../config/config.js');

describe('gatherDataForCompany', () => {
  let mockConn;

  beforeEach(() => {
    jest.clearAllMocks();

    mockConn = { release: jest.fn() };
    getConnection.mockResolvedValue(mockConn);
  });
  

  test('should throw BadRequestError when company_id is missing', async () => {
    await expect(gatherDataForCompany(null, '2025-09-15'))
      .rejects.toThrow(BadRequestError);
  });

  test('should throw BadRequestError when date is missing', async () => {
    await expect(gatherDataForCompany('company-1', null))
      .rejects.toThrow(BadRequestError);
  });

  test('should throw BadRequestError when date format is invalid', async () => {
    await expect(gatherDataForCompany('company-1', 'invalid-date'))
      .rejects.toThrow(BadRequestError);
  });

  test('should throw NotFoundError when company is not found', async () => {
    getCompanyDao.mockResolvedValue([]);

    await expect(gatherDataForCompany('company-1', '2025-09-15'))
      .rejects.toThrow(NotFoundError);
  });


  test('should throw NotFoundError when Telegram config is missing', async () => {
    getCompanyDao.mockResolvedValue([{ config: {} }]);
    getUserHierarchysDashBoardReportDao.mockResolvedValue([]);
    getMerchantsForDashboardReportDao.mockResolvedValue([]);
    getBankaccountDashBoardReportDao.mockResolvedValue([]);
  
    // Remove global config temporarily
    const originalConfig = { ...config };
    config.telegramDashboardChatId = undefined;
    config.telegramBotToken = undefined;
  
    await expect(gatherDataForCompany('company-1', '2025-09-15'))
      .rejects.toThrow(NotFoundError);
  
    // Restore config
    Object.assign(config, originalConfig);
  });
  
  test('should process and send telegram report successfully', async () => {
    // Mock company with Telegram config
    getCompanyDao.mockResolvedValue([
      { config: { telegramDashboardChatId: 'chat123', telegramBotToken: 'token123' } }
    ]);

    // Mock merchants
    getMerchantsForDashboardReportDao.mockResolvedValue([
      { user_id: 'merchant1', code: 'M1' }
    ]);

    // Mock hierarchies
    getUserHierarchysDashBoardReportDao.mockResolvedValue([]);

    // Mock calculation data
    getCalculationDashBoardReportDao.mockResolvedValue([
      { total_payin_amount: 100, total_payin_count: 2, total_payout_amount: 50, total_payout_count: 1 }
    ]);

    // Mock bank accounts
    getBankaccountDashBoardReportDao.mockImplementation(({ bank_used_for }) => {
      if (bank_used_for === 'PayIn') {
        return Promise.resolve([{ id: 'bank1', user_id: 'vendor1', nick_name: 'Bank A', today_balance: 200, payin_count: 1 }]);
      }
      return Promise.resolve([{ id: 'bank2', user_id: 'vendor2', nick_name: 'Bank B', today_balance: 300, payin_count: 2 }]);
    });

    // Mock vendor lookup
    getVendorsDashBoardReportDao.mockImplementation(({ user_id }) => {
      if (user_id === 'vendor1') {
        return Promise.resolve([{ code: 'V1' }]);
      }
      if (user_id === 'vendor2') {
        return Promise.resolve([{ code: 'V2' }]);
      }
      return Promise.resolve([]);
    });

    // Mock bank history (not used for today’s date)
    getBankHistoryDao.mockResolvedValue([]);

    // Run
    const result = await gatherDataForCompany('company-1', '2025-09-15');

    expect(result.success).toBe(true);
    expect(sendTelegramDashboardReportMessage).toHaveBeenCalledWith(
      'chat123',
      expect.any(Array), // merchants
      expect.any(Number), // totalpayinsMerchant
      expect.any(Number), // totalpayoutsMerchant
      expect.any(Object), // vendorObjpayIn
      expect.any(Object), // vendorObjpayOut
      expect.any(Number), // totalBankDepositAllVendors
      expect.any(Number), // totalBankWithdrawalAllVendors
      'token123',
      expect.any(String), // Hourly Report or Daily Report
      '2025-09-15'
    );
    expect(mockConn.release).toHaveBeenCalled();
  });

  test('should release connection even when error is thrown', async () => {
    getCompanyDao.mockRejectedValue(new Error('DB failure'));

    await expect(gatherDataForCompany('company-1', '2025-09-15'))
      .rejects.toThrow('DB failure');

    expect(mockConn.release).toHaveBeenCalled();
  });
});
