/* global describe, it, expect, beforeEach, beforeAll */
import { jest } from '@jest/globals';

// ─────────────────────────────────────────────
// MOCKS
// ─────────────────────────────────────────────
jest.unstable_mockModule('../../src/apis/reports/reportsService.js', () => ({
  getPayInReportService: jest.fn(),
  getPayOutReportService: jest.fn(),
  getClientsAccountReportService: jest.fn(),
}));

jest.unstable_mockModule('../../src/utils/responseHandlers.js', () => ({
  sendSuccess: jest.fn(),
}));

// ─────────────────────────────────────────────
// IMPORTS (after mocks)
// ─────────────────────────────────────────────
let controllers, reportsService, responseHandlers;

beforeAll(async () => {
  controllers = await import('../../src/apis/reports/reportsController.js');
  reportsService = await import('../../src/apis/reports/reportsService.js');
  responseHandlers = await import('../../src/utils/responseHandlers.js');
});

// ─────────────────────────────────────────────
// RESET MOCKS
// ─────────────────────────────────────────────
beforeEach(() => {
  jest.clearAllMocks();

  if (reportsService) {
    reportsService.getPayInReportService = jest.fn();
    reportsService.getPayOutReportService = jest.fn();
    reportsService.getClientsAccountReportService = jest.fn();
  }

  if (responseHandlers) {
    responseHandlers.sendSuccess = jest.fn();
  }
});

// ─────────────────────────────────────────────
// TEST SUITE
// ─────────────────────────────────────────────
describe('reportsController', () => {

  const controllerNames = [
    'getPayInReportController',
    'getPayOutReportController',
    'getClientsAccountReportController',
  ];

  controllerNames.forEach((name) => {
    it(`${name} should be defined`, () => {
      expect(controllers[name]).toBeDefined();
      expect(typeof controllers[name]).toBe('function');
    });
  });

  // ─────────────────────────────────────────────
  // GET PAY-IN REPORT
  // ─────────────────────────────────────────────
  describe('getPayInReportController', () => {
    let req, res;

    beforeEach(() => {
      req = {
        query: { startDate: '2025-01-01', endDate: '2025-01-31' },
        user: { user_id: 1, company_id: 10 },
      };

      res = {};
    });

    it('should fetch pay-in report successfully', async () => {
      const mockResult = [
        { id: 1, amount: 5000, status: 'success' },
        { id: 2, amount: 3000, status: 'pending' },
      ];

      reportsService.getPayInReportService.mockResolvedValue(mockResult);

      responseHandlers.sendSuccess.mockImplementation((res, data, msg) => {
        res._sent = { data, msg };
        return res;
      });

      await controllers.getPayInReportController(req, res);

      expect(reportsService.getPayInReportService).toHaveBeenCalledWith(req);
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();

      expect(res._sent.data).toEqual(mockResult);
      expect(res._sent.msg).toBe('Got Pay-In report');
    });
  });

  // ─────────────────────────────────────────────
  // GET PAY-OUT REPORT
  // ─────────────────────────────────────────────
  describe('getPayOutReportController', () => {
    let req, res;

    beforeEach(() => {
      req = {
        query: { startDate: '2025-01-01', endDate: '2025-01-31' },
        user: { user_id: 1, company_id: 10 },
      };

      res = {};
    });

    it('should fetch pay-out report successfully', async () => {
      const mockResult = [
        { id: 101, amount: 2000, beneficiary: 'John Doe' },
      ];

      reportsService.getPayOutReportService.mockResolvedValue(mockResult);

      responseHandlers.sendSuccess.mockImplementation((res, data, msg) => {
        res._sent = { data, msg };
        return res;
      });

      await controllers.getPayOutReportController(req, res);

      expect(reportsService.getPayOutReportService).toHaveBeenCalledWith(req);
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();

      expect(res._sent.data).toEqual(mockResult);
      expect(res._sent.msg).toBe('Payouts created successfully');
    });
  });

  // ─────────────────────────────────────────────
  // GET CLIENTS ACCOUNT REPORT
  // ─────────────────────────────────────────────
  describe('getClientsAccountReportController', () => {
    let req, res;

    beforeEach(() => {
      req = {
        query: { clientId: 5, startDate: '2025-01-01' },
        user: { user_id: 1, company_id: 10 },
      };

      res = {};
    });

    it('should fetch clients account report successfully', async () => {
      const mockResult = {
        totalBalance: 45000,
        transactions: [],
        clientInfo: { name: 'Acme Corp' },
      };

      reportsService.getClientsAccountReportService.mockResolvedValue(mockResult);

      responseHandlers.sendSuccess.mockImplementation((res, data, msg) => {
        res._sent = { data, msg };
        return res;
      });

      await controllers.getClientsAccountReportController(req, res);

      expect(reportsService.getClientsAccountReportService).toHaveBeenCalledWith(req);
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();

      expect(res._sent.data).toEqual(mockResult);
      expect(res._sent.msg).toBe('Reports fetched successfully');
    });
  });
});