import {
	createPayout,
	getPayoutsBySearch,
	checkPayOutStatus,
	getPayouts,
	updatePayout,
	deletePayout,
	getPayoutsById,
	assignedPayout,
	walletsPayouts,
	getWalletsBalance,
} from './payOutController.js';

import * as payOutService from './payOutService.js';

// ✅ Mock services
jest.mock('./payOutService.js', () => ({
	createPayoutService: jest.fn(() => Promise.resolve({ id: 1, merchant_order_id: 'ORD123', amount: 100 })),
	getPayoutsBySearchService: jest.fn(() => Promise.resolve([{ id: 1 }])),
	checkPayOutStatusService: jest.fn(() => Promise.resolve({ status: 'APPROVED' })),
	getPayoutsService: jest.fn(() => Promise.resolve([{ id: 1 }])),
	updatePayoutService: jest.fn(() => Promise.resolve({ id: 1 })),
	deletePayoutService: jest.fn(() => Promise.resolve({ id: 1 })),
	assignedPayoutService: jest.fn(() => Promise.resolve({ id: 1 })),
	walletsPayoutsService: jest.fn(() => Promise.resolve(900)),
	getWalletsBalanceService: jest.fn(() => Promise.resolve({ balance: 1000 })),
}));

// ✅ Mock response handlers so we don’t hit real logic
jest.mock('../../utils/responseHandlers.js', () => ({
	sendSuccess: jest.fn((res, data, msg, status = 200) =>
		res.status(status).json({ success: true, message: msg, data })
	),
	sendNewSuccess: jest.fn((res, data, msg, status = 200) =>
		res.status(status).json({ success: true, message: msg, data })
	),
	sendError: jest.fn((res, error, status = 500) =>
		res.status(status).json({ success: false, error, status })
	),
}));

describe('payOutController', () => {
	let res;

	beforeEach(() => {
		res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
		jest.clearAllMocks();
	});

	it('createPayout should succeed', async () => {
		const req = {
		body: { user_id: '1',code: 'M123', amount: 100, bank_name: 'XYZ', ifsc_code: 'IFSC1234', acc_holder_name: 'John', acc_no: '123456' },
		headers: { 'x-forwarded-for': '127.0.0.1', 'x-api-key': 'test' },
		};
		await createPayout(req, res);
		expect(res.status).toHaveBeenCalledWith(201);
		expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
		success: true,
		message: 'Payout created successfully',
		}));
	});

	it('getPayoutsBySearch should succeed', async () => {
		const req = { query: { page: 1, limit: 10, search: 'abc' }, user: { role: 'MERCHANT', user_id: 1, designation: 'MERCHANT', company_id: 1 } };
		await getPayoutsBySearch(req, res);
		expect(res.status).toHaveBeenCalledWith(200);
		expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
	});

	it('checkPayOutStatus should succeed', async () => {
		const req = { body: { payoutId: '550e8400-e29b-41d4-a716-446655440000', merchantCode: 'M123', merchantOrderId: 'ORD123' }, headers: { 'x-api-key': 'key' } };
		await checkPayOutStatus(req, res);
		expect(res.status).toHaveBeenCalledWith(200);
		expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
	});

	it('getPayouts should succeed', async () => {
		const req = { query: { page: 1, limit: 10 }, user: { role: 'MERCHANT', user_id: 1, designation: 'MERCHANT', company_id: 1 } };
		await getPayouts(req, res);
		expect(res.status).toHaveBeenCalledWith(200);
	});

	it('updatePayout should succeed', async () => {
		const req = { params: { id: 1 }, body: { utr_id: 'UTR123' }, user: { company_id: 1, role: 'ADMIN', user_id: 1, user_name: 'Tester' } };
		await updatePayout(req, res);
		expect(res.status).toHaveBeenCalledWith(200);
	});

	it('deletePayout should succeed', async () => {
		const req = { params: { id: '550e8400-e29b-41d4-a716-446655440000' }, user: { company_id: 1, user_id: "1", role: 'ADMIN' } };
		await deletePayout(req, res);
		expect(res.status).toHaveBeenCalledWith(200);
	});

	it('should succeed and return payout data', async () => {
		const req = { 
			params: { id: '123e4567-e89b-12d3-a456-426614174000',id: '550e8400-e29b-41d4-a716-446655440000'  }, // valid v4 UUID
			user: { company_id: 1, role: 'ADMIN' } 
		};

		await getPayoutsById(req, res);

		// Check status and JSON response
		expect(res.status).toHaveBeenCalledWith(200);
		expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
			success: true,
			message: 'Payouts fetched successfully',
			data: expect.any(Array)
		}));

		// Ensure the service was called with correct parameters
		expect(payOutService.getPayoutsService).toHaveBeenCalledWith(
			{ id: '123e4567-e89b-12d3-a456-426614174000',id: '550e8400-e29b-41d4-a716-446655440000' , company_id: 1 },
			'ADMIN'
		);
	});
	it('should handle service errors', async () => {
		payOutService.getPayoutsService.mockRejectedValueOnce(new Error('Service error'));

		const req = { 
			params: { id: '123e4567-e89b-12d3-a456-426614174000',id: '550e8400-e29b-41d4-a716-446655440000' },
			user: { company_id: 1, role: 'ADMIN' } 
		};

		// Wrap in try/catch since controller throws ValidationError or lets error bubble
		await getPayoutsById(req, res).catch(err => {
			expect(err.message).toBe('Service error');
		});
	});

	it('assignedPayout should succeed', async () => {
		const req = { params: { id: '550e8400-e29b-41d4-a716-446655440000' }, body: { payouts_ids: ['550e8400-e29b-41d4-a716-446655440000'] }, user: { user_id: 1, user_name: 'Tester', company_id: 1 } };
		await assignedPayout(req, res);
		expect(res.status).toHaveBeenCalledWith(200);
	});

	it('should succeed and return updated wallet balance', async () => {
		const req = {
			body: {
				payOutids: ['550e8400-e29b-41d4-a716-446655440000'],
				amount: 100,
				mode: 'DEBIT', // this will map to `mode` in controller
			},
			user: { company_id: 1, user_id: 1 },
		};

		await walletsPayouts(req, res);

		// Response check
		expect(res.status).toHaveBeenCalledWith(201);
		expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
			success: true,
			message: 'Payout updated successfully',
			data: { balance: 900 }
		}));

		// Service call check
		expect(payOutService.walletsPayoutsService).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				payOutids: req.body.payOutids,
				amount: req.body.amount,
				mode: req.body.mode,
				company_id: 1
			}),
		1, // user_id
		res
		);
	});

	it('getWalletsBalance should succeed', async () => {
		const req = { user: { company_id: 1 } };
		await getWalletsBalance(req, res);
		expect(res.status).toHaveBeenCalledWith(200);
	});
});
