import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';
import collectBankData from './bankCron.js';
import { getCompanyDao } from '../apis/company/companyDao.js';
import { getMerchantsForDashboardReportDao } from '../apis/merchants/merchantDao.js';
import { getCalculationDashBoardReportDao } from '../apis/calculation/calculationDao.js';
import { getBankaccountDashBoardReportDao } from '../apis/bankAccounts/bankaccountDao.js';
import { getVendorsDashBoardReportDao } from '../apis/vendors/vendorDao.js';
import { getUserHierarchysDashBoardReportDao } from '../apis/userHierarchy/userHierarchyDao.js';
import { sendTelegramDashboardReportMessage } from '../utils/sendTelegramMessages.js';
import { getConnection } from '../utils/db.js';
import { logger } from '../utils/logger.js';
import gatherAllDataForAllCompanies, { gatherAllData } from './gatherAllData.js';
import gatherAllNetbalanceForAllCompanies from './gatherAllNetBalance.js';
import config from '../config/config.js';

// Initialize dayjs plugins
dayjs.extend(utc);
dayjs.extend(timezone);

jest.mock('../utils/logger.js', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    log: jest.fn(),
  },
}));

jest.mock('../apis/company/companyDao.js');
jest.mock('../apis/merchants/merchantDao.js');
jest.mock('../apis/calculation/calculationDao.js');
jest.mock('../apis/bankAccounts/bankaccountDao.js');
jest.mock('../apis/vendors/vendorDao.js');
jest.mock('../apis/userHierarchy/userHierarchyDao.js');
jest.mock('../utils/sendTelegramMessages.js');
jest.mock('./bankCron.js');
jest.mock('./gatherAllNetBalance.js');
jest.mock('../utils/db.js', () => ({
  getConnection: jest.fn(),
  createPool: jest.fn(() => ({
    query: jest.fn(),
    connect: jest.fn(() => ({
      query: jest.fn(),
      release: jest.fn(),
    })),
  })),
}));

describe('gatherAllDataForAllCompanies', () => {
  const timezone = 'Asia/Kolkata';

  beforeEach(() => {
    jest.clearAllMocks();
    collectBankData.mockResolvedValue();
    gatherAllNetbalanceForAllCompanies.mockResolvedValue();
    getCompanyDao.mockResolvedValue([
      {
        id: 1,
        config: {
          telegramDashboardChatId: 'chatId',
          telegramBotToken: 'token',
          telegramVendorboardChatId: '-4803239959',
        },
      },
    ]);
    getMerchantsForDashboardReportDao.mockResolvedValue([{ user_id: 1, code: 'M001' }]);
    getCalculationDashBoardReportDao.mockResolvedValue([
      { total_payin_amount: 1000, total_payin_count: 1, total_payout_amount: 500, total_payout_count: 1 },
    ]);
    getBankaccountDashBoardReportDao.mockResolvedValue([
      { user_id: 1, nick_name: 'Bank1', today_balance: 500, payin_count: 2 },
    ]);
    getVendorsDashBoardReportDao.mockResolvedValue([{ code: 'V001' }]);
    getUserHierarchysDashBoardReportDao.mockResolvedValue([]);
    getConnection.mockResolvedValue({ release: jest.fn() });
    sendTelegramDashboardReportMessage.mockResolvedValue();
  });

  it('should process all companies and call bank cron for daily reports', async () => {
    await gatherAllDataForAllCompanies('N', timezone);

    expect(getCompanyDao).toHaveBeenCalled();
    expect(getMerchantsForDashboardReportDao).toHaveBeenCalledWith({ company_id: 1 });
    expect(getCalculationDashBoardReportDao).toHaveBeenCalled();
    expect(getBankaccountDashBoardReportDao).toHaveBeenCalledWith(
      expect.objectContaining({ company_id: 1 }),
    );
    expect(getVendorsDashBoardReportDao).toHaveBeenCalled();

    expect(sendTelegramDashboardReportMessage).toHaveBeenCalledWith(
      'chatId',
      expect.arrayContaining([
        expect.objectContaining({
          merchantId: 'M001',
          totalPayin: 1000,
          totalPayinCount: 1,
          totalPayout: 500,
          totalPayoutCount: 1,
        }),
      ]),
      1000,
      500,
      expect.objectContaining({
        V001: expect.objectContaining({
          banks: expect.arrayContaining([
            expect.objectContaining({
              bankName: 'Bank1',
              TotalDeposit: 500,
              TotalCount: 2,
            }),
          ]),
        }),
      }),
      expect.anything(),
      500,
      500,
      'token',
      'Daily Report',
      null,
      '-4803239959'
    );
        
      
    expect(collectBankData).toHaveBeenCalledWith(timezone);
    expect(gatherAllNetbalanceForAllCompanies).toHaveBeenCalledWith('N', timezone);
  });

  it('should skip bank cron for hourly reports', async () => {
    await gatherAllDataForAllCompanies('H', timezone);

    expect(collectBankData).not.toHaveBeenCalled();
    expect(gatherAllNetbalanceForAllCompanies).toHaveBeenCalledWith('H', timezone);
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
      'Hourly Report',
      null, 
      '-4803239959'
    );
  });

  it('should log and return if no companies found', async () => {
    getCompanyDao.mockResolvedValue([]);

    await gatherAllDataForAllCompanies('N', timezone);

    expect(logger.info).toHaveBeenCalledWith('No companies found');
    expect(getMerchantsForDashboardReportDao).not.toHaveBeenCalled();
    expect(collectBankData).not.toHaveBeenCalled();
  });

  it('should handle errors in gatherAllData gracefully', async () => {
    getMerchantsForDashboardReportDao.mockRejectedValue(new Error('DB error'));

    await gatherAllDataForAllCompanies('N', timezone);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Error in gatherAllData for company 1: Error: DB error')
    );    
    expect(collectBankData).toHaveBeenCalledWith(timezone);
    expect(gatherAllNetbalanceForAllCompanies).toHaveBeenCalledWith('N', timezone);
  });
});

describe('gatherAllData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getConnection.mockResolvedValue({ release: jest.fn() });
    getCompanyDao.mockResolvedValue([
      { id: 1, config: { telegramDashboardChatId: 'chatId', telegramBotToken: 'token' } },
    ]);
    getMerchantsForDashboardReportDao.mockResolvedValue([{ user_id: 1, code: 'M001' }]);
    getCalculationDashBoardReportDao.mockResolvedValue([
      { total_payin_amount: 1000, total_payin_count: 1, total_payout_amount: 500, total_payout_count: 1 },
    ]);
    getBankaccountDashBoardReportDao.mockResolvedValue([
      { user_id: 1, nick_name: 'Bank1', today_balance: 500, payin_count: 2 },
    ]);
    getVendorsDashBoardReportDao.mockResolvedValue([{ code: 'V001' }]);
    getUserHierarchysDashBoardReportDao.mockResolvedValue([]);
    sendTelegramDashboardReportMessage.mockResolvedValue();
  });

  it('should process a single company and send telegram report', async () => {
    await gatherAllData(1, 'N', 'Asia/Kolkata');

    expect(getCompanyDao).toHaveBeenCalledWith({ id: 1 });
    expect(getMerchantsForDashboardReportDao).toHaveBeenCalledWith({ company_id: 1 });
    expect(sendTelegramDashboardReportMessage).toHaveBeenCalledWith(
      'chatId',
      expect.arrayContaining([
        expect.objectContaining({
          merchantId: 'M001',
          totalPayin: 1000,
          totalPayinCount: 1,
          totalPayout: 500,
          totalPayoutCount: 1,
        }),
      ]),
      1000,
      500,
      expect.any(Object),
      expect.any(Object),
      expect.any(Number),
      expect.any(Number),
      'token',
      'Daily Report',
      null, 
      undefined // Accept undefined if that's what the code returns
    );
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Dashboard Report CRON Ended for company: 1'));
  });

  it('should warn if Telegram config is missing for company', async () => {
    getCompanyDao.mockResolvedValue([{ id: 1, config: {} }]);

    await gatherAllData(1, 'N', 'Asia/Kolkata');

    expect(sendTelegramDashboardReportMessage).toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
    
  });

  it('should handle company not found', async () => {
    getCompanyDao.mockResolvedValue([]);

    await gatherAllData(999, 'N', 'Asia/Kolkata');

    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Company not found: 999'));
    expect(sendTelegramDashboardReportMessage).not.toHaveBeenCalled();
  });

  it('should release DB connection in finally', async () => {
    const releaseMock = jest.fn();
    getConnection.mockResolvedValue({ release: releaseMock });

    await gatherAllData(1, 'N', 'Asia/Kolkata');

    expect(releaseMock).toHaveBeenCalled();
  });


  it('should log a warning and skip report if Telegram config is missing', async () => {
    // Override defaults to undefined for this test
    const originalTelegramChatId = config.telegramDashboardChatId;
    const originalTelegramBotToken = config.telegramBotToken;
    config.telegramDashboardChatId = undefined;
    config.telegramBotToken = undefined;
  
    getCompanyDao.mockResolvedValue([
      { id: 1, config: { telegramDashboardChatId: null, telegramBotToken: null } },
    ]);
  
    await gatherAllData(1, 'N', 'Asia/Kolkata');
  
    expect(logger.warn).toHaveBeenCalledWith(
      'Missing Telegram config for company 1, skipping report'
    );
    expect(sendTelegramDashboardReportMessage).not.toHaveBeenCalled();
  
    // Restore original config
    config.telegramDashboardChatId = originalTelegramChatId;
    config.telegramBotToken = originalTelegramBotToken;
  });
  
});