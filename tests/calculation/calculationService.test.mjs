/* global describe, it, expect, afterEach, beforeAll */
import { jest } from '@jest/globals';
jest.unstable_mockModule('../../src/apis/calculation/calculationDao.js', () => ({
  getCalculationDaoAll: jest.fn(),
  getCalculationBySearchDao: jest.fn(),
  updateCalculationDao: jest.fn(),
  getCalculationDao: jest.fn(),
  getPayInsForResetCalculationDao: jest.fn(),
  createCalculationDao: jest.fn().mockResolvedValue({ status: '/success', calculation_id: 'dummy-id' }),
  getCheckCalculationDao: jest.fn(),
  getForCreateCalculationDao: jest.fn().mockResolvedValue({ status: '/success', calculation_id: 'dummy-id' }),
  getPayInsCalculationDao: jest.fn(),
  getCalculationaccountCheckDao: jest.fn(),
}));
jest.unstable_mockModule('../../src/utils/logger.js', () => ({
  error: jest.fn(),
}));
jest.unstable_mockModule('../../src/apis/bankAccounts/bankaccountDao.js', () => ({
  getBankaccountCheckDao: jest.fn(),
  getBankaccountDashBoardReportDao: jest.fn(),
}));
jest.unstable_mockModule('../../src/apis/merchants/merchantDao.js', () => ({
  getMerchantsCalculationDao: jest.fn(),
}));
jest.unstable_mockModule('../../src/apis/vendors/vendorDao.js', () => ({
  getVendorsCalculationReponseDao: jest.fn(),
}));

let services, dao, logger;
let realUserId;
const alwaysMockCalculationaccountCheck = () => {
  if (dao && dao.getCalculationaccountCheckDao) {
    dao.getCalculationaccountCheckDao.mockResolvedValueOnce(true);
  }
};
const ensureLoggerErrorMock = () => {
  if (logger && typeof logger.error !== 'function') {
    logger.error = jest.fn();
  }
  if (logger && logger.error && !logger.error.mock) {
    logger.error = jest.fn();
  }
};
beforeAll(async () => {
  services = await import('../../src/apis/calculation/calculationService.js');
  dao = await import('../../src/apis/calculation/calculationDao.js');
  logger = await import('../../src/utils/logger.js');
  ensureLoggerErrorMock();
  realUserId = 'f83999c4-5e57-419e-847f-66893f56c3cf';
});
afterEach(() => {
  jest.clearAllMocks();
  ensureLoggerErrorMock();
  if (logger && logger.error) logger.error.mockReset && logger.error.mockReset();
  if (logger && logger.info) logger.info.mockReset && logger.info.mockReset();
  if (dao && dao.getCalculationaccountCheckDao) dao.getCalculationaccountCheckDao.mockReset && dao.getCalculationaccountCheckDao.mockReset();
});
describe('calculationServices (Extreme Automation-Grade)', () => {
  describe('getCalculationService', () => {
    it('should apply default date window if needed', async () => {
      alwaysMockCalculationaccountCheck();
      await services.getCalculationService({}, 'ADMIN', 1, 10, null, false, null, null, null, realUserId);
      expect(dao.getCalculationDaoAll).toHaveBeenCalled();
    });
    it('should throw and log error on DAO failure', async () => {
      alwaysMockCalculationaccountCheck();
      dao.getCalculationDaoAll.mockRejectedValueOnce(new Error('fail'));
      const loggerModule = await import('../../src/utils/logger.js');
      const errorSpy = jest.spyOn(loggerModule.logger, 'error');
      await expect(services.getCalculationService({}, 'ADMIN', 1, 10, null, false, null, null, null, realUserId)).rejects.toThrow('fail');
      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });
  });

  // Add more service tests as needed, similar to bankResponseServices
});
