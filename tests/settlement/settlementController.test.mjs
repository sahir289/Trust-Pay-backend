// -------------------- ESM MOCKS --------------------
/* global describe, it, expect, beforeEach, afterEach, beforeAll */
import { jest } from '@jest/globals';
jest.unstable_mockModule('../../src/apis/settlement/settlementServices.js', () => ({
  createSettlementService: jest.fn(),
  deleteSettlementService: jest.fn(),
  getSettlementService: jest.fn(),
  getSettlementServiceById: jest.fn(),
  getSettlementsBySearchService: jest.fn(),
  updateSettlementService: jest.fn(),
}));
jest.unstable_mockModule('../../src/utils/responseHandlers.js', () => ({
  sendSuccess: jest.fn(),
  sendError: jest.fn(),
}));
jest.unstable_mockModule('../../src/utils/controllerCache.js', () => ({
  readJsonCache: jest.fn(),
  writeJsonCache: jest.fn(),
  shouldServeCachedResponse: jest.fn(),
  normalizeQueryForCache: jest.fn(),
  invalidateCompanyCacheByPrefix: jest.fn(),
}));
jest.unstable_mockModule('../../src/utils/logger.js', () => ({
  logger: { info: jest.fn() },
}));

// -------------------- HELPERS ----------------------
function mockReqRes({ body = {}, params = {}, query = {}, headers = {}, user = {}, file = undefined } = {}) {
  return {
    req: { body, params, query, headers, user, file },
    res: { json: jest.fn(), status: jest.fn().mockReturnThis(), send: jest.fn() },
  };
}

// -------------------- IMPORTS (via beforeAll) ----------------------
let controllerModule, responseHandlers, services, controllerCache;
beforeAll(async () => {
  controllerModule = await import('../../src/apis/settlement/settlementController.js');
  responseHandlers = await import('../../src/utils/responseHandlers.js');
  services = await import('../../src/apis/settlement/settlementServices.js');
  controllerCache = await import('../../src/utils/controllerCache.js');
});

beforeEach(() => {
  if (services) {
    services.createSettlementService = jest.fn();
    services.deleteSettlementService = jest.fn();
    services.getSettlementService = jest.fn();
    services.getSettlementServiceById = jest.fn();
    services.getSettlementsBySearchService = jest.fn();
    services.updateSettlementService = jest.fn();
  }
  if (responseHandlers) {
    responseHandlers.sendSuccess = jest.fn();
    responseHandlers.sendError = jest.fn();
  }
  if (controllerCache) {
    controllerCache.readJsonCache = jest.fn();
    controllerCache.writeJsonCache = jest.fn();
    controllerCache.shouldServeCachedResponse = jest.fn();
  }
});

afterEach(() => {
  jest.clearAllMocks();
});

// -------------------- TESTS ------------------------
describe('settlementController', () => {
  const uuid = '550e8400-e29b-41d4-a716-446655440000';
  describe('getSettlementControllerById', () => {
    it('should return cached data if available', async () => {
      controllerCache.readJsonCache.mockResolvedValue('cached');
      controllerCache.shouldServeCachedResponse.mockReturnValue(true);
      const { req, res } = mockReqRes({ params: { id: uuid }, user: { company_id: 2, role: 'ADMIN' }, query: {} });
      await controllerModule.getSettlementControllerById(req, res);
      expect(responseHandlers.sendSuccess).toHaveBeenCalledWith(res, 'cached', 'got settlement');
    });
    it('should call service and write cache if not cached', async () => {
      controllerCache.readJsonCache.mockResolvedValue(null);
      controllerCache.shouldServeCachedResponse.mockReturnValue(false);
      services.getSettlementServiceById.mockResolvedValue('data');
      controllerCache.writeJsonCache.mockResolvedValue();
      const { req, res } = mockReqRes({ params: { id: uuid }, user: { company_id: 2, role: 'ADMIN' }, query: {} });
      await controllerModule.getSettlementControllerById(req, res);
      expect(services.getSettlementServiceById).toHaveBeenCalled();
      expect(controllerCache.writeJsonCache).toHaveBeenCalled();
      expect(responseHandlers.sendSuccess).toHaveBeenCalledWith(res, 'data', 'got settlement');
    });
  });

  describe('getSettlementController', () => {
    it('should return cached data if available', async () => {
      controllerCache.readJsonCache.mockResolvedValue('cached');
      controllerCache.shouldServeCachedResponse.mockReturnValue(true);
      const { req, res } = mockReqRes({ user: { company_id: 2, user_id: 3, role: 'ADMIN', designation: 'ADMIN' }, query: {} });
      await controllerModule.getSettlementController(req, res);
      expect(responseHandlers.sendSuccess).toHaveBeenCalledWith(res, 'cached', 'Settlements retrieved successfully');
    });
    it('should call service and write cache if not cached', async () => {
      controllerCache.readJsonCache.mockResolvedValue(null);
      controllerCache.shouldServeCachedResponse.mockReturnValue(false);
      services.getSettlementService.mockResolvedValue(['item']);
      controllerCache.writeJsonCache.mockResolvedValue();
      const { req, res } = mockReqRes({ user: { company_id: 2, user_id: 3, role: 'ADMIN', designation: 'ADMIN' }, query: {} });
      await controllerModule.getSettlementController(req, res);
      expect(services.getSettlementService).toHaveBeenCalled();
      expect(controllerCache.writeJsonCache).toHaveBeenCalled();
      expect(responseHandlers.sendSuccess).toHaveBeenCalledWith(res, ['item'], 'Settlements retrieved successfully');
    });
    it('should handle empty result', async () => {
      controllerCache.readJsonCache.mockResolvedValue(null);
      controllerCache.shouldServeCachedResponse.mockReturnValue(false);
      services.getSettlementService.mockResolvedValue([]);
      controllerCache.writeJsonCache.mockResolvedValue();
      const { req, res } = mockReqRes({ user: { company_id: 2, user_id: 3, role: 'ADMIN', designation: 'ADMIN' }, query: {} });
      await controllerModule.getSettlementController(req, res);
      expect(responseHandlers.sendSuccess).toHaveBeenCalledWith(res, [], 'No settlements found');
    });
  });

  describe('getSettlementsBySearch', () => {
    it('should return cached data if available', async () => {
      controllerCache.readJsonCache.mockResolvedValue('cached');
      controllerCache.shouldServeCachedResponse.mockReturnValue(true);
      const { req, res } = mockReqRes({ user: { company_id: 2, user_id: 3, role: 'ADMIN', designation: 'ADMIN' }, query: {} });
      await controllerModule.getSettlementsBySearch(req, res);
      expect(responseHandlers.sendSuccess).toHaveBeenCalledWith(res, 'cached', 'Settlements retrieved successfully');
    });
    it('should call service and write cache if not cached', async () => {
      controllerCache.readJsonCache.mockResolvedValue(null);
      controllerCache.shouldServeCachedResponse.mockReturnValue(false);
      services.getSettlementsBySearchService.mockResolvedValue(['item']);
      controllerCache.writeJsonCache.mockResolvedValue();
      const { req, res } = mockReqRes({ user: { company_id: 2, user_id: 3, role: 'ADMIN', designation: 'ADMIN' }, query: {} });
      await controllerModule.getSettlementsBySearch(req, res);
      expect(services.getSettlementsBySearchService).toHaveBeenCalled();
      expect(controllerCache.writeJsonCache).toHaveBeenCalled();
      expect(responseHandlers.sendSuccess).toHaveBeenCalledWith(res, ['item'], 'Settlements retrieved successfully');
    });
    it('should handle empty result', async () => {
      controllerCache.readJsonCache.mockResolvedValue(null);
      controllerCache.shouldServeCachedResponse.mockReturnValue(false);
      services.getSettlementsBySearchService.mockResolvedValue([]);
      controllerCache.writeJsonCache.mockResolvedValue();
      const { req, res } = mockReqRes({ user: { company_id: 2, user_id: 3, role: 'ADMIN', designation: 'ADMIN' }, query: {} });
      await controllerModule.getSettlementsBySearch(req, res);
      expect(responseHandlers.sendSuccess).toHaveBeenCalledWith(res, [], 'No settlements found');
    });
  });

  describe('createSettlementController', () => {
    it('should call service and send success', async () => {
      services.createSettlementService.mockResolvedValue({ id: uuid });
      const userUuid = '550e8400-e29b-41d4-a716-446655440000';
      const companyUuid = '550e8400-e29b-41d4-a716-446655440002';
      const { req, res } = mockReqRes({ body: { amount: 100, method: 'BANK', wallet_balance: '0' }, user: { company_id: companyUuid, user_id: userUuid, user_name: 'test', designation: 'ADMIN', role: 'ADMIN' } });
      await controllerModule.createSettlementController(req, res);
      expect(services.createSettlementService).toHaveBeenCalled();
      expect(responseHandlers.sendSuccess).toHaveBeenCalledWith(res, { id: uuid, created_by: 'test' }, 'Created Settlement Successfully');
    });
  });

  describe('updateSettlementController', () => {
    it('should call service and send success', async () => {
      services.updateSettlementService.mockResolvedValue({ id: uuid });
      const userUuid = '550e8400-e29b-41d4-a716-446655440001';
      const companyUuid = '550e8400-e29b-41d4-a716-446655440002';
      const { req, res } = mockReqRes({ params: { id: uuid }, body: { config: {} }, user: { company_id: companyUuid, user_id: userUuid, user_name: 'test', role: 'ADMIN' } });
      await controllerModule.updateSettlementController(req, res);
      expect(services.updateSettlementService).toHaveBeenCalled();
      expect(responseHandlers.sendSuccess).toHaveBeenCalledWith(res, { id: uuid, updated_by: 'test' }, 'Updated settlement');
    });
  });

  describe('deleteSettlementController', () => {
    it('should call service and send success', async () => {
      services.deleteSettlementService.mockResolvedValue({ id: uuid });
      const { req, res } = mockReqRes({ params: { id: uuid }, user: { company_id: 2, user_id: 3, user_name: 'test', role: 'ADMIN' } });
      await controllerModule.deleteSettlementController(req, res);
      expect(services.deleteSettlementService).toHaveBeenCalled();
      expect(responseHandlers.sendSuccess).toHaveBeenCalledWith(res, { id: uuid, deleted_by: 'test' }, 'Deleted settlement Successfully');
    });
  });

  // ─────────────────────────────────────────────
  // getSettlementController
  // ─────────────────────────────────────────────
  describe('getSettlementController', () => {
    let req, res;
    beforeEach(() => {
      req = { user: { company_id: 2, user_id: 3, role: 'ADMIN', designation: 'ADMIN' }, query: {} };
      res = {};
    });

    it('should return cached data if available', async () => {
      controllerCache.readJsonCache.mockResolvedValue('cached');
      controllerCache.shouldServeCachedResponse.mockReturnValue(true);
      await controllerModule.getSettlementController(req, res);
      expect(responseHandlers.sendSuccess).toHaveBeenCalledWith(res, 'cached', 'Settlements retrieved successfully');
    });

    it('should call service and write cache if not cached', async () => {
      controllerCache.readJsonCache.mockResolvedValue(null);
      controllerCache.shouldServeCachedResponse.mockReturnValue(false);
      services.getSettlementService.mockResolvedValue(['item']);
      controllerCache.writeJsonCache.mockResolvedValue();
      await controllerModule.getSettlementController(req, res);
      expect(services.getSettlementService).toHaveBeenCalled();
      expect(controllerCache.writeJsonCache).toHaveBeenCalled();
      expect(responseHandlers.sendSuccess).toHaveBeenCalledWith(res, ['item'], 'Settlements retrieved successfully');
    });

    it('should handle empty result', async () => {
      controllerCache.readJsonCache.mockResolvedValue(null);
      controllerCache.shouldServeCachedResponse.mockReturnValue(false);
      services.getSettlementService.mockResolvedValue([]);
      controllerCache.writeJsonCache.mockResolvedValue();
      await controllerModule.getSettlementController(req, res);
      expect(responseHandlers.sendSuccess).toHaveBeenCalledWith(res, [], 'No settlements found');
    });
  });

  // ─────────────────────────────────────────────
  // getSettlementsBySearch
  // ─────────────────────────────────────────────
  describe('getSettlementsBySearch', () => {
    let req, res;
    beforeEach(() => {
      req = { user: { company_id: 2, user_id: 3, role: 'ADMIN', designation: 'ADMIN' }, query: {} };
      res = {};
    });

    it('should return cached data if available', async () => {
      controllerCache.readJsonCache.mockResolvedValue('cached');
      controllerCache.shouldServeCachedResponse.mockReturnValue(true);
      await controllerModule.getSettlementsBySearch(req, res);
      expect(responseHandlers.sendSuccess).toHaveBeenCalledWith(res, 'cached', 'Settlements retrieved successfully');
    });

    it('should call service and write cache if not cached', async () => {
      controllerCache.readJsonCache.mockResolvedValue(null);
      controllerCache.shouldServeCachedResponse.mockReturnValue(false);
      services.getSettlementsBySearchService.mockResolvedValue(['item']);
      controllerCache.writeJsonCache.mockResolvedValue();
      await controllerModule.getSettlementsBySearch(req, res);
      expect(services.getSettlementsBySearchService).toHaveBeenCalled();
      expect(controllerCache.writeJsonCache).toHaveBeenCalled();
      expect(responseHandlers.sendSuccess).toHaveBeenCalledWith(res, ['item'], 'Settlements retrieved successfully');
    });

    it('should handle empty result', async () => {
      controllerCache.readJsonCache.mockResolvedValue(null);
      controllerCache.shouldServeCachedResponse.mockReturnValue(false);
      services.getSettlementsBySearchService.mockResolvedValue([]);
      controllerCache.writeJsonCache.mockResolvedValue();
      await controllerModule.getSettlementsBySearch(req, res);
      expect(responseHandlers.sendSuccess).toHaveBeenCalledWith(res, [], 'No settlements found');
    });
  });

  // ─────────────────────────────────────────────
  // createSettlementController
  // ─────────────────────────────────────────────
  describe('createSettlementController', () => {
    let req, res;
    const userUuid = '550e8400-e29b-41d4-a716-446655440000';
    const companyUuid = '550e8400-e29b-41d4-a716-446655440002';
    beforeEach(() => {
      req = { body: { amount: 100, method: 'BANK', wallet_balance: '0' }, user: { company_id: companyUuid, user_id: userUuid, user_name: 'test', designation: 'ADMIN', role: 'ADMIN' } };
      res = {};
    });

    it('should call service and send success', async () => {
      services.createSettlementService.mockResolvedValue({ id: uuid });
      await controllerModule.createSettlementController(req, res);
      expect(services.createSettlementService).toHaveBeenCalled();
      expect(responseHandlers.sendSuccess).toHaveBeenCalledWith(res, { id: uuid, created_by: 'test' }, 'Created Settlement Successfully');
    });
  });

  // ─────────────────────────────────────────────
  // updateSettlementController
  // ─────────────────────────────────────────────
  describe('updateSettlementController', () => {
    let req, res;
    const userUuid = '550e8400-e29b-41d4-a716-446655440001';
    const companyUuid = '550e8400-e29b-41d4-a716-446655440002';
    beforeEach(() => {
      req = { params: { id: uuid }, body: { config: {} }, user: { company_id: companyUuid, user_id: userUuid, user_name: 'test', role: 'ADMIN' } };
      res = {};
    });

    it('should call service and send success', async () => {
      services.updateSettlementService.mockResolvedValue({ id: uuid });
      await controllerModule.updateSettlementController(req, res);
      expect(services.updateSettlementService).toHaveBeenCalled();
      expect(responseHandlers.sendSuccess).toHaveBeenCalledWith(res, { id: uuid, updated_by: 'test' }, 'Updated settlement');
    });
  });

  // ─────────────────────────────────────────────
  // deleteSettlementController
  // ─────────────────────────────────────────────
  describe('deleteSettlementController', () => {
    let req, res;
    beforeEach(() => {
      req = { params: { id: uuid }, user: { company_id: 2, user_id: 3, user_name: 'test', role: 'ADMIN' } };
      res = {};
    });

    it('should call service and send success', async () => {
      services.deleteSettlementService.mockResolvedValue({ id: uuid });
      await controllerModule.deleteSettlementController(req, res);
      expect(services.deleteSettlementService).toHaveBeenCalled();
      expect(responseHandlers.sendSuccess).toHaveBeenCalledWith(res, { id: uuid, deleted_by: 'test' }, 'Deleted settlement Successfully');
    });
  });
});
