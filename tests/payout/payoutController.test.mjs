// -------------------- ESM MOCKS --------------------
/* global describe, it, expect, beforeEach, afterEach, beforeAll */
import { jest } from '@jest/globals';

jest.unstable_mockModule('../../src/apis/payOut/payOutService.js', () => ({
  createPayoutService: jest.fn(),
  deletePayoutService: jest.fn(),
  getPayoutsService: jest.fn(),
  updatePayoutService: jest.fn(),
  getPayoutsBySearchService: jest.fn(),
  checkPayOutStatusService: jest.fn(),
  assignedPayoutService: jest.fn(),
  createTataPayBulkPayoutService: jest.fn(),
  createRupeeFlowBulkPayoutService: jest.fn(),
}));
jest.unstable_mockModule('../../src/utils/responseHandlers.js', () => ({
  sendSuccess: jest.fn(),
  sendNewSuccess: jest.fn(),
  sendError: jest.fn(),
}));
jest.unstable_mockModule('../../src/utils/appErrors.js', () => ({
  ValidationError: class extends Error {},
}));
jest.unstable_mockModule('../../src/schemas/payoutSchema.js', () => ({
  PAYOUT_DETAILS_SCHEMA: { validate: jest.fn() },
  UPDATE_DETAILS_SCHEMA: { validate: jest.fn() },
  VALIDATE_CHECK_PAY_OUT_STATUS: { validate: jest.fn() },
  VALIDATE_PAYOUT_BY_ID: { validate: jest.fn() },
  ASSIGNED_VENDOR_SCHEMA: { validate: jest.fn() },
  TATAPAY_BULK_PAYOUT_SCHEMA: { validate: jest.fn() },
  RUPEEFLOW_BULK_PAYOUT_SCHEMA: { validate: jest.fn() },
}));
jest.unstable_mockModule('../../src/utils/controllerCache.js', () => ({
  invalidateCompanyCacheByPrefix: jest.fn(),
}));

// -------------------- HELPERS ----------------------
function mockReqRes({ body = {}, params = {}, query = {}, headers = {}, user = {}, file = undefined } = {}) {
  return {
    req: { body, params, query, headers, user, file },
    res: { json: jest.fn(), status: jest.fn().mockReturnThis(), send: jest.fn() },
  };
}

// -------------------- IMPORTS (via beforeAll) ----------------------
let controllerModule, responseHandlers, payoutService, schema;
beforeAll(async () => {
  controllerModule = await import('../../src/apis/payOut/payOutController.js');
  responseHandlers = await import('../../src/utils/responseHandlers.js');
  payoutService = await import('../../src/apis/payOut/payOutService.js');
  schema = await import('../../src/schemas/payoutSchema.js');
});

beforeEach(() => {
  if (payoutService) {
    payoutService.createPayoutService = jest.fn();
    payoutService.deletePayoutService = jest.fn();
    payoutService.getPayoutsService = jest.fn();
    payoutService.updatePayoutService = jest.fn();
    payoutService.getPayoutsBySearchService = jest.fn();
    payoutService.checkPayOutStatusService = jest.fn();
    payoutService.assignedPayoutService = jest.fn();
    payoutService.createTataPayBulkPayoutService = jest.fn();
    payoutService.createRupeeFlowBulkPayoutService = jest.fn();
  }
  if (responseHandlers) {
    responseHandlers.sendSuccess = jest.fn();
    responseHandlers.sendNewSuccess = jest.fn();
    responseHandlers.sendError = jest.fn();
  }
  if (schema) {
    if (schema.PAYOUT_DETAILS_SCHEMA) schema.PAYOUT_DETAILS_SCHEMA.validate = jest.fn();
    if (schema.UPDATE_DETAILS_SCHEMA) schema.UPDATE_DETAILS_SCHEMA.validate = jest.fn();
    if (schema.VALIDATE_CHECK_PAY_OUT_STATUS) schema.VALIDATE_CHECK_PAY_OUT_STATUS.validate = jest.fn();
    if (schema.VALIDATE_PAYOUT_BY_ID) schema.VALIDATE_PAYOUT_BY_ID.validate = jest.fn();
    if (schema.ASSIGNED_VENDOR_SCHEMA) schema.ASSIGNED_VENDOR_SCHEMA.validate = jest.fn();
    if (schema.TATAPAY_BULK_PAYOUT_SCHEMA) schema.TATAPAY_BULK_PAYOUT_SCHEMA.validate = jest.fn();
    if (schema.RUPEEFLOW_BULK_PAYOUT_SCHEMA) schema.RUPEEFLOW_BULK_PAYOUT_SCHEMA.validate = jest.fn();
  }
});

afterEach(() => {
  jest.clearAllMocks();
});

// -------------------- TESTS ------------------------
describe('payoutController', () => {
  describe('createPayout', () => {
    it('should validate, call service, and send success', async () => {
      schema.PAYOUT_DETAILS_SCHEMA.validate.mockReturnValue({});
      payoutService.createPayoutService.mockResolvedValue({ merchant_order_id: 'order1', id: 1, amount: 100 });
      const { req, res } = mockReqRes({ body: { user_id: 1 } });
      req.user = { company_id: 1, role: 'MERCHANT', user_id: 1 };
      await controllerModule.createPayout(req, res);
      expect(schema.PAYOUT_DETAILS_SCHEMA.validate).toHaveBeenCalled();
      expect(payoutService.createPayoutService).toHaveBeenCalled();
      expect(responseHandlers.sendNewSuccess).toHaveBeenCalled();
    });
    it('should send error if status is 400/404', async () => {
      schema.PAYOUT_DETAILS_SCHEMA.validate.mockReturnValue({});
      payoutService.createPayoutService.mockResolvedValue({ status: 400, message: 'err' });
      const { req, res } = mockReqRes({ body: { user_id: 1 } });
      req.user = { company_id: 1, role: 'MERCHANT', user_id: 1 };
      await controllerModule.createPayout(req, res);
      expect(responseHandlers.sendError).toHaveBeenCalled();
    });
  });

  describe('getPayoutsById', () => {
    it('should validate, call service, and send success', async () => {
      schema.VALIDATE_PAYOUT_BY_ID.validate.mockReturnValue({});
      payoutService.getPayoutsService.mockResolvedValue({ id: 1 });
      const { req, res } = mockReqRes({ params: { id: 1 }, user: { company_id: 1, role: 'MERCHANT' } });
      await controllerModule.getPayoutsById(req, res);
      expect(schema.VALIDATE_PAYOUT_BY_ID.validate).toHaveBeenCalled();
      expect(payoutService.getPayoutsService).toHaveBeenCalled();
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    });
  });

  describe('getPayouts', () => {
    it('should call service and send success', async () => {
      payoutService.getPayoutsService.mockResolvedValue({ totalCount: 1, payout: [] });
      const { req, res } = mockReqRes({ user: { company_id: 1, role: 'MERCHANT', user_id: 1, designation: 'MERCHANT' }, query: { page: 1, limit: 10, sortOrder: 'asc' } });
      await controllerModule.getPayouts(req, res);
      expect(payoutService.getPayoutsService).toHaveBeenCalled();
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    });
  });

  describe('getPayoutsBySearch', () => {
    it('should call service and send success', async () => {
      payoutService.getPayoutsBySearchService.mockResolvedValue([]);
      const { req, res } = mockReqRes({ user: { company_id: 1, role: 'MERCHANT', user_id: 1, designation: 'MERCHANT' }, query: { search: '', page: 1, limit: 10 } });
      await controllerModule.getPayoutsBySearch(req, res);
      expect(payoutService.getPayoutsBySearchService).toHaveBeenCalled();
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    });
  });

  describe('updatePayout', () => {
    it('should validate, call service, and send success', async () => {
      schema.UPDATE_DETAILS_SCHEMA.validate.mockReturnValue({});
      payoutService.updatePayoutService.mockResolvedValue({ id: 1 });
      const { req, res } = mockReqRes({ params: { id: 1 }, body: {}, user: { company_id: 1, role: 'MERCHANT', user_id: 1, user_name: 'test' } });
      await controllerModule.updatePayout(req, res);
      expect(schema.UPDATE_DETAILS_SCHEMA.validate).toHaveBeenCalled();
      expect(payoutService.updatePayoutService).toHaveBeenCalled();
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    });
  });

  describe('deletePayout', () => {
    it('should validate, call service, and send success', async () => {
      schema.VALIDATE_PAYOUT_BY_ID.validate.mockReturnValue({});
      payoutService.deletePayoutService.mockResolvedValue();
      const { req, res } = mockReqRes({ params: { id: 1 }, user: { company_id: 1, user_id: 1, role: 'MERCHANT' } });
      await controllerModule.deletePayout(req, res);
      expect(schema.VALIDATE_PAYOUT_BY_ID.validate).toHaveBeenCalled();
      expect(payoutService.deletePayoutService).toHaveBeenCalled();
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    });
  });

  describe('checkPayOutStatus', () => {
    it('should validate, call service, and send success', async () => {
      schema.VALIDATE_CHECK_PAY_OUT_STATUS.validate.mockReturnValue({});
      payoutService.checkPayOutStatusService.mockResolvedValue({ status: 200 });
      const { req, res } = mockReqRes({ body: {}, headers: {} });
      await controllerModule.checkPayOutStatus(req, res);
      expect(schema.VALIDATE_CHECK_PAY_OUT_STATUS.validate).toHaveBeenCalled();
      expect(payoutService.checkPayOutStatusService).toHaveBeenCalled();
      expect(responseHandlers.sendNewSuccess).toHaveBeenCalled();
    });
    it('should send error if status is 400/404', async () => {
      schema.VALIDATE_CHECK_PAY_OUT_STATUS.validate.mockReturnValue({});
      payoutService.checkPayOutStatusService.mockResolvedValue({ status: 400, message: 'err' });
      const { req, res } = mockReqRes({ body: {}, headers: {} });
      await controllerModule.checkPayOutStatus(req, res);
      expect(responseHandlers.sendError).toHaveBeenCalled();
    });
  });

  describe('assignedPayout', () => {
    it('should validate, call service, and send success', async () => {
      schema.ASSIGNED_VENDOR_SCHEMA.validate.mockReturnValue({});
      payoutService.assignedPayoutService.mockResolvedValue([1,2]);
      const { req, res } = mockReqRes({ params: { id: 1 }, body: { payouts_ids: [1,2] }, user: { user_id: 1, user_name: 'test', company_id: 1 } });
      await controllerModule.assignedPayout(req, res);
      expect(schema.ASSIGNED_VENDOR_SCHEMA.validate).toHaveBeenCalled();
      expect(payoutService.assignedPayoutService).toHaveBeenCalled();
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    });
  });

  describe('createTataPayBulkPayoutController', () => {
    it('should validate, call service, and send success', async () => {
      schema.TATAPAY_BULK_PAYOUT_SCHEMA.validate.mockReturnValue({});
      payoutService.createTataPayBulkPayoutService.mockResolvedValue({ data: [], message: 'ok' });
      const { req, res } = mockReqRes({ body: { payoutEntries: [], payoutIds: [] }, user: { company_id: 1, user_id: 1 } });
      await controllerModule.createTataPayBulkPayoutController(req, res);
      expect(schema.TATAPAY_BULK_PAYOUT_SCHEMA.validate).toHaveBeenCalled();
      expect(payoutService.createTataPayBulkPayoutService).toHaveBeenCalled();
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    });
  });

  describe('createRupeeFlowBulkPayoutController', () => {
    it('should validate, call service, and send success', async () => {
      schema.RUPEEFLOW_BULK_PAYOUT_SCHEMA.validate.mockReturnValue({});
      payoutService.createRupeeFlowBulkPayoutService.mockResolvedValue({ data: [], message: 'ok' });
      const { req, res } = mockReqRes({ body: { payoutEntries: [], payoutIds: [] }, user: { company_id: 1, user_id: 1 } });
      await controllerModule.createRupeeFlowBulkPayoutController(req, res);
      expect(schema.RUPEEFLOW_BULK_PAYOUT_SCHEMA.validate).toHaveBeenCalled();
      expect(payoutService.createRupeeFlowBulkPayoutService).toHaveBeenCalled();
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    });
  });
});
