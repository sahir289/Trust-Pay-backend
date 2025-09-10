import formattedSuccessRatiosForAllCompanies, {
  formattedSuccessRatiosByMerchant,
} from './successRatioCron.js';
import { getCompanyDao } from '../apis/company/companyDao.js';
import { getMerchantsDao } from '../apis/merchants/merchantDao.js';
import { getPayInsForSuccessRatioDao } from '../apis/payIn/payInDao.js';
import { sendTelegramDashboardSuccessRatioMessage } from '../utils/sendTelegramMessages.js';
import { logger } from '../utils/logger.js';

jest.mock('../apis/company/companyDao.js');
jest.mock('../apis/merchants/merchantDao.js');
jest.mock('../apis/payIn/payInDao.js');
jest.mock('../utils/sendTelegramMessages.js');
jest.mock('../utils/logger.js');
jest.mock('../config/config.js', () => ({
  telegramRatioAlertsChatId: null,
  telegramBotToken: null,
  telegramRatioAlertsChatIdUpdatedData: null,
  bucketName: 'fake-bucket',
  aws: {},
  secretKeyS3: 'fake-secret',
  bucketRegion: 'us-east-1',
}));

jest.mock('../utils/db.js', () => ({
  executeQuery: jest.fn(),
  getConnection: jest.fn(),
  beginTransaction: jest.fn(),
  commit: jest.fn(),
  rollback: jest.fn(),
}));

jest.mock('../helpers/Aws.js', () => ({
  s3: {
    send: jest.fn(),
  },
}));

describe('formattedSuccessRatiosForAllCompanies', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    logger.info = jest.fn();
    logger.error = jest.fn();
    logger.warn = jest.fn();
    logger.debug = jest.fn();
  });

  it('should log and return if no companies are found', async () => {
    getCompanyDao.mockResolvedValueOnce([]);
    await formattedSuccessRatiosForAllCompanies();
    expect(logger.info).toHaveBeenCalledWith('No companies found');
  });

  // it('should process a company and send Telegram message for merchants with transactions', async () => {
  //   const company = { id: 'c1', config: { telegramRatioAlertsChatId: 'chat123', telegramBotToken: 'token123' } };
  //   const merchant = { id: 'm1', code: 'M001' };
  //   const now = new Date();
  //   const payin = {
  //     merchant_id: 'm1',
  //     created_at: new Date(now - 1 * 60 * 60 * 1000).toISOString(), // 1h ago
  //     updated_at: new Date(now - 1 * 60 * 60 * 1000).toISOString(),
  //     status: 'SUCCESS',
  //     user_submitted_utr: 'utr123',
  //   };

  //   getCompanyDao.mockResolvedValueOnce([company]);
  //   getMerchantsDao.mockResolvedValueOnce([merchant]);
  //   getPayInsForSuccessRatioDao.mockResolvedValueOnce([payin]);

  //   await formattedSuccessRatiosByMerchant('c1');

  //   expect(logger.info).toHaveBeenCalledWith('Success Ratio CRON Started for company: c1');
  //   expect(sendTelegramDashboardSuccessRatioMessage).toHaveBeenCalledWith(
  //     'chat123',
  //     expect.arrayContaining([
  //       expect.objectContaining({
  //         merchantCode: 'M001',
  //         intervalDetails: expect.stringMatching(
  //           /(?:⚠️|✅)\s*Last 5m: 0\/0 = 0\.00%.*(?:⚠️|✅)\s*Last 10m: 0\/0 = 0\.00%.*(?:⚠️|✅)\s*Last 15m: 0\/0 = 0\.00%.*(?:⚠️|✅)\s*Last 30m: 0\/0 = 0\.00%.*(?:⚠️|✅)\s*Last 1h: 0\/0 = 0\.00%.*(?:⚠️|✅)\s*Last 3h: 1\/1 = 100\.00%.*(?:⚠️|✅)\s*Last 6h: 1\/1 = 100\.00%.*(?:⚠️|✅)\s*Last 12h: 1\/1 = 100\.00%.*(?:⚠️|✅)\s*Last 24h: 1\/1 = 100\.00%.*(?:⚠️|✅)\s*Today SR: 1\/1 = 100\.00%/
  //         ),
  //         intervalDetailsUtr: expect.stringMatching(
  //           /(?:⚠️|✅)\s*Last 5m: 0\/0 = 0\.00%.*(?:⚠️|✅)\s*Last 10m: 0\/0 = 0\.00%.*(?:⚠️|✅)\s*Last 15m: 0\/0 = 0\.00%.*(?:⚠️|✅)\s*Last 30m: 0\/0 = 0\.00%.*(?:⚠️|✅)\s*Last 1h: 0\/0 = 0\.00%.*(?:⚠️|✅)\s*Last 3h: 1\/1 = 100\.00%.*(?:⚠️|✅)\s*Last 6h: 1\/1 = 100\.00%.*(?:⚠️|✅)\s*Last 12h: 1\/1 = 100\.00%.*(?:⚠️|✅)\s*Last 24h: 1\/1 = 100\.00%.*(?:⚠️|✅)\s*Today SR: 1\/1 = 100\.00%/
  //         ),
  //       }),
  //     ]),
  //     'token123'
  //   );
  //   expect(logger.info).toHaveBeenCalledWith('Success Ratio CRON Ended for company: c1');
  // });

  // it('should process updated_at-based success ratios and send Telegram message', async () => {
  //   const company = { id: 'c1', config: { telegramRatioAlertsChatIdUpdatedData: 'chat124', telegramBotToken: 'token123' } };
  //   const merchant = { id: 'm1', code: 'M001' };
  //   const now = new Date();
  //   const payin = {
  //     merchant_id: 'm1',
  //     created_at: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
  //     updated_at: new Date(now - 1 * 60 * 60 * 1000).toISOString(), // 1h ago
  //     status: 'SUCCESS',
  //     user_submitted_utr: 'utr123',
  //   };

  //   getCompanyDao.mockResolvedValueOnce([company]);
  //   getMerchantsDao.mockResolvedValueOnce([merchant]);
  //   getPayInsForSuccessRatioDao.mockResolvedValueOnce([payin]);

  //   await formattedSuccessRatiosByMerchantUpdatedAt('c1');

  //   expect(logger.info).toHaveBeenCalledWith('Success Ratio CRON Started For Updated At for company: c1');
  //   expect(sendTelegramDashboardSuccessRatioMessage).toHaveBeenCalledWith(
  //     'chat124',
  //     expect.arrayContaining([
  //       expect.objectContaining({
  //         merchantCode: 'M001',
  //         intervalDetails: expect.stringMatching(
  //           /(?:⚠️|✅)\s*Last 5m: 0\/0 = 0\.00%.*(?:⚠️|✅)\s*Last 15m: 0\/0 = 0\.00%.*(?:⚠️|✅)\s*Last 30m: 0\/0 = 0\.00%.*(?:⚠️|✅)\s*Last 1h: 0\/0 = 0\.00%.*(?:⚠️|✅)\s*Last 3h: 1\/1 = 100%.*(?:⚠️|✅)\s*Last 24h: 1\/1 = 100%/
  //         ),
  //         intervalDetailsUtr: expect.stringMatching(
  //           /(?:⚠️|✅)\s*Last 5m: 0\/0 = 0\.00%.*(?:⚠️|✅)\s*Last 15m: 0\/0 = 0\.00%.*(?:⚠️|✅)\s*Last 30m: 0\/0 = 0\.00%.*(?:⚠️|✅)\s*Last 1h: 0\/0 = 0\.00%.*(?:⚠️|✅)\s*Last 3h: 1\/1 = 100%.*(?:⚠️|✅)\s*Last 24h: 1\/1 = 100%/
  //         ),
  //       }),
  //     ]),
  //     'token123'
  //   );
  //   expect(logger.info).toHaveBeenCalledWith('Success Ratio CRON Ended for company: c1');
  // });

  it('should skip merchants with zero success or UTR ratios', async () => {
    const company = { id: 'c1', config: { telegramRatioAlertsChatId: 'chat123', telegramBotToken: 'token123' } };
    const merchant = { id: 'm1', code: 'M001' };
    const payin = {
      merchant_id: 'm1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: 'FAILED',
      user_submitted_utr: '',
    };

    getCompanyDao.mockResolvedValueOnce([company]);
    getMerchantsDao.mockResolvedValueOnce([merchant]);
    getPayInsForSuccessRatioDao.mockResolvedValueOnce([payin]);

    await formattedSuccessRatiosByMerchant('c1');

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Skipping merchant M001 - PayIn Ratio: 0%, UTR Ratio: 0%')
    );
    expect(sendTelegramDashboardSuccessRatioMessage).not.toHaveBeenCalled();
  });

  it('should sort merchants by code case-insensitively', async () => {
    const company = { id: 'c1', config: { telegramRatioAlertsChatId: 'chat123', telegramBotToken: 'token123' } };
    const merchants = [
      { id: 'm1', code: 'Z001' },
      { id: 'm2', code: 'a001' },
      { id: 'm3', code: 'M001' },
    ];
    const payins = [
      { merchant_id: 'm1', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), status: 'SUCCESS', user_submitted_utr: 'utr1' },
      { merchant_id: 'm2', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), status: 'SUCCESS', user_submitted_utr: 'utr2' },
      { merchant_id: 'm3', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), status: 'SUCCESS', user_submitted_utr: 'utr3' },
    ];

    getCompanyDao.mockResolvedValueOnce([company]);
    getMerchantsDao.mockResolvedValueOnce(merchants);
    getPayInsForSuccessRatioDao.mockResolvedValueOnce(payins);

    await formattedSuccessRatiosByMerchant('c1');

    expect(sendTelegramDashboardSuccessRatioMessage).toHaveBeenCalledWith(
      'chat123',
      expect.arrayContaining([
        expect.objectContaining({ merchantCode: 'a001' }),
        expect.objectContaining({ merchantCode: 'M001' }),
        expect.objectContaining({ merchantCode: 'Z001' }),
      ]),
      'token123'
    );
  });

  it('should handle errors in company processing gracefully', async () => {
    getCompanyDao.mockRejectedValueOnce(new Error('DB failure'));
    await formattedSuccessRatiosForAllCompanies();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Error in formattedSuccessRatiosForAllCompanies: Error: DB failure')
    );
  });

  it('should warn if Telegram config is missing for company', async () => {
    const company = { id: 'c1', config: {} };
    getCompanyDao.mockResolvedValue([company]);
    await formattedSuccessRatiosForAllCompanies();
    await new Promise(resolve => setTimeout(resolve, 500));
    expect(logger.warn).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('Missing Telegram config for company c1')
    );
    expect(logger.warn).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('Missing Telegram config for company c1')
    );
    expect(getMerchantsDao).not.toHaveBeenCalled();
    expect(getPayInsForSuccessRatioDao).not.toHaveBeenCalled();
  });
});