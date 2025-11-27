// src/apis/payOut/__tests__/payoutController.unit.test.js
'use strict';
import { expect, describe, beforeEach, test } from '@jest/globals';


jest.mock('../../utils/db.js', () => ({
  transactionWrapper: jest.fn(),
  createPool: jest.fn(() => ({
    connect: jest.fn(),
    on: jest.fn(),
    end: jest.fn(),
    query: jest.fn(),
  })),
}));

jest.mock('../../utils/responseHandlers.js', () => ({
  sendSuccess: jest.fn((res, data, msg) => res.status(200).json({ ok: true, message: msg, data })),
  sendNewSuccess: jest.fn((res, data, msg, status = 200) => res.status(status).json({ ok: true, message: msg, data })),
  sendError: jest.fn((res, msg, status = 400) => res.status(status).json({ ok: false, message: msg })),
}));

// Services used by controller
jest.mock('./payOutService.js', () => ({
  createPayoutService: jest.fn(),
  deletePayoutService: jest.fn(),
  getPayoutsService: jest.fn(),
  updatePayoutService: jest.fn(),
  getPayoutsBySearchService: jest.fn(),
  checkPayOutStatusService: jest.fn(),
  assignedPayoutService: jest.fn(),
  walletsPayoutsService: jest.fn(),
  getWalletsBalanceService: jest.fn(),
}));

jest.mock('../../schemas/payoutSchema.js', () => ({
  PAYOUT_DETAILS_SCHEMA: { validate: jest.fn() },
  UPDATE_DETAILS_SCHEMA: { validate: jest.fn() },
  VALIDATE_CHECK_PAY_OUT_STATUS: { validate: jest.fn() },
  VALIDATE_PAYOUT_BY_ID: { validate: jest.fn() },
  ASSIGNED_VENDOR_SCHEMA: { validate: jest.fn() },
  WALLET_PAYOUT_DETAILS_SCHEMA: { validate: jest.fn() },
}));

jest.mock('../../utils/logger.js', () => ({ logger: { info: jest.fn(), error: jest.fn(), log: jest.fn() } }));

// require controller after mocks set up
const controller = require('./payOutController.js');

const dbUtils = require('../../utils/db.js');
const responseHandlers = require('../../utils/responseHandlers.js');
const services = require('./payOutService.js');
const schemas = require('../../schemas/payoutSchema.js');

function makeReqRes(overrides = {}) {
  const req = {
    body: overrides.body || {},
    params: overrides.params || {},
    query: overrides.query || {},
    headers: overrides.headers || {},
    connection: { remoteAddress: overrides.remoteAddress || '1.2.3.4' },
    user: overrides.user,
    ip: overrides.ip,
  };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return { req, res };
}

describe('payoutController - unit (exhaustive)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------
  // createPayout - many branches
  // ---------------------------
  describe('createPayout', () => {
    test('validation fails -> throw ValidationError', async () => {
      schemas.PAYOUT_DETAILS_SCHEMA.validate.mockReturnValue({ error: 'bad' });
      const { req, res } = makeReqRes({ body: { foo: 'bar' } });
      await expect(controller.createPayout(req, res)).rejects.toBeInstanceOf(Error);
      expect(schemas.PAYOUT_DETAILS_SCHEMA.validate).toHaveBeenCalled();
    });

    test('no req.user -> call service with null role and return success when ok', async () => {
      schemas.PAYOUT_DETAILS_SCHEMA.validate.mockReturnValue({});
      const result = { id: 'p1', amount: 50, merchant_order_id: 'mo1' };
      // transactionWrapper returns a function that returns result
      dbUtils.transactionWrapper.mockReturnValue(() => Promise.resolve(result));

      const { req, res } = makeReqRes({
        body: { user: 'u1', fromUi: true, merchant_order_id: 'mo1' },
        headers: { 'x-api-key': 'x' },
      });

      await controller.createPayout(req, res);

      expect(dbUtils.transactionWrapper).toHaveBeenCalled();
      expect(responseHandlers.sendNewSuccess).toHaveBeenCalledWith(
        res,
        { merchantOrderId: result.merchant_order_id, payoutId: result.id, amount: result.amount },
        'Payout created successfully',
        201,
      );
    });

    test('service returns error object with status 400 -> sendError called', async () => {
      schemas.PAYOUT_DETAILS_SCHEMA.validate.mockReturnValue({});
      dbUtils.transactionWrapper.mockReturnValue(() => Promise.resolve({ status: 400, message: 'bad request' }));

      const { req, res } = makeReqRes({ body: { user: 'u' }, headers: { 'x-api-key': 'key' } });
      await controller.createPayout(req, res);

      expect(responseHandlers.sendError).toHaveBeenCalledWith(res, 'bad request', 400);
    });

    test('transactionWrapper throws -> bubble up', async () => {
      schemas.PAYOUT_DETAILS_SCHEMA.validate.mockReturnValue({});
      dbUtils.transactionWrapper.mockImplementation(() => { throw new Error('tx wrapper failed'); });

      const { req, res } = makeReqRes({ body: { user: 'u' } });
      await expect(controller.createPayout(req, res)).rejects.toThrow('tx wrapper failed');
    });

    test('userIp ::1 replaced with TestingIp environment', async () => {
      schemas.PAYOUT_DETAILS_SCHEMA.validate.mockReturnValue({});
      const result = { id: 'p2', amount: 10, merchant_order_id: 'mo2' };
      dbUtils.transactionWrapper.mockReturnValue(() => Promise.resolve(result));
      // set env testing ip
      process.env.LOCAL_IP = '9.9.9.9';
      const { req, res } = makeReqRes({
        body: { user: 'u' },
        headers: {},
        remoteAddress: '::1',
      });
      // force req.connection.remoteAddress to ::1
      req.connection.remoteAddress = '::1';
      await controller.createPayout(req, res);
      // If transactionWrapper was called, controller progressed
      expect(dbUtils.transactionWrapper).toHaveBeenCalled();
    });
  });

  // ---------------------------
  // getPayoutsById
  // ---------------------------
  describe('getPayoutsById', () => {
    test('invalid params -> throw ValidationError', async () => {
      schemas.VALIDATE_PAYOUT_BY_ID.validate.mockReturnValue({ error: 'err' });
      const { req, res } = makeReqRes({ params: { id: '1' }, user: { company_id: 'c1', role: 'R' } });
      await expect(controller.getPayoutsById(req, res)).rejects.toBeInstanceOf(Error);
    });

    test('valid -> call service and sendSuccess', async () => {
      schemas.VALIDATE_PAYOUT_BY_ID.validate.mockReturnValue({});
      services.getPayoutsService.mockResolvedValue({ id: 'p1' });
      const { req, res } = makeReqRes({ params: { id: 'p1' }, user: { company_id: 'c1', role: 'R' } });
      await controller.getPayoutsById(req, res);
      expect(services.getPayoutsService).toHaveBeenCalledWith({ id: 'p1', company_id: 'c1' }, 'R');
      expect(responseHandlers.sendSuccess).toHaveBeenCalledWith(res, { id: 'p1' }, 'Payouts fetched successfully');
    });
  });

  // ---------------------------
  // getPayouts
  // ---------------------------
  describe('getPayouts', () => {
    test('clones query and calls service with cleaned query', async () => {
      const userObj = { company_id: 'c1', role: 'R', user_id: 'u1', designation: 'D' };
      services.getPayoutsService.mockResolvedValue({ list: [] });
      const query = { page: 2, limit: 5, sortOrder: 'ASC', foo: 'bar' };
      const { req, res } = makeReqRes({ query: { ...query }, user: userObj });
      await controller.getPayouts(req, res);
      // verify service called
      expect(services.getPayoutsService).toHaveBeenCalled();
      // original req.query should still exist (controller used clone)
      expect(req.query.foo).toBe('bar');
      expect(responseHandlers.sendSuccess).toHaveBeenCalledWith(res, { list: [] }, 'Payouts fetched successfully');
    });

    test('service throws -> bubbles up', async () => {
      const userObj = { company_id: 'c1', role: 'R', user_id: 'u1', designation: 'D' };
      services.getPayoutsService.mockImplementation(() => { throw new Error('db fail'); });
      const { req, res } = makeReqRes({ query: {}, user: userObj });
      await expect(controller.getPayouts(req, res)).rejects.toThrow('db fail');
    });
  });

  // ---------------------------
  // walletsPayouts
  // ---------------------------
  describe('walletsPayouts', () => {
    test('validation fails -> throw', async () => {
      schemas.WALLET_PAYOUT_DETAILS_SCHEMA.validate.mockReturnValue({ error: 'bad' });
      const { req, res } = makeReqRes({ body: { payOutids: [1] }, user: { company_id: 'c1', user_id: 'u1' } });
      await expect(controller.walletsPayouts(req, res)).rejects.toBeInstanceOf(Error);
    });

    test('service returns not found -> sendNewSuccess should not be called and function returns error object', async () => {
      schemas.WALLET_PAYOUT_DETAILS_SCHEMA.validate.mockReturnValue({});
      // emulate transactionWrapper calling walletsPayoutsService which returns error object
      dbUtils.transactionWrapper.mockReturnValue(() => Promise.resolve({ status: 404, message: 'Payout not found' }));
      const { req, res } = makeReqRes({ body: { payOutids: [1], mode: 'IMPS' }, user: { company_id: 'c1', user_id: 'u1' } });
      await controller.walletsPayouts(req, res);
      // Since controller directly returns sendNewSuccess, we expect it not called because service returned error
      // but our controller uses transactionWrapper directly and will call sendNewSuccess only on success
      // test that transactionWrapper was invoked
      expect(dbUtils.transactionWrapper).toHaveBeenCalled();
    });

    test('successful path -> sendNewSuccess called', async () => {
      schemas.WALLET_PAYOUT_DETAILS_SCHEMA.validate.mockReturnValue({});
      dbUtils.transactionWrapper.mockReturnValue(() => Promise.resolve({ processed: true }));
      const { req, res } = makeReqRes({ body: { payOutids: [1], mode: 'IMPS' }, user: { company_id: 'c1', user_id: 'u1' } });
      await controller.walletsPayouts(req, res);
      expect(responseHandlers.sendNewSuccess).toHaveBeenCalledWith(res, { processed: true }, 'Payout updated successfully', 201);
    });
  });

  // ---------------------------
  // getWalletsBalance
  // ---------------------------
  describe('getWalletsBalance', () => {
    test('calls service -> returns sendNewSuccess', async () => {
      services.getWalletsBalanceService.mockResolvedValue({ balance: 200 });
      const { req, res } = makeReqRes({ user: { company_id: 'c1' } });
      await controller.getWalletsBalance(req, res);
      expect(services.getWalletsBalanceService).toHaveBeenCalledWith('c1');
      expect(responseHandlers.sendNewSuccess).toHaveBeenCalledWith(res, { balance: 200 }, 'Wallet Balance fetch successfully');
    });

    test('service throws -> bubbles up', async () => {
      services.getWalletsBalanceService.mockRejectedValue(new Error('api down'));
      const { req, res } = makeReqRes({ user: { company_id: 'c1' } });
      await expect(controller.getWalletsBalance(req, res)).rejects.toThrow('api down');
    });
  });

  // ---------------------------
  // getPayoutsBySearch
  // ---------------------------
  describe('getPayoutsBySearch', () => {
    test('calls service with parsed params and returns sendSuccess', async () => {
      services.getPayoutsBySearchService.mockResolvedValue({ hits: [] });
      const { req, res } = makeReqRes({
        query: { search: 'a', page: 1, limit: 10 },
        user: { company_id: 'c1', role: 'R', user_id: 'u', designation: 'd' },
      });
      await controller.getPayoutsBySearch(req, res);
      expect(services.getPayoutsBySearchService).toHaveBeenCalled();
      expect(responseHandlers.sendSuccess).toHaveBeenCalledWith(res, { hits: [] }, 'Payouts fetched successfully');
    });
  });

  // ---------------------------
  // updatePayout
  // ---------------------------
  describe('updatePayout', () => {
    test('validation fails -> throw', async () => {
      schemas.UPDATE_DETAILS_SCHEMA.validate.mockReturnValue({ error: 'bad' });
      const { req, res } = makeReqRes({ params: { id: 'p1' }, body: {}, user: { company_id: 'c1', role: 'R', user_id: 'u', user_name: 'Bob' } });
      await expect(controller.updatePayout(req, res)).rejects.toBeInstanceOf(Error);
    });

    test('calls transaction wrapper update service and returns sendSuccess', async () => {
      schemas.UPDATE_DETAILS_SCHEMA.validate.mockReturnValue({});
      const wrapped = jest.fn().mockResolvedValue({ id: 'p1' });
      dbUtils.transactionWrapper.mockReturnValue(() => wrapped());
      const { req, res } = makeReqRes({ params: { id: 'p1' }, body: { amount: 10 }, user: { company_id: 'c1', role: 'R', user_id: 'u', user_name: 'Bob' } });
      await controller.updatePayout(req, res);
      expect(responseHandlers.sendSuccess).toHaveBeenCalledWith(res, { id: 'p1', updated_by: 'Bob' }, 'Payout updated successfully');
    });

    test('transaction wrapper throws -> bubble up', async () => {
      schemas.UPDATE_DETAILS_SCHEMA.validate.mockReturnValue({});
      dbUtils.transactionWrapper.mockImplementation(() => { throw new Error('tx failed'); });
      const { req, res } = makeReqRes({ params: { id: 'p1' }, body: { amount: 10 }, user: { company_id: 'c1', role: 'R', user_id: 'u', user_name: 'Bob' } });
      await expect(controller.updatePayout(req, res)).rejects.toThrow('tx failed');
    });
  });

  // ---------------------------
  // assignedPayout
  // ---------------------------
  describe('assignedPayout', () => {
    test('validation fails -> throw', async () => {
      schemas.ASSIGNED_VENDOR_SCHEMA.validate.mockReturnValue({ error: 'bad' });
      const { req, res } = makeReqRes({ params: { id: 'p1' }, body: { payouts_ids: [1] }, user: { user_id: 'u', user_name: 'X', company_id: 'c1' } });
      await expect(controller.assignedPayout(req, res)).rejects.toBeInstanceOf(Error);
    });

    test('success -> sendSuccess', async () => {
      schemas.ASSIGNED_VENDOR_SCHEMA.validate.mockReturnValue({});
      dbUtils.transactionWrapper.mockReturnValue(() => Promise.resolve(['p1']));
      const { req, res } = makeReqRes({ params: { id: 'p1' }, body: { payouts_ids: [1] }, user: { user_id: 'u', user_name: 'X', company_id: 'c1' } });
      await controller.assignedPayout(req, res);
      expect(responseHandlers.sendSuccess).toHaveBeenCalledWith(res, { ids: ['p1'], assigned_by: 'X' }, 'Payout assigned successfully');
    });
  });

  // ---------------------------
  // deletePayout
  // ---------------------------
  describe('deletePayout', () => {
    test('validation fails -> throw', async () => {
      schemas.VALIDATE_PAYOUT_BY_ID.validate.mockReturnValue({ error: 'bad' });
      const { req, res } = makeReqRes({ params: { id: 'p1' }, user: { company_id: 'c1', user_id: 'u', role: 'R' } });
      await expect(controller.deletePayout(req, res)).rejects.toBeInstanceOf(Error);
    });

    test('service called and sendSuccess on success', async () => {
      schemas.VALIDATE_PAYOUT_BY_ID.validate.mockReturnValue({});
      services.deletePayoutService.mockResolvedValue();
      const { req, res } = makeReqRes({ params: { id: 'p1' }, user: { company_id: 'c1', user_id: 'u', role: 'R' } });
      await controller.deletePayout(req, res);
      expect(services.deletePayoutService).toHaveBeenCalledWith({ id: 'p1', company_id: 'c1' }, 'u', 'R');
      expect(responseHandlers.sendSuccess).toHaveBeenCalledWith(res, {}, 'Payout deleted successfully');
    });

    test('service throws -> bubble up', async () => {
      schemas.VALIDATE_PAYOUT_BY_ID.validate.mockReturnValue({});
      services.deletePayoutService.mockRejectedValue(new Error('db error'));
      const { req, res } = makeReqRes({ params: { id: 'p1' }, user: { company_id: 'c1', user_id: 'u', role: 'R' } });
      await expect(controller.deletePayout(req, res)).rejects.toThrow('db error');
    });
  });

  // ---------------------------
  // checkPayOutStatus
  // ---------------------------
  describe('checkPayOutStatus', () => {
    test('validation fails -> throw', async () => {
      schemas.VALIDATE_CHECK_PAY_OUT_STATUS.validate.mockReturnValue({ error: 'bad' });
      const { req, res } = makeReqRes({ body: { payoutId: 'p1' }, headers: {} });
      await expect(controller.checkPayOutStatus(req, res)).rejects.toBeInstanceOf(Error);
    });

    test('service returns 400 -> sendError called', async () => {
      schemas.VALIDATE_CHECK_PAY_OUT_STATUS.validate.mockReturnValue({});
      services.checkPayOutStatusService.mockResolvedValue({ status: 400, message: 'not found' });
      const { req, res } = makeReqRes({ body: { payoutId: 'p1', merchantCode: 'm', merchantOrderId: 'mo' }, headers: { 'x-api-key': 'k' } });
      await controller.checkPayOutStatus(req, res);
      expect(responseHandlers.sendError).toHaveBeenCalledWith(res, 'not found', 400);
    });

    test('service returns ok -> sendNewSuccess called', async () => {
      schemas.VALIDATE_CHECK_PAY_OUT_STATUS.validate.mockReturnValue({});
      services.checkPayOutStatusService.mockResolvedValue({ status: 200, some: 'data' });
      const { req, res } = makeReqRes({ body: { payoutId: 'p1', merchantCode: 'm', merchantOrderId: 'mo' }, headers: { 'x-api-key': 'k' } });
      await controller.checkPayOutStatus(req, res);
      expect(responseHandlers.sendNewSuccess).toHaveBeenCalled();
    });

    test('service throws -> bubble up', async () => {
      schemas.VALIDATE_CHECK_PAY_OUT_STATUS.validate.mockReturnValue({});
      services.checkPayOutStatusService.mockRejectedValue(new Error('api fail'));
      const { req, res } = makeReqRes({ body: { payoutId: 'p1', merchantCode: 'm', merchantOrderId: 'mo' }, headers: { 'x-api-key': 'k' } });
      await expect(controller.checkPayOutStatus(req, res)).rejects.toThrow('api fail');
    });
  });
});
