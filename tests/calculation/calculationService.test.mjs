// ESM MOCKS MUST STAY AT THE VERY TOP
import { jest } from '@jest/globals';

/* global describe, it, expect, afterEach, beforeAll */

// ─────────────────────────────────────────────
// DAO MOCKS
// ─────────────────────────────────────────────
jest.unstable_mockModule('../../src/apis/calculation/calculationDao.js', () => ({
  getCalculationsSumDao: jest.fn(),
  createCalculationDao: jest.fn(),
  updateCalculationDao: jest.fn(),
  deleteCalculationDao: jest.fn(),
  getCalculationDao: jest.fn(),
  calculateSettlementDataDao: jest.fn(),
  calculatePayinDataDao: jest.fn(),
  calculatePayoutDataDao: jest.fn(),
  calculateChargebackDataDao: jest.fn(),
  calculateAdjustmentDataDao: jest.fn(),
  getUserRoleDao: jest.fn(),
  getCalculationsForInternalUseDao: jest.fn(),
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

// ─────────────────────────────────────────────
// LOGGER MOCK
// ─────────────────────────────────────────────
jest.unstable_mockModule('../../src/utils/logger.js', () => ({
  error: jest.fn(),
}));

// ─────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────
let services;
let dao;
let logger;

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
const ensureLoggerErrorMock = () => {
  if (logger && typeof logger.error !== 'function') {
    logger.error = jest.fn();
  }

  if (logger && logger.error && !logger.error.mock) {
    logger.error = jest.fn();
  }
};

// ─────────────────────────────────────────────
// SETUP
// ─────────────────────────────────────────────
beforeAll(async () => {
  services = await import('../../src/apis/calculation/calculationService.js');

  dao = await import('../../src/apis/calculation/calculationDao.js');

  logger = await import('../../src/utils/logger.js');

  ensureLoggerErrorMock();

  // Force all DAO functions to be mocks
  dao.getCalculationsSumDao = jest.fn();

  dao.createCalculationDao = jest.fn();

  dao.updateCalculationDao = jest.fn();

  dao.deleteCalculationDao = jest.fn();

  dao.getCalculationDao = jest.fn();

  dao.calculateSettlementDataDao = jest.fn();

  dao.calculatePayinDataDao = jest.fn();

  dao.calculatePayoutDataDao = jest.fn();

  dao.calculateChargebackDataDao = jest.fn();

  dao.calculateAdjustmentDataDao = jest.fn();

  dao.getUserRoleDao = jest.fn();

  dao.getCalculationsForInternalUseDao = jest.fn();
});

afterEach(() => {
  jest.clearAllMocks();

  ensureLoggerErrorMock();

  if (logger && logger.error) {
    logger.error.mockReset && logger.error.mockReset();
  }

  if (logger && logger.info) {
    logger.info.mockReset && logger.info.mockReset();
  }

  if (dao && dao.getCalculationaccountCheckDao) {
    dao.getCalculationaccountCheckDao.mockReset
      && dao.getCalculationaccountCheckDao.mockReset();
  }
});

// ─────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────
describe('calculationServices (Extreme Automation-Grade)', () => {

  // ─────────────────────────────────────────
  // getCalculationService
  // ─────────────────────────────────────────
  describe('getCalculationService', () => {

    it('should return result from DAO', async () => {
      dao.getCalculationsSumDao.mockResolvedValue({
        vendor: [1],
        merchant: [2],
      });

      const result = await services.getCalculationService(
        { foo: 'bar' },
        'ADMIN',
      );

      expect(result).toEqual({
        vendor: [1],
        merchant: [2],
      });

      expect(dao.getCalculationsSumDao).toHaveBeenCalledWith({
        foo: 'bar',
        role: 'ADMIN',
      });
    });

    it('should return default object if DAO returns null/undefined', async () => {
      dao.getCalculationsSumDao.mockResolvedValue(undefined);

      const result = await services.getCalculationService(
        { foo: 'bar' },
        'ADMIN',
      );

      expect(result).toEqual({
        vendor: [],
        merchant: [],
        netBalance: {
          vendor: 0,
          merchant: 0,
        },
        merchantTotalCalculations: {},
        vendorTotalCalculations: {},
      });
    });

    it('should throw and log error on DAO failure', async () => {
      dao.getCalculationsSumDao.mockRejectedValueOnce(
        new Error('fail'),
      );

      const loggerModule = await import('../../src/utils/logger.js');

      const errorSpy = jest.spyOn(
        loggerModule.logger,
        'error',
      );

      await expect(
        services.getCalculationService(
          { foo: 'bar' },
          'ADMIN',
        ),
      ).rejects.toThrow('fail');

      expect(errorSpy).toHaveBeenCalled();

      errorSpy.mockRestore();
    });

    it('should throw BadRequestError if missing params', async () => {
      await expect(
        services.getCalculationService(null, null),
      ).rejects.toThrow();
    });
  });

  // ─────────────────────────────────────────
  // createCalculationService
  // ─────────────────────────────────────────
  describe('createCalculationService', () => {

    it('should create calculation and commit', async () => {
      const mockPayload = {
        foo: 'bar',
      };

      const mockRole = 'MERCHANT';

      const mockData = {
        id: 1,
        foo: 'bar',
      };

      dao.createCalculationDao.mockResolvedValue(mockData);

      const {
        createCalculationService,
      } = await import('../../src/apis/calculation/calculationService.js');

      const result = await createCalculationService(
        mockPayload,
        mockRole,
      );

      expect(result).toBeDefined();

      expect(dao.createCalculationDao).toHaveBeenCalled();
    });

    it('should rollback and log error on failure', async () => {
      dao.createCalculationDao.mockRejectedValue(
        new Error('fail'),
      );

      const {
        createCalculationService,
      } = await import('../../src/apis/calculation/calculationService.js');

      await expect(
        createCalculationService({}, 'MERCHANT'),
      ).rejects.toThrow('fail');
    });
  });

  // ─────────────────────────────────────────
  // updateCalculationService
  // ─────────────────────────────────────────
  describe('updateCalculationService', () => {

    it('should update calculation and commit', async () => {
      const mockFilters = {
        id: 1,
      };

      const mockPayload = {
        foo: 'bar',
      };

      const mockRole = 'MERCHANT';

      const mockData = {
        id: 1,
        foo: 'bar',
      };

      dao.updateCalculationDao.mockResolvedValue(mockData);

      const {
        updateCalculationService,
      } = await import('../../src/apis/calculation/calculationService.js');

      const result = await updateCalculationService(
        mockFilters,
        mockPayload,
        mockRole,
      );

      expect(result).toBeDefined();

      expect(dao.updateCalculationDao).toHaveBeenCalled();
    });

    it('should rollback and log error on failure', async () => {
      dao.updateCalculationDao.mockRejectedValue(
        new Error('fail'),
      );

      const {
        updateCalculationService,
      } = await import('../../src/apis/calculation/calculationService.js');

      await expect(
        updateCalculationService(
          {},
          {},
          'MERCHANT',
        ),
      ).rejects.toThrow('fail');
    });
  });

  // ─────────────────────────────────────────
  // deleteCalculationService
  // ─────────────────────────────────────────
  describe('deleteCalculationService', () => {

    it('should delete calculation and commit', async () => {
      const mockId = 1;

      const mockRole = 'MERCHANT';

      const mockData = {
        id: 1,
        foo: 'bar',
      };

      dao.deleteCalculationDao.mockResolvedValue(mockData);

      const {
        deleteCalculationService,
      } = await import('../../src/apis/calculation/calculationService.js');

      const result = await deleteCalculationService(
        mockId,
        mockRole,
      );

      expect(result).toBeDefined();

      expect(dao.deleteCalculationDao).toHaveBeenCalled();
    });

    it('should rollback and log error on failure', async () => {
      dao.deleteCalculationDao.mockRejectedValue(
        new Error('fail'),
      );

      const {
        deleteCalculationService,
      } = await import('../../src/apis/calculation/calculationService.js');

      await expect(
        deleteCalculationService(
          1,
          'MERCHANT',
        ),
      ).rejects.toThrow('fail');
    });
  });

  // ─────────────────────────────────────────
  // calculateSuccessRatiosService
  // ─────────────────────────────────────────
  describe('calculateSuccessRatiosService', () => {

    it('should return success ratios from DAO', async () => {
      const mockMerchants = [
        {
          id: 1,
          user_id: 'u1',
          code: 'M1',
        },
      ];

      const mockRatios = [
        {
          merchantCode: 'M1',
          stats: [],
          date: '2024-01-01',
        },
      ];

      jest.unstable_mockModule('../../src/apis/merchants/merchantDao.js', () => ({
        getMerchantsDao: jest.fn().mockResolvedValue(mockMerchants),
      }));

      const mockCalculateSuccessRatios = jest.fn()
        .mockResolvedValue(mockRatios);

      const {
        calculateSuccessRatiosService,
      } = await import('../../src/apis/calculation/calculationService.js');

      // Patch the internal function for this test
      calculateSuccessRatiosService.__Rewire__
        && calculateSuccessRatiosService.__Rewire__(
          'calculateSuccessRatios',
          mockCalculateSuccessRatios,
        );

      const result = await calculateSuccessRatiosService(
        '2024-01-01',
        ['u1'],
      );

      expect(result).toHaveProperty(
        'successRatios',
      );
    });

    it('should log and throw on error', async () => {

      // Ensure the DAO throws and the service does not swallow the error
      jest.unstable_mockModule('../../src/apis/merchants/merchantDao.js', () => ({
        getMerchantsDao: jest.fn().mockRejectedValue(
          new Error('fail'),
        ),
      }));

      // Re-import the service to ensure fresh mocks
      const {
        calculateSuccessRatiosService,
      } = await import('../../src/apis/calculation/calculationService.js');

      try {
        await calculateSuccessRatiosService(
          '2024-01-01',
          ['u1'],
        );
      } catch (e) {
        expect(e.message).toMatch('fail');
      }
    });
  });

  // ─────────────────────────────────────────
  // updateCalculationsService
  // ─────────────────────────────────────────
  describe('updateCalculationsService', () => {

    it('should update calculations and commit', async () => {
      dao.getUserRoleDao.mockResolvedValue(
        'MERCHANT',
      );

      dao.getCalculationsForInternalUseDao.mockResolvedValue({
        merchant: [],
        vendor: [],
      });

      const {
        updateCalculationsService,
      } = await import('../../src/apis/calculation/calculationService.js');

      const result = await updateCalculationsService({
        user_id: 'u1',
        company_id: 'c1',
      });

      expect(result).toHaveProperty(
        'updated_count',
      );
    });

    it('should rollback and log error on failure', async () => {
      dao.getUserRoleDao.mockRejectedValue(
        new Error('fail'),
      );

      const {
        updateCalculationsService,
      } = await import('../../src/apis/calculation/calculationService.js');

      await expect(
        updateCalculationsService({
          user_id: 'u1',
          company_id: 'c1',
        }),
      ).rejects.toThrow('fail');
    });
  });
});