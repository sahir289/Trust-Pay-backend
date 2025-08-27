// import dayjs from 'dayjs';
import collectBankData from './bankCron.js';
import { getCompanyDao } from '../apis/company/companyDao.js';
import { getMerchantsDao } from '../apis/merchants/merchantDao.js';
import { getCalculationDao } from '../apis/calculation/calculationDao.js';
import { getBankaccountDao } from '../apis/bankAccounts/bankaccountDao.js';
import { getVendorsDao } from '../apis/vendors/vendorDao.js';
import { getUserHierarchysDao } from '../apis/userHierarchy/userHierarchyDao.js';
import { sendTelegramDashboardReportMessage } from '../utils/sendTelegramMessages.js';
import { getConnection } from '../utils/db.js';
import { logger } from '../utils/logger.js';
import gatherAllDataForAllCompanies, { gatherAllData } from './gatherAllData.js';
import formattedSuccessRatiosForAllCompanies from './successRatioCron.js';

jest.mock('../utils/logger.js', () => ({
  logger: {
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../apis/company/companyDao.js');
jest.mock('../apis/merchants/merchantDao.js');
jest.mock('../apis/calculation/calculationDao.js');
jest.mock('../apis/bankAccounts/bankaccountDao.js');
jest.mock('../apis/vendors/vendorDao.js');
jest.mock('../apis/userHierarchy/userHierarchyDao.js');
jest.mock('../utils/sendTelegramMessages.js');
jest.mock('../utils/db.js');
jest.mock('./bankCron.js');
jest.mock('../utils/logger.js');

describe('gatherAllDataForAllCompanies', () => {
  const timezone = 'Asia/Kolkata';
  beforeEach(() => {
    jest.clearAllMocks();
    collectBankData.mockResolvedValue();
    getCompanyDao.mockResolvedValue([{ id: 1, config: { telegramDashboardChatId: 'chatId', telegramBotToken: 'token' } }]);
    getMerchantsDao.mockResolvedValue([{ user_id: 1, code: 'M001' }]);
    getCalculationDao.mockResolvedValue([{ total_payin_amount: 1000, total_payin_count: 1, total_payout_amount: 500, total_payout_count: 1 }]);
    getBankaccountDao.mockResolvedValue([{ user_id: 1, nick_name: 'Bank1', today_balance: 500, payin_count: 2 }]);
    getVendorsDao.mockResolvedValue([{ code: 'V001' }]);
    getUserHierarchysDao.mockResolvedValue([]);
    getConnection.mockResolvedValue({ release: jest.fn() });
  });

  it('should process all companies and call bank cron for daily reports', async () => {
    await gatherAllDataForAllCompanies('N', timezone);

    expect(getCompanyDao).toHaveBeenCalled();
    expect(getMerchantsDao).toHaveBeenCalled();
    expect(getCalculationDao).toHaveBeenCalled();
    expect(getBankaccountDao).toHaveBeenCalled();
    expect(getVendorsDao).toHaveBeenCalled();
    expect(sendTelegramDashboardReportMessage).toHaveBeenCalledWith(
      'chatId',
      expect.any(Array),
      expect.any(Number),
      expect.any(Number),
      expect.any(Object),
      expect.any(Object),
      expect.any(Number),
      expect.any(Number),
      'token',
      'Daily Report'
    );
    expect(collectBankData).toHaveBeenCalledWith(timezone);
  });

  it('should skip bank cron for hourly reports', async () => {
    await gatherAllDataForAllCompanies('H', timezone);

    expect(collectBankData).not.toHaveBeenCalled();
    expect(sendTelegramDashboardReportMessage).toHaveBeenCalledWith(
      'chatId',
      expect.any(Array),
      expect.any(Number),
      expect.any(Number),
      expect.any(Object),
      expect.any(Object),
      expect.any(Number),
      expect.any(Number),
      'token',
      'Hourly Report'
    );
  });

  it('should log and return if no companies found', async () => {
    getCompanyDao.mockResolvedValue([]);

    await gatherAllDataForAllCompanies('N', timezone);

    expect(logger.info).toHaveBeenCalledWith('No companies found');
    expect(getMerchantsDao).not.toHaveBeenCalled();
    expect(collectBankData).not.toHaveBeenCalled();
  });

  it('should handle errors in gatherAllData gracefully', async () => {
    getCompanyDao.mockRejectedValue(new Error('DB error'));

    await gatherAllDataForAllCompanies('N', timezone);

    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("Error in gatherAllDataForAllCompanies: Error: DB error"));
    expect(collectBankData).not.toHaveBeenCalled();
  });
});

describe('gatherAllData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getConnection.mockResolvedValue({ release: jest.fn() });
    getCompanyDao.mockResolvedValue([{ id: 1, config: { telegramDashboardChatId: 'chatId', telegramBotToken: 'token' } }]);
    getMerchantsDao.mockResolvedValue([{ user_id: 1, code: 'M001' }]);
    getCalculationDao.mockResolvedValue([{ total_payin_amount: 1000, total_payin_count: 1, total_payout_amount: 500, total_payout_count: 1 }]);
    getBankaccountDao.mockResolvedValue([{ user_id: 1, nick_name: 'Bank1', today_balance: 500, payin_count: 2 }]);
    getVendorsDao.mockResolvedValue([{ code: 'V001' }]);
    getUserHierarchysDao.mockResolvedValue([]);
    sendTelegramDashboardReportMessage.mockResolvedValue();
  });

  it('should process a single company and send telegram report', async () => {
    await gatherAllData(1, 'N', 'Asia/Kolkata');

    expect(getCompanyDao).toHaveBeenCalledWith({ id: 1 });
    expect(sendTelegramDashboardReportMessage).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Dashboard Report CRON Ended for company: 1'));
  });

  it('should warn if Telegram config is missing for company', async () => {
    const company = { id: 'c1', config: {} };
    getCompanyDao.mockResolvedValueOnce([company]);
  
    await formattedSuccessRatiosForAllCompanies();
  
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Missing Telegram config for company c1')
    );
  });
    

  it('should handle company not found', async () => {
    getCompanyDao.mockResolvedValue([]);

    await gatherAllData(999, 'N', 'Asia/Kolkata');

    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Company not found: 999'));
  });

  it('should release DB connection in finally', async () => {
    const releaseMock = jest.fn();
    getConnection.mockResolvedValue({ release: releaseMock });

    await gatherAllData(1, 'N', 'Asia/Kolkata');

    expect(releaseMock).toHaveBeenCalled();
  });
});
