// __tests__/gatherNetbalance.test.js
import gatherAllNetbalanceForAllCompanies from './gatherAllNetBalance.js';
  import {
    sendTelegramMerchantDashboardReportMessage,
    sendTelegramVendorDashboardReportMessage,
  } from '../utils/sendTelegramMessages.js';
  import { getCompanyDao } from '../apis/company/companyDao.js';
  import { getMerchantNetBalanceDao, getVendorNetBalanceDao } from '../apis/calculation/calculationDao.js';
  import { getConnection } from '../utils/db.js';
  import { logger } from '../utils/logger.js';
  
  // Mock all dependencies
  jest.mock('../utils/sendTelegramMessages.js', () => ({
    sendTelegramMerchantDashboardReportMessage: jest.fn(),
    sendTelegramVendorDashboardReportMessage: jest.fn(),
  }));
  
  jest.mock('../apis/company/companyDao.js', () => ({
    getCompanyDao: jest.fn(),
  }));
  
  jest.mock('../apis/calculation/calculationDao.js', () => ({
    getMerchantNetBalanceDao: jest.fn(),
    getVendorNetBalanceDao: jest.fn(),
  }));
  
  jest.mock('../utils/db.js', () => ({
    getConnection: jest.fn(),
  }));
  
  jest.mock('../utils/logger.js', () => ({
    logger: {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    },
  }));
  
  describe('gatherAllNetbalanceForAllCompanies', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });
  
    it('should log and return if no companies are found', async () => {
      getCompanyDao.mockResolvedValue([]);
      await gatherAllNetbalanceForAllCompanies();
      expect(logger.info).toHaveBeenCalledWith('No companies found');
    });
  
    it('should process companies and send merchant and vendor reports', async () => {
      const mockCompanies = [
        { id: 'company-1', config: { telegramVendorReportChatId: 'chat-1', telegramBotToken: 'token-1' } },
      ];
      getCompanyDao.mockResolvedValue(mockCompanies);
      getMerchantNetBalanceDao.mockResolvedValue([{ merchantId: 'm1', balance: 100 }]);
      getVendorNetBalanceDao.mockResolvedValue([{ vendorId: 'v1', balance: 200 }]);
      const mockConn = { release: jest.fn() };
      getConnection.mockResolvedValue(mockConn);
  
      await gatherAllNetbalanceForAllCompanies();
  
      expect(logger.info).toHaveBeenCalledWith('Starting gather data for all companies');
    //   expect(getCompanyDao).toHaveBeenCalledTimes(2); 
      expect(sendTelegramMerchantDashboardReportMessage).toHaveBeenCalledWith(
        'chat-1',
        [{ merchantId: 'm1', balance: 100 }],
        'token-1',
        'Daily Report'
      );
      expect(sendTelegramVendorDashboardReportMessage).toHaveBeenCalledWith(
        'chat-1',
        [{ vendorId: 'v1', balance: 200 }],
        'token-1',
        'Daily Report'
      );
      expect(mockConn.release).toHaveBeenCalled();
    });
  
    it('should log error if DAO throws error', async () => {
      getCompanyDao.mockRejectedValue(new Error('DAO Error'));
      await gatherAllNetbalanceForAllCompanies();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error in gatherAllNetbalanceForAllCompanies')
      );
    });

  });
  