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
} from "./payOutController.js";

import { expect, describe, beforeEach, it } from '@jest/globals';

import * as payOutService from "./payOutService.js";
import { sendSuccess, sendNewSuccess, sendError } from "../../utils/responseHandlers.js";
import { transactionWrapper } from "../../utils/db.js";
import { ValidationError } from "../../utils/appErrors.js";

jest.mock("./payOutService.js", () => ({
	createPayoutService: jest.fn(),
	getPayoutsBySearchService: jest.fn(),
	checkPayOutStatusService: jest.fn(),
	getPayoutsService: jest.fn(),
	updatePayoutService: jest.fn(),
	deletePayoutService: jest.fn(),
	assignedPayoutService: jest.fn(),
	walletsPayoutsService: jest.fn(),
	getWalletsBalanceService: jest.fn(),
}));
jest.mock('../../utils/sockets.js', () => ({
  newTableEntry: jest.fn().mockResolvedValue(),
}));
jest.mock("../../utils/responseHandlers.js", () => ({
  sendSuccess: jest.fn((res, data, msg = "OK", status = 200) =>
    res.status(status).json({ success: true, message: msg, data })
  ),
  sendNewSuccess: jest.fn((res, data, msg = "OK", status = 200) =>
    res.status(status).json({ success: true, message: msg, data })
  ),
  sendError: jest.fn((res, error, status = 500) =>
    res.status(status).json({ success: false, error, status })
  ),
}));

jest.mock("../../utils/db.js", () => ({
  transactionWrapper: jest.fn(),
}));
// ---- Helpers 
const v4 = '550e8400-e29b-41d4-a716-446655440000'; // valid UUID v4
// ------- Helper mocks --------
const makeRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn(),
});

const makeReq = (overrides = {}) => ({
  headers: { "x-api-key": "test-key", ...(overrides.headers || {}) },
  connection: { remoteAddress: "127.0.0.1", ...(overrides.connection || {}) },
  ip: overrides.ip || "127.0.0.1",
  body: overrides.body || {},
  params: overrides.params || {},
  query: overrides.query || {},
  user: overrides.user,
});

describe("payOutController", () => {
	let req, res, next;

	beforeEach(() => {
		req = {
		user: {
			company_id: 'company123',
			role: 'admin',
			user_id: 'user123',
		},
		headers: {
			'x-api-key': 'test-api-key',
		},
		body: {
			amount: 500,
			beneficiary: 'John Doe',
		},
		};

		res = {
		status: jest.fn().mockReturnThis(),
		json: jest.fn(),
		};

		next = jest.fn();
		jest.clearAllMocks();
	});

	// ---------------- createPayout ----------------
	describe("createPayout", () => {
		it("should create payout successfully", async () => {
		const req = makeReq({
			body: {
			user_id: "1",
			code: "M123",
			amount: 100,
			bank_name: "XYZ",
			ifsc_code: "IFSC1234",
			acc_holder_name: "John",
			acc_no: "123456",
			},
			user: { company_id: "C1", role: "ADMIN", user_id: "U1" },
		});

		const resultMock = { id: "123", merchant_order_id: "ORD1", amount: 100 };
		const wrappedMock = jest.fn().mockResolvedValue(resultMock);
		transactionWrapper.mockReturnValue(wrappedMock);

		await createPayout(req, res);

		expect(transactionWrapper).toHaveBeenCalledWith(payOutService.createPayoutService);
		expect(sendNewSuccess).toHaveBeenCalledWith(
			res,
			{ merchantOrderId: "ORD1", payoutId: "123", amount: 100 },
			"Payout created successfully",
			201
		);
		});

		it("should throw validation error if schema fails", async () => {
		const req = makeReq({ body: {} });
		await expect(createPayout(req, res)).rejects.toThrow(ValidationError);
		});

		it("should return error if service returns 400", async () => {
		const req = makeReq({
			body: { user_id: "1", code: "M123", amount: 200 ,ifsc_code: "IFSC1234", acc_holder_name: "John", acc_no: "123456", bank_name: "XYZ" },
			user: { company_id: "C1", role: "ADMIN", user_id: "U1" },
		});

		const wrappedMock = jest.fn().mockResolvedValue({ status: 400, message: "Bad request" });
		transactionWrapper.mockReturnValue(wrappedMock);

		await createPayout(req, res);

		expect(sendError).toHaveBeenCalledWith(res, "Bad request", 400);
		});
	});

	// ---------------- getPayoutsBySearch ----------------
	describe("getPayoutsBySearch", () => {
		it("should fetch payouts successfully", async () => {
		const req = makeReq({
			query: { page: 1, limit: 10, search: "abc" },
			user: { role: "MERCHANT", user_id: 1, company_id: 1 },
		});

		payOutService.getPayoutsBySearchService.mockResolvedValue([{ id: 1 }]);
		await getPayoutsBySearch(req, res);

		expect(sendSuccess).toHaveBeenCalled();
		});

		it("should throw if service fails", async () => {
		const req = makeReq({
			query: { page: 1, limit: 10 },
			user: { role: "ADMIN", user_id: 1, company_id: 1 },
		});

		payOutService.getPayoutsBySearchService.mockRejectedValue(new Error("DB failed"));
		await expect(getPayoutsBySearch(req, res)).rejects.toThrow("DB failed");
		});
	});

	// ---------------- checkPayOutStatus ----------------
	describe("checkPayOutStatus", () => {
		it("should return success when status fetched", async () => {
		const req = makeReq({
			body: { payoutId: v4, merchantCode: "M123", merchantOrderId: "O123" },
			headers: { "x-api-key": "test-key" },
		});
		payOutService.checkPayOutStatusService.mockResolvedValue({ status: 200, data: {} });

		await checkPayOutStatus(req, res);
		expect(sendNewSuccess).toHaveBeenCalled();
		});

		it("should return success when only given ip status fetched", async () => {
			const req = makeReq({
				body: { payoutId: v4, merchantCode: "M123", merchantOrderId: "O123" },
				ip: "127.0.0.1:3000",
				headers: { "x-api-key": "test-key" },
			});
			payOutService.checkPayOutStatusService.mockResolvedValue({ status: 200, data: {} });

			await checkPayOutStatus(req, res);
			expect(sendNewSuccess).toHaveBeenCalled();
		});
		
		// it('should successfully create a payout when req.user exists', async () => {
		// 	// Arrange
		// 	const req = makeReq({
		// 		body: {
		// 		ifsc_code: "IFSC1234",
		// 		acc_holder_name: "John Doe",
		// 		acc_no: "123456",
		// 		bank_name: "XYZ Bank",
		// 		code: "M123",
		// 		amount: 500,
		// 		},
		// 		connection: { remoteAddress: "127.0.0.1" },
		// 		headers: { "x-api-key": "test-api-key" },
		// 	});

		// 	req.user = {
		// 		company_id: 'company123',
		// 		role: 'admin',
		// 		user_id: 'user123',
		// 	};

		// 	const mockResponse = {
		// 		success: true,
		// 		message: 'Payout created',
		// 		data: [
		// 		{ id: 1, amount: 500 },
		// 		{ id: 2, amount: 300 },
		// 		],
		// 	};

		// 	transactionWrapper.mockImplementation((fn) => fn);
		// 	payOutService.createPayoutService.mockResolvedValue(mockResponse);

		// 	// Act
		// 	await createPayout(req, res, next);

		// 	// Assert
		// 	expect(transactionWrapper).toHaveBeenCalledWith(payOutService.createPayoutService);
		// 	expect(payOutService.createPayoutService).toHaveBeenCalledWith(
		// 		req.headers,
		// 		expect.objectContaining({
		// 		company_id: 'company123',
		// 		created_by: 'user123',
		// 		updated_by: 'user123',
		// 		x_api_key: 'test-api-key',
		// 		amount: 500,
		// 		acc_holder_name: 'John Doe',
		// 		}),
		// 		'admin',
		// 		res,
		// 		undefined, // userIp
		// 		undefined  // fromUI
		// 	);
		// 	expect(res.status).toHaveBeenCalledWith(200);
		// 	expect(res.json).toHaveBeenCalledWith(mockResponse);
		// 	});

		it("should return success when only given the remoteAddress status fetched", async () => {
		const req = makeReq({
			body: { payoutId: v4, merchantCode: "M123", merchantOrderId: "O123" },
			connection: { remoteAddress: "127.0.0.1" },
			headers: { "x-api-key": "test-key" },
		});
		payOutService.checkPayOutStatusService.mockResolvedValue({ status: 200, data: {} });

		await checkPayOutStatus(req, res);
		expect(sendNewSuccess).toHaveBeenCalled();
		});

		it("should return error if status 400", async () => {
		const req = makeReq({
			body: { payoutId: v4, merchantCode: "M123", merchantOrderId: "O123" },
			headers: { "x-api-key": "test-key" },
		});
		payOutService.checkPayOutStatusService.mockResolvedValue({ status: 400, message: "Invalid" });

		await checkPayOutStatus(req, res);
		expect(sendError).toHaveBeenCalledWith(res, "Invalid", 400);
		});
	});

	// ---------------- getPayouts ----------------
	describe("getPayouts", () => {
		it("should fetch payouts successfully", async () => {
		const req = makeReq({
			query: { page: 1, limit: 10 },
			user: { role: "MERCHANT", company_id: 1 },
		});
		payOutService.getPayoutsService.mockResolvedValue([{ id: 1 }]);

		await getPayouts(req, res);
		expect(sendSuccess).toHaveBeenCalled();
		});
	});

	// ---------------- updatePayout ----------------
	describe("updatePayout", () => {
		it("should update payout successfully", async () => {
		const req = makeReq({
			params: { id: "123" },
			body: { utr_id: "UTR123" },
			user: { company_id: 1, role: "ADMIN", user_id: "U1", user_name: "Tester" },
		});

		const wrappedMock = jest.fn().mockResolvedValue({ id: "123" });
		transactionWrapper.mockReturnValue(wrappedMock);

		await updatePayout(req, res);
		expect(sendSuccess).toHaveBeenCalled();
		});
	});

	// ---------------- deletePayout ----------------
	describe("deletePayout", () => {
		it("should delete payout successfully", async () => {
		const req = makeReq({
			params: { id: v4 },
			user: { company_id: 1, user_id: "1", role: "ADMIN" },
		});

		payOutService.deletePayoutService.mockResolvedValue({});
		await deletePayout(req, res);

		expect(sendSuccess).toHaveBeenCalled();
		});
	});

	// ---------------- getPayoutsById ----------------
	describe("getPayoutsById", () => {
		it("should fetch payouts by id", async () => {
		const req = makeReq({
			params: { id: v4 },
			user: { company_id: 1, role: "ADMIN" },
		});
		payOutService.getPayoutsService.mockResolvedValue([{ id: "123" }]);

		await getPayoutsById(req, res);
		expect(sendSuccess).toHaveBeenCalled();
		});
	});

	// ---------------- assignedPayout ----------------
	describe("assignedPayout", () => {
		it("should assign payouts successfully", async () => {
		const req = makeReq({
			params: { id: v4 },
			body: { payouts_ids: [ v4 ] },
			user: { user_id: "1", user_name: "Tester", company_id: 1 },
		});

		const wrappedMock = jest.fn().mockResolvedValue("123");
		transactionWrapper.mockReturnValue(wrappedMock);

		await assignedPayout(req, res);
		expect(sendSuccess).toHaveBeenCalled();
		});
	});

	// ---------------- walletsPayouts ----------------
	describe("walletsPayouts", () => {
		it("should update wallets successfully", async () => {
		const req = makeReq({
			body: { payOutids: [ v4], amount: 100, mode: "DEBIT" },
			user: { company_id: 1, user_id: 1 },
		});

		const wrappedMock = jest.fn().mockResolvedValue(900);
		transactionWrapper.mockReturnValue(wrappedMock);

		await walletsPayouts(req, res);
		expect(sendNewSuccess).toHaveBeenCalledWith(
			res,
			900,
			"Payout updated successfully",
			201,
		);
		});
	});

	// ---------------- getWalletsBalance ----------------
	describe("getWalletsBalance", () => {
		it("should fetch wallets balance", async () => {
		const req = makeReq({ user: { company_id: 1 } });
		payOutService.getWalletsBalanceService.mockResolvedValue({ balance: 1000 });

		await getWalletsBalance(req, res);
		expect(sendNewSuccess).toHaveBeenCalled();
		});
	});
});
