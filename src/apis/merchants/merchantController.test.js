/**
 * merchantController.test.js
 *
 * Place this file in the SAME directory as merchantController.js so the relative paths
 * used in jest.mock(...) match the controller's imports.
 */

//////////////////////////////////////////////
//  Mocks (must appear before importing the controller)
//////////////////////////////////////////////
jest.mock('../../utils/responseHandlers.js', () => ({
  sendSuccess: jest.fn(),
}));

jest.mock('./merchantService.js', () => ({
  createMerchantService: jest.fn(async (payload, role) => ({ id: 'created-1', user_id: 'user-1', ...payload })),
  getMerchantsService: jest.fn(async () => ({ rows: [], total: 0 })),
  getMerchantsBySearchService: jest.fn(async () => ({ rows: [], total: 0 })),
  getMerchantByIdService: jest.fn(async () => ({ id: 'm-1', user_id: 'u-1' })),
  updateMerchantService: jest.fn(async () => ({ id: 'm-1' })),
  deleteMerchantService: jest.fn(async () => ({ id: 'm-1' })),
  getMerchantsServiceCode: jest.fn(async () => (['M001'])),
  getMerchantsByCodeService: jest.fn(async (code) => ({ id: 'm-1', code })),
}));

jest.mock('../../schemas/merchantSchema.js', () => ({
  VALIDATE_MERCHANT_SCHEMA: {
    validate: jest.fn((payload) => ({ error: null, value: payload })),
  },
  VALIDATE_UPDATE_MERCHANT_STATUS: {
    validate: jest.fn((payload) => ({ error: null, value: payload })),
  },
}));

jest.mock('../../utils/appErrors.js', () => {
  class BadRequestError extends Error {}
  class ValidationError extends Error {}
  class NotFoundError extends Error {}
  class InternalServerError extends Error {}
  return { BadRequestError, ValidationError, NotFoundError, InternalServerError };
});

jest.mock('../../utils/db.js', () => ({
  // transactionWrapper should return a function that calls the underlying service with the provided args.
  transactionWrapper: jest.fn((fn) => {
    const wrapper = jest.fn((...args) => fn(...args));
    return wrapper;
  }),
  beginTransaction: jest.fn(),
  commit: jest.fn(),
  rollback: jest.fn(),
  getConnection: jest.fn(),
}));

jest.mock('../../utils/cryptoAlgorithm.js', () => ({
  createHashApiKey: jest.fn(() => ({ secretKey: 'secret-test-key', publicKey: 'public-test-key' })),
}));

jest.mock('../../utils/logger.js', () => ({
  logger: { log: jest.fn(), error: jest.fn() },
}));

//////////////////////////////////////////////
//  Now import the controller under test
//////////////////////////////////////////////
import {
  createMerchant,
  getMerchants,
  getMerchantByCode,
  getMerchantsBySearch,
  getMerchantCodes,
  getMerchantsById,
  updateMerchant,
  deleteMerchant,
} from './merchantController.js';

// import mocks so we can assert calls
import { sendSuccess } from '../../utils/responseHandlers.js';
import * as svc from './merchantService.js';
import { VALIDATE_MERCHANT_SCHEMA, VALIDATE_UPDATE_MERCHANT_STATUS } from '../../schemas/merchantSchema.js';
import { transactionWrapper } from '../../utils/db.js';
import { createHashApiKey } from '../../utils/cryptoAlgorithm.js';
import { BadRequestError, ValidationError } from '../../utils/appErrors.js';

//////////////////////////////////////////////
//  Helper to build request/response objects
//////////////////////////////////////////////
const buildReqRes = (overrides = {}) => {
  const defaultReq = {
    body: {},
    query: {},
    params: {},
    user: {
      company_id: 'company-1',
      user_id: 'user-1',
      role: 'ADMIN',
      designation: null,
      user_name: 'alex',
    },
  };
  const req = { ...defaultReq, ...(overrides.req || {}) };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return { req, res };
};

beforeEach(() => {
  jest.clearAllMocks();
});

//////////////////////////////////////////////
//  Tests
//////////////////////////////////////////////
describe('merchantController', () => {
  describe('createMerchant', () => {
    it('happy path: builds final payload (urls & keys), validates, wraps service and sends success', async () => {
		const { req, res } = buildReqRes({
			req: {
			body: {
				name: 'Acme Inc',
				payin_notify: 'https://a.example/payin',
				payout_notify: 'https://a.example/payout',
				return_url: 'https://a.example/return',
				site: 'https://a.example',
				config: { foo: 'bar' },
			},
			user: { company_id: 'co-1', user_id: 'u-1', role: 'ADMIN' },
			},
		});

		// Ensure createMerchantService returns created merchant
		svc.createMerchantService.mockResolvedValueOnce({ id: 'mid', user_id: 'uid' });

		await createMerchant(req, res);

		// ensure keys were generated and used
		expect(createHashApiKey).toHaveBeenCalled();

		// validation should be run with the cleaned payload (without payin_notify etc)
		expect(VALIDATE_MERCHANT_SCHEMA.validate).toHaveBeenCalled();
		const validatedArg = VALIDATE_MERCHANT_SCHEMA.validate.mock.calls[0][0];
		// The validated arg should include config with keys and urls
		expect(validatedArg).toHaveProperty('config');
		expect(validatedArg.config).toHaveProperty('keys');
		expect(validatedArg.config.keys).toMatchObject({
			private: 'secret-test-key',
			public: 'public-test-key',
		});
		expect(validatedArg.config).toHaveProperty('urls');
		expect(validatedArg.config.urls).toMatchObject({
			payin_notify: 'https://a.example/payin',
			payout_notify: 'https://a.example/payout',
			return: 'https://a.example/return',
			site: 'https://a.example',
		});

		// transactionWrapper must be used
		expect(transactionWrapper).toHaveBeenCalledWith(svc.createMerchantService);

		// final payload passed to service should include company_id and created_by/updated_by
		expect(svc.createMerchantService).toHaveBeenCalled();
		const serviceCallPayload = svc.createMerchantService.mock.calls[0][0];
		expect(serviceCallPayload).toMatchObject({
			company_id: 'co-1',
			created_by: 'u-1',
			updated_by: 'u-1',
		});
		expect(serviceCallPayload.config.keys.private).toBe('secret-test-key');

		// sendSuccess called with expected message
		expect(sendSuccess).toHaveBeenCalledWith(res, null, 'Merchant created successfully');
    });

    it('throws ValidationError when validation fails', async () => {
      VALIDATE_MERCHANT_SCHEMA.validate.mockReturnValueOnce({ error: 'bad payload' });

      const { req, res } = buildReqRes({
        req: { body: { name: 'bad' }, user: { company_id: 'co-1', user_id: 'u-1', role: 'ADMIN' } },
      });

      await expect(createMerchant(req, res)).rejects.toThrow(ValidationError);
      expect(sendSuccess).not.toHaveBeenCalled();
    });

    it('propagates service errors', async () => {
      svc.createMerchantService.mockImplementationOnce(() => { throw new Error('service failure'); });

      const { req, res } = buildReqRes({
        req: { body: { name: 'Acme', config: {} }, user: { company_id: 'co', user_id: 'u1', role: 'ADMIN' } },
      });

      await expect(createMerchant(req, res)).rejects.toThrow('service failure');
    });
  });

  describe('getMerchants', () => {
    it('calls getMerchantsService with company_id and query params and sends success', async () => {
      const { req, res } = buildReqRes({
        req: {
          query: { page: '2', limit: '50', foo: 'bar' },
          user: { company_id: 'co-99', role: 'ADMIN', designation: 'X', user_id: 'u-9' },
        },
      });

      svc.getMerchantsService.mockResolvedValueOnce({ rows: [{ id: 'x' }], total: 1 });

      await getMerchants(req, res);

      expect(svc.getMerchantsService).toHaveBeenCalledWith(
        { company_id: 'co-99', ...req.query },
        'ADMIN',
        '2',
        '50',
        'X',
        'u-9',
      );
      expect(sendSuccess).toHaveBeenCalledWith(res, { rows: [{ id: 'x' }], total: 1 }, 'Merchants fetched successfully');
    });

    it('propagates underlying service errors', async () => {
      svc.getMerchantsService.mockRejectedValueOnce(new Error('list fail'));
      const { req, res } = buildReqRes({ req: { query: {}, user: { company_id: 'co', role: 'ADMIN', user_id: 'u1' } } });
      await expect(getMerchants(req, res)).rejects.toThrow('list fail');
    });
  });

  describe('getMerchantByCode', () => {
    it('calls getMerchantsByCodeService and sends success', async () => {
      const { req, res } = buildReqRes({ req: { query: { code: 'CODE123' } } });
      svc.getMerchantsByCodeService.mockResolvedValueOnce({ id: 'm-c' });

      await getMerchantByCode(req, res);

      expect(svc.getMerchantsByCodeService).toHaveBeenCalledWith('CODE123');
      expect(sendSuccess).toHaveBeenCalledWith(res, { id: 'm-c' }, 'Merchants fetched successfully');
    });

    it('propagates service errors (e.g., not found)', async () => {
      svc.getMerchantsByCodeService.mockRejectedValueOnce(new Error('not found'));
      const { req, res } = buildReqRes({ req: { query: { code: 'X' } } });
      await expect(getMerchantByCode(req, res)).rejects.toThrow('not found');
    });
  });

  describe('getMerchantsBySearch', () => {
    it('uses defaults for page and limit and calls getMerchantsBySearchService', async () => {
      const { req, res } = buildReqRes({
        req: {
          query: { search: 'query-term' },
          user: { company_id: 'co-11', role: 'ADMIN', designation: null, user_id: 'u-11' },
        },
      });

      svc.getMerchantsBySearchService.mockResolvedValueOnce({ rows: [], total: 0 });

      await getMerchantsBySearch(req, res);

      // controller builds filters including company_id, search, default page & limit
      expect(svc.getMerchantsBySearchService).toHaveBeenCalled();
      const filtersPassed = svc.getMerchantsBySearchService.mock.calls[0][0];
      expect(filtersPassed.company_id).toBe('co-11');
      expect(filtersPassed.search).toBe('query-term');
      expect(filtersPassed.page).toBe(1);
      expect(filtersPassed.limit).toBe(10);

      expect(sendSuccess).toHaveBeenCalledWith(res, { rows: [], total: 0 }, 'Merchants fetched successfully');
    });

    it('propagates service errors', async () => {
      svc.getMerchantsBySearchService.mockRejectedValueOnce(new Error('search fail'));
      const { req, res } = buildReqRes({ req: { query: { search: 'x' }, user: { company_id: 'co', role: 'ADMIN' } } });
      await expect(getMerchantsBySearch(req, res)).rejects.toThrow('search fail');
    });
  });

  describe('getMerchantCodes', () => {
    it('builds filters and calls getMerchantsServiceCode with query flags', async () => {
      const { req, res } = buildReqRes({
        req: {
          user: { company_id: 'co-55', role: 'ADMIN', user_id: 'u-2', designation: 'DES' },
          query: { includeSubMerchants: 'true', includeOnlyMerchants: 'false', excludeDisabledMerchant: 'true' },
        },
      });

      svc.getMerchantsServiceCode.mockResolvedValueOnce(['C1', 'C2']);

      await getMerchantCodes(req, res);

      expect(svc.getMerchantsServiceCode).toHaveBeenCalledWith(
        { company_id: 'co-55' },
        'ADMIN',
        'DES',
        'u-2',
        'true',
        'false',
        'true',
      );
      expect(sendSuccess).toHaveBeenCalledWith(res, ['C1', 'C2'], 'Merchants fetched successfully');
    });

    it('propagates errors from service', async () => {
      svc.getMerchantsServiceCode.mockRejectedValueOnce(new Error('code fail'));
      const { req, res } = buildReqRes({ req: { user: { company_id: 'c', role: 'ADMIN', user_id: 'u1' }, query: {} } });
      await expect(getMerchantCodes(req, res)).rejects.toThrow('code fail');
    });
  });

  describe('getMerchantsById', () => {
    it('throws BadRequestError when params missing', async () => {
      const { req, res } = buildReqRes({ req: { params: null, user: { role: 'ADMIN' } } });
      await expect(getMerchantsById(req, res)).rejects.toThrow(BadRequestError);
    });

    it('calls getMerchantByIdService and returns merchant', async () => {
      const { req, res } = buildReqRes({
        req: {
          params: { id: 'm-abc' },
          user: { company_id: 'co-x', role: 'ADMIN' },
        },
      });
      svc.getMerchantByIdService.mockResolvedValueOnce({ id: 'm-abc', name: 'Test' });
      await getMerchantsById(req, res);
      expect(svc.getMerchantByIdService).toHaveBeenCalledWith({ id: 'm-abc', company_id: 'co-x' }, 'ADMIN', true);
      expect(sendSuccess).toHaveBeenCalledWith(res, { id: 'm-abc', name: 'Test' }, 'Merchant fetched successfully');
    });
  });

  describe('updateMerchant', () => {
    it('throws BadRequestError when params missing', async () => {
      const { req, res } = buildReqRes({ req: { params: null } });
      await expect(updateMerchant(req, res)).rejects.toThrow(BadRequestError);
    });

    it('throws ValidationError for invalid update payload', async () => {
      VALIDATE_UPDATE_MERCHANT_STATUS.validate.mockReturnValueOnce({ error: 'invalid' });
      const { req, res } = buildReqRes({ req: { params: { id: 'm1' }, body: {}, user: { user_id: 'u1' } } });
      await expect(updateMerchant(req, res)).rejects.toThrow(ValidationError);
    });

    it('calls updateMerchantService via transactionWrapper and returns updated_by user_name', async () => {
      const { req, res } = buildReqRes({
        req: {
          params: { id: 'm-1' },
          body: { status: 'ACTIVE' },
          user: { company_id: 'co-100', user_id: 'u-100', role: 'ADMIN', user_name: 'operator-1' },
        },
      });

      // ensure the mock update service returns an object
      svc.updateMerchantService.mockResolvedValueOnce({ id: 'm-1' });

      await updateMerchant(req, res);

      // validate function called with body
      expect(VALIDATE_UPDATE_MERCHANT_STATUS.validate).toHaveBeenCalledWith({ status: 'ACTIVE', updated_by: 'u-100' });

      // transactionWrapper should be used for update
      expect(transactionWrapper).toHaveBeenCalledWith(svc.updateMerchantService);

      // updateMerchantService should have been called with ids, payload and role
      expect(svc.updateMerchantService).toHaveBeenCalled();
      const [idsArg, payloadArg, roleArg] = svc.updateMerchantService.mock.calls[0];
      expect(idsArg).toMatchObject({ id: 'm-1', company_id: 'co-100' });
      expect(payloadArg).toHaveProperty('updated_by', 'u-100');
      expect(roleArg).toBe('ADMIN');

      expect(sendSuccess).toHaveBeenCalledWith(
        res,
        { id: 'm-1', updated_by: 'operator-1' },
        'Merchant updated successfully',
      );
    });
  });

  describe('deleteMerchant', () => {
    it('throws BadRequestError when params missing', async () => {
      const { req, res } = buildReqRes({ req: { params: null } });
      await expect(deleteMerchant(req, res)).rejects.toThrow(BadRequestError);
    });

    it('calls deleteMerchantService and sends success', async () => {
      const { req, res } = buildReqRes({
        req: {
          params: { id: 'to-delete' },
          user: { role: 'ADMIN', company_id: 'co-55', user_id: 'deleter', user_name: 'deleter-name' },
        },
      });

      svc.deleteMerchantService.mockResolvedValueOnce({ id: 'to-delete' });

      await deleteMerchant(req, res);

      expect(svc.deleteMerchantService).toHaveBeenCalledWith({ id: 'to-delete', company_id: 'co-55' }, 'deleter', 'ADMIN');
      expect(sendSuccess).toHaveBeenCalledWith(
        res,
        { id: 'to-delete', deleted_by: 'deleter-name' },
        'Merchant deleted successfully',
      );
    });

    it('propagates errors from delete service', async () => {
      svc.deleteMerchantService.mockRejectedValueOnce(new Error('delete failure'));
      const { req, res } = buildReqRes({
        req: { params: { id: 'x' }, user: { role: 'ADMIN', company_id: 'co', user_id: 'u1', user_name: 'u1' } },
      });
      await expect(deleteMerchant(req, res)).rejects.toThrow('delete failure');
    });
  });
});
