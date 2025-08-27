import formattedSuccessRatiosForAllCompanies from './successRatioCron.js';
import { getCompanyDao } from '../apis/company/companyDao.js';
import { getMerchantsDao } from '../apis/merchants/merchantDao.js';
import { getPayInUrlsDao } from '../apis/payIn/payInDao.js';
import { sendTelegramDashboardSuccessRatioMessage } from '../utils/sendTelegramMessages.js';
import { logger } from '../utils/logger.js';

jest.mock('../apis/company/companyDao.js');
jest.mock('../apis/merchants/merchantDao.js');
jest.mock('../apis/payIn/payInDao.js');
jest.mock('../utils/sendTelegramMessages.js');
jest.mock('../utils/logger.js');

describe('formattedSuccessRatiosForAllCompanies', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should log and return if no companies are found', async () => {
    getCompanyDao.mockResolvedValueOnce([]);
    await formattedSuccessRatiosForAllCompanies();
    expect(logger.info).toHaveBeenCalledWith('No companies found');
  });

  it('should process companies and send Telegram message for merchants with transactions', async () => {
    const company = { id: 'c1', config: { telegramRatioAlertsChatId: 'chat123', telegramBotToken: 'token123' } };
    const merchant = { id: 'm1', code: 'M001' };
    const payin = { merchant_id: 'm1', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), status: 'SUCCESS', user_submitted_utr: 'utr123' };

    getCompanyDao.mockResolvedValueOnce([company]);
    getMerchantsDao.mockResolvedValueOnce([merchant]);
    getPayInUrlsDao.mockResolvedValueOnce([payin]);

    await formattedSuccessRatiosForAllCompanies();

    expect(logger.info).toHaveBeenCalledWith(`Processing success ratios for company: ${company.id}`);
    expect(sendTelegramDashboardSuccessRatioMessage).toHaveBeenCalledWith(
      'chat123',
      expect.arrayContaining([expect.objectContaining({ merchantCode: 'M001' })]),
      'token123'
    );
  });

  it('should skip merchants with zero transactions or zero ratios', async () => {
    const company = { id: 'c1', config: { telegramRatioAlertsChatId: 'chat123', telegramBotToken: 'token123' } };
    const merchant = { id: 'm1', code: 'M001' };
    const payin = { merchant_id: 'm1', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), status: 'FAILED', user_submitted_utr: '' };

    getCompanyDao.mockResolvedValueOnce([company]);
    getMerchantsDao.mockResolvedValueOnce([merchant]);
    getPayInUrlsDao.mockResolvedValueOnce([payin]);

    await formattedSuccessRatiosForAllCompanies();

    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Skipping merchant M001'));
    expect(sendTelegramDashboardSuccessRatioMessage).not.toHaveBeenCalled();
  });

  it('should handle errors in company processing gracefully', async () => {
    getCompanyDao.mockRejectedValueOnce(new Error('DB failure'));

    await formattedSuccessRatiosForAllCompanies();

    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error in formattedSuccessRatiosForAllCompanies: Error: DB failure'));
  });

  it('should warn if Telegram config is missing for company', async () => {
    const company = { id: 'c1', config: {} };
    getCompanyDao.mockResolvedValueOnce([company]);

    await formattedSuccessRatiosForAllCompanies();

    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Missing Telegram config for company'), expect.anything());
  });
});
