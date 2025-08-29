import formattedSuccessRatiosForAllCompanies, { formattedSuccessRatiosByMerchant } from './successRatioCron.js';
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
    logger.info = jest.fn();
    logger.error = jest.fn();
    logger.warn = jest.fn(); // <-- Add this line
  });

  it('should log and return if no companies are found', async () => {
    getCompanyDao.mockResolvedValueOnce([]);
    await formattedSuccessRatiosForAllCompanies();
    expect(logger.info).toHaveBeenCalledWith('No companies found');
  });

  it('should process a company and send Telegram message for merchants with transactions', async () => {
    const company = { id: 'c1', config: { telegramRatioAlertsChatId: 'chat123', telegramBotToken: 'token123' } };
    const merchant = { id: 'm1', code: 'M001' };
    const now = new Date();
    const payin = {
      merchant_id: 'm1',
      created_at: new Date(now - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago
      updated_at: new Date(now - 1 * 60 * 60 * 1000).toISOString(),
      status: 'SUCCESS',
      user_submitted_utr: 'utr123'
    };
  
    getCompanyDao.mockResolvedValueOnce([company]);
    getMerchantsDao.mockResolvedValueOnce([merchant]);
    getPayInUrlsDao.mockResolvedValueOnce([payin]);
  
    await formattedSuccessRatiosByMerchant('c1');
  
    expect(logger.info).toHaveBeenCalledWith('Success Ratio CRON Started for company: c1');
    // expect(logger.info).toHaveBeenCalledWith(`Processing success ratios for company: ${company.id}`);
    expect(sendTelegramDashboardSuccessRatioMessage).toHaveBeenCalledWith(
      'chat123',
      expect.arrayContaining([expect.objectContaining({ merchantCode: 'M001' })]),
      'token123'
    );
    expect(logger.info).toHaveBeenCalledWith('Success Ratio CRON Ended for company: c1');
  });

  it('should log processing messages for company', async () => {
    const company = { id: 'c1', config: { telegramRatioAlertsChatId: 'chat123', telegramBotToken: 'token123' } };
    const merchant = { id: 'm1', code: 'M001' };
    const payin = { merchant_id: 'm1', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), status: 'FAILED', user_submitted_utr: '' };
  
    getCompanyDao.mockResolvedValueOnce([company]);
    getMerchantsDao.mockResolvedValueOnce([merchant]);
    getPayInUrlsDao.mockResolvedValueOnce([payin]);
  
    await formattedSuccessRatiosForAllCompanies();
  
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Starting success ratio processing for all companies'));
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Processing success ratios for company: c1'));
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Success Ratio CRON Started for company: c1'));
    expect(sendTelegramDashboardSuccessRatioMessage).not.toHaveBeenCalled();
  });
  
  

  it('should handle errors in company processing gracefully', async () => {
    getCompanyDao.mockRejectedValueOnce(new Error('DB failure'));

    await formattedSuccessRatiosForAllCompanies();

    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error in formattedSuccessRatiosForAllCompanies: Error: DB failure'));
  });

  it('should warn if Telegram config is missing for company', async () => {
    const company = { id: 'c1', config: {} };
    
    getCompanyDao.mockResolvedValue([company]);
  
    await formattedSuccessRatiosForAllCompanies();
  
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Missing Telegram config for company c1')
    );
  });
  
  
  
});
