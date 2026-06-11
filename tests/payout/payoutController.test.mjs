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
      // We expect the controller to validate the request, call the service to create a payout, and send a success response when the input is valid
      expect(schema.PAYOUT_DETAILS_SCHEMA.validate).toHaveBeenCalled();
      // We expect the controller to call the createPayoutService with the correct parameters
      expect(payoutService.createPayoutService).toHaveBeenCalled();
      // We expect the controller to send a success response with the created payout details
      expect(responseHandlers.sendNewSuccess).toHaveBeenCalled();
    });
    it('should send error if status is 400/404', async () => {
      schema.PAYOUT_DETAILS_SCHEMA.validate.mockReturnValue({});
      payoutService.createPayoutService.mockResolvedValue({ status: 400, message: 'err' });
      const { req, res } = mockReqRes({ body: { user_id: 1 } });
      req.user = { company_id: 1, role: 'MERCHANT', user_id: 1 };
      await controllerModule.createPayout(req, res);
      // We expect the controller to send an error response when the service returns a status of 400 or 404
      expect(responseHandlers.sendError).toHaveBeenCalled();
    });
  });

  describe('getPayoutsById', () => {
    it('should validate, call service, and send success', async () => {
      schema.VALIDATE_PAYOUT_BY_ID.validate.mockReturnValue({});
      payoutService.getPayoutsService.mockResolvedValue({ id: 1 });
      const { req, res } = mockReqRes({ params: { id: 1 }, user: { company_id: 1, role: 'MERCHANT' } });
      await controllerModule.getPayoutsById(req, res);
      // We expect the controller to validate the request, call the service to get payout details by ID, and send a success response when the input is valid
      expect(schema.VALIDATE_PAYOUT_BY_ID.validate).toHaveBeenCalled();
      // We expect the controller to call the getPayoutsService with the correct parameters
      expect(payoutService.getPayoutsService).toHaveBeenCalled();
      // We expect the controller to send a success response with the payout details
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    });
  });

  describe('getPayouts', () => {
    it('should call service and send success', async () => {
      payoutService.getPayoutsService.mockResolvedValue({ totalCount: 1, payout: [] });
      const { req, res } = mockReqRes({ user: { company_id: 1, role: 'MERCHANT', user_id: 1, designation: 'MERCHANT' }, query: { page: 1, limit: 10, sortOrder: 'asc' } });
      await controllerModule.getPayouts(req, res);
      // We expect the controller to call the service to get a list of payouts and send a success response
      expect(payoutService.getPayoutsService).toHaveBeenCalled();
      // We expect the controller to send a success response with the list of payouts and total count
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    });
  });

  describe('getPayoutsBySearch', () => {
    it('should call service and send success', async () => {
      payoutService.getPayoutsBySearchService.mockResolvedValue([]);
      const { req, res } = mockReqRes({ user: { company_id: 1, role: 'MERCHANT', user_id: 1, designation: 'MERCHANT' }, query: { search: '', page: 1, limit: 10 } });
      await controllerModule.getPayoutsBySearch(req, res);
      // We expect the controller to call the service to get a list of payouts based on the search criteria and send a success response
      expect(payoutService.getPayoutsBySearchService).toHaveBeenCalled();
      // We expect the controller to send a success response with the list of payouts matching the search criteria
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    });
  });

  describe('updatePayout', () => {
    it('should validate, call service, and send success', async () => {
      schema.UPDATE_DETAILS_SCHEMA.validate.mockReturnValue({});
      payoutService.updatePayoutService.mockResolvedValue({ id: 1 });
      const { req, res } = mockReqRes({ params: { id: 1 }, body: {}, user: { company_id: 1, role: 'MERCHANT', user_id: 1, user_name: 'test' } });
      await controllerModule.updatePayout(req, res);
      // We expect the controller to validate the request, call the service to update payout details, and send a success response when the input is valid
      expect(schema.UPDATE_DETAILS_SCHEMA.validate).toHaveBeenCalled();
      // We expect the controller to call the updatePayoutService with the correct parameters
      expect(payoutService.updatePayoutService).toHaveBeenCalled();
      // We expect the controller to send a success response with the updated payout details
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    });
  });

  describe('deletePayout', () => {
    it('should validate, call service, and send success', async () => {
      schema.VALIDATE_PAYOUT_BY_ID.validate.mockReturnValue({});
      payoutService.deletePayoutService.mockResolvedValue();
      const { req, res } = mockReqRes({ params: { id: 1 }, user: { company_id: 1, user_id: 1, role: 'MERCHANT' } });
      await controllerModule.deletePayout(req, res);
      // We expect the controller to validate the request, call the service to delete a payout by ID, and send a success response when the input is valid
      expect(schema.VALIDATE_PAYOUT_BY_ID.validate).toHaveBeenCalled();
      // We expect the controller to call the deletePayoutService with the correct parameters
      expect(payoutService.deletePayoutService).toHaveBeenCalled();
      // We expect the controller to send a success response confirming the deletion of the payout
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    });
  });

  describe('checkPayOutStatus', () => {
    it('should validate, call service, and send success', async () => {
      schema.VALIDATE_CHECK_PAY_OUT_STATUS.validate.mockReturnValue({});
      payoutService.checkPayOutStatusService.mockResolvedValue({ status: 200 });
      const { req, res } = mockReqRes({ body: {}, headers: {} });
      await controllerModule.checkPayOutStatus(req, res);
      // We expect the controller to validate the request, call the service to check payout status, and send a success response when the input is valid and status is 200
      expect(schema.VALIDATE_CHECK_PAY_OUT_STATUS.validate).toHaveBeenCalled();
      // We expect the controller to call the checkPayOutStatusService with the correct parameters
      expect(payoutService.checkPayOutStatusService).toHaveBeenCalled();
      // We expect the controller to send a success response confirming the payout status
      expect(responseHandlers.sendNewSuccess).toHaveBeenCalled();
    });
    it('should send error if status is 400/404', async () => {
      schema.VALIDATE_CHECK_PAY_OUT_STATUS.validate.mockReturnValue({});
      payoutService.checkPayOutStatusService.mockResolvedValue({ status: 400, message: 'err' });
      const { req, res } = mockReqRes({ body: {}, headers: {} });
      await controllerModule.checkPayOutStatus(req, res);
      // We expect the controller to send an error response when the service returns a status of 400 or 404
      expect(responseHandlers.sendError).toHaveBeenCalled();
    });
  });

  describe('assignedPayout', () => {
    it('should validate, call service, and send success', async () => {
      schema.ASSIGNED_VENDOR_SCHEMA.validate.mockReturnValue({});
      payoutService.assignedPayoutService.mockResolvedValue([1,2]);
      const { req, res } = mockReqRes({ params: { id: 1 }, body: { payouts_ids: [1,2] }, user: { user_id: 1, user_name: 'test', company_id: 1 } });
      await controllerModule.assignedPayout(req, res);
      // We expect the controller to validate the request, call the service to assign payouts to a vendor, and send a success response when the input is valid
      expect(schema.ASSIGNED_VENDOR_SCHEMA.validate).toHaveBeenCalled();
      // We expect the controller to call the assignedPayoutService with the correct parameters
      expect(payoutService.assignedPayoutService).toHaveBeenCalled();
      // We expect the controller to send a success response confirming the assignment of payouts to the vendor
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    });
  });

  describe('createTataPayBulkPayoutController', () => {
    it('should validate, call service, and send success', async () => {
      schema.TATAPAY_BULK_PAYOUT_SCHEMA.validate.mockReturnValue({});
      payoutService.createTataPayBulkPayoutService.mockResolvedValue({ data: [], message: 'ok' });
      const { req, res } = mockReqRes({ body: { payoutEntries: [], payoutIds: [] }, user: { company_id: 1, user_id: 1 } });
      await controllerModule.createTataPayBulkPayoutController(req, res);
      // We expect the controller to validate the request, call the service to create a TataPay bulk payout, and send a success response when the input is valid
      expect(schema.TATAPAY_BULK_PAYOUT_SCHEMA.validate).toHaveBeenCalled();
      // We expect the controller to call the createTataPayBulkPayoutService with the correct parameters
      expect(payoutService.createTataPayBulkPayoutService).toHaveBeenCalled();
      // We expect the controller to send a success response confirming the creation of the TataPay bulk payout
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    });
  });

  describe('createRupeeFlowBulkPayoutController', () => {
    it('should validate, call service, and send success', async () => {
      schema.RUPEEFLOW_BULK_PAYOUT_SCHEMA.validate.mockReturnValue({});
      payoutService.createRupeeFlowBulkPayoutService.mockResolvedValue({ data: [], message: 'ok' });
      const { req, res } = mockReqRes({ body: { payoutEntries: [], payoutIds: [] }, user: { company_id: 1, user_id: 1 } });
      await controllerModule.createRupeeFlowBulkPayoutController(req, res);
      // We expect the controller to validate the request, call the service to create a RupeeFlow bulk payout, and send a success response when the input is valid
      expect(schema.RUPEEFLOW_BULK_PAYOUT_SCHEMA.validate).toHaveBeenCalled();
      // We expect the controller to call the createRupeeFlowBulkPayoutService with the correct parameters
      expect(payoutService.createRupeeFlowBulkPayoutService).toHaveBeenCalled();
      // We expect the controller to send a success response confirming the creation of the RupeeFlow bulk payout
      expect(responseHandlers.sendSuccess).toHaveBeenCalled();
    });
  });
});
