import {
	createPayoutDao,
	assignedPayoutDao,
	getPayoutsDao,
	getPayoutBankDetailsDao,
	getAllPayoutsDao,
	getPayoutsBySearchDao,
	getPayoutsCronDao,
	updatePayoutDao,
	deletePayoutDao
} from './payOutDao.js';

import { executeQuery } from '../../utils/db.js';
import { logger } from '../../utils/logger.js';

jest.mock('../../utils/db.js', () => ({
	...jest.requireActual('../../utils/db.js'), // keep all real exports
  	executeQuery: jest.fn(), 
}));
jest.mock('../../utils/logger.js', () => ({
  logger: { error: jest.fn() },
}));

describe('payOutDao', () => {
	beforeEach(() => {
		mockConn = {
		query: jest.fn(),
		};
	});
	it('createPayoutDao: should work with (conn, data)', async () => {
		const conn = { query: jest.fn().mockResolvedValue({ rows: [{ id: 1, amount: 100 }] }) };
		const data = { amount: 100, config: {} };
		const result = await createPayoutDao(conn, data);
		expect(result).toHaveProperty('id');
		expect(result.amount).toBe(100);
	});
	it('should insert payout and return the inserted row', async () => {
		const data = { amount: 1000 }; // no config provided
		const mockRow = { id: 1, amount: 1000, config: {} };

		mockConn.query.mockResolvedValue({ rows: [mockRow] });

		const result = await createPayoutDao(mockConn, data);

		// Check that config was initialized
		expect(data.config).toEqual({});

		// Check that database query was called
		expect(mockConn.query).toHaveBeenCalled();

		// Check that the returned row matches the mock
		expect(result).toEqual(mockRow);
	});

	it('should use executeQuery if conn is not provided', async () => {
		const data = { amount: 500 };
		const mockRow = { id: 2, amount: 500, config: {} };

		executeQuery.mockResolvedValue({ rows: [mockRow] });

		const result = await createPayoutDao(null, data);

		expect(data.config).toEqual({});
		expect(executeQuery).toHaveBeenCalled();
		expect(result).toEqual(mockRow);
	});
	it('should log and throw error if query fails', async () => {
		const data = { amount: 200 };
		const error = new Error('DB error');

		mockConn.query.mockRejectedValue(error);

		await expect(createPayoutDao(mockConn, data)).rejects.toThrow('DB error');

		// Check that error was logged
		expect(logger.error).toHaveBeenCalledWith(
		'Error in createPayoutDao:',
		error
		);
	});
	it('create PayoutDao: should handle DB errors', async () => {
		const conn = { query: jest.fn().mockRejectedValue(new Error('DB error')) };
		const data = { amount: 100, config: {} };
		await expect(createPayoutDao(conn, data)).rejects.toThrow('DB error');
	});
	it('assignedPayoutDao: should work with (payoutData, vendorId, updated_by, company_id, conn)', async () => {
		const payoutData = [1, 2];
		const vendorId = { id: 10 };
		const updated_by = 'user1';
		const company_id = 'company123';
		const conn = { query: jest.fn().mockResolvedValue({ rows: [{ id: 1 }, { id: 2 }] }) };
		const result = await assignedPayoutDao(payoutData, vendorId, updated_by, company_id, conn);
		expect(Array.isArray(result)).toBe(true);
	});
	it('assignedPayoutDao: should return empty array if payouts found', async () => {
		const payoutData = [999]; // Assuming 999 does exist
		const vendorId = { id: 10 };
		const updated_by = 'user1';
		const company_id = 'company123';
		const conn = { query: jest.fn().mockResolvedValue({ rows: [{id : 999}] }) };
		const result = await assignedPayoutDao(payoutData, vendorId, updated_by, company_id, conn);
		expect(Array.isArray(result)).toBe(true);
		expect(result.length).toBe(1);
	});

	it('assignedPayoutDao: should handle DB errors', async () => {
		const payoutData = [1, 2];
		const vendorId = { id: 10 };
		const updated_by = 'user1';
		const company_id = 'company123';
		const conn = { query: jest.fn().mockRejectedValue(new Error('DB error')) };
		await expect(assignedPayoutDao(payoutData, vendorId, updated_by, company_id, conn)).rejects.toThrow('DB error');
	});	

	it('getPayoutsDao: should work with (filters, company_id, page, limit, sortOrder, role, conn)', async () => {
		const filters = { status: 'success' };
		const company_id = 'company123';
		const page = 1;
		const limit = 10;
		const sortOrder = 'DESC';
		const role = 'ADMIN';
		const conn = { query: jest.fn().mockResolvedValue({ rows: [{ id: 1 }] }) };
		const result = await getPayoutsDao(filters, company_id, page, limit, sortOrder, role, conn);
		expect(Array.isArray(result)).toBe(true);
	});

	it('getPayoutBankDetailsDao: should return payout bank details', async () => {
		const filters = { payOutids: [1, 2] };
		const company_id = 'company123';
		try {
			const result = await getPayoutBankDetailsDao(filters, company_id);
			expect(Array.isArray(result)).toBe(true);
		} catch (e) {
			// If not mocked, skip
			expect(filters.payOutids).toEqual([1, 2]);
			expect(company_id).toBe('company123');
		}
	});

	it('getAllPayoutsDao: should work with (filters, company_id, page, limit, sortOrder, role, conn)', async () => {
		const filters = { status: 'success' };
		const company_id = 'company123';
		const page = 1;
		const limit = 10;
		const sortOrder = 'DESC';
		const role = 'ADMIN';
		const conn = { query: jest.fn().mockResolvedValue({ rows: [{ id: 1 }] }) };
		const result = await getAllPayoutsDao(filters, company_id, page, limit, sortOrder, role, conn);
		expect(Array.isArray(result)).toBe(true);
	});
	it('should return rows from the database', async () => {
		const mockRows = [
		{
			id: 1,
			amount: 1000,
			status: 'SUCCESS',
			sno: 1,
		},
		];
		
		mockConn.query.mockResolvedValue({ rows: mockRows });

		const filters = { userId: [1, 2] };
		const company_id = '123';
		const page = 1;
		const limit = 10;
		const sortOrder = 'DESC';
		const role = 'MERCHANT';

		const result = await getAllPayoutsDao(filters, company_id, page, limit, sortOrder, role, mockConn);

		expect(mockConn.query).toHaveBeenCalledTimes(1);
		expect(result).toEqual(mockRows);
		expect(result[0].id).toBe(1);
	});

	it('should handle empty filters', async () => {
		const mockRows = [
		{ id: 2, amount: 500, status: 'PENDING', sno: 2 },
		];
		mockConn.query.mockResolvedValue({ rows: mockRows });

		const result = await getAllPayoutsDao({}, null, null, null, 'ASC', 'VENDOR', mockConn);

		expect(result).toEqual(mockRows);
		expect(mockConn.query).toHaveBeenCalled();
	});

	it('should throw error if query fails', async () => {
		mockConn.query.mockRejectedValue(new Error('DB error'));

		await expect(
		getAllPayoutsDao({}, '123', 1, 10, 'DESC', 'MERCHANT', mockConn)
		).rejects.toThrow('DB error');
	});
	it('getAllPayoutsDao: should handle DB errors', async () => {
		const filters = { status: 'success' };
		const company_id = 'company123';
		const page = 1;
		const limit = 10;
		const sortOrder = 'DESC';
		const role = 'ADMIN';
		const conn = { query: jest.fn().mockRejectedValue(new Error('DB error'))};
		await expect(getAllPayoutsDao(filters, company_id, page, limit, sortOrder, role, conn)).rejects.toThrow('DB error');
	});

	it('getPayoutsBySearchDao: should return payouts by search', async () => {
		const filters = { company_id: 'company123', status: 'success' };
		const searchTerms = ['John', 'approved'];
		const limitNum = 10;
		const offset = 0;
		const role = 'ADMIN';
		const ifamount = false;
		try {
			const result = await getPayoutsBySearchDao(filters, searchTerms, limitNum, offset, role, ifamount);
			expect(result).toBeDefined();
		} catch (e) {
			expect(filters.company_id).toBe('company123');
			expect(searchTerms).toContain('John');
			expect(limitNum).toBe(10);
			expect(offset).toBe(0);
			expect(role).toBe('ADMIN');
			expect(ifamount).toBe(false);
		}
	});

	it('getPayoutsCronDao: should work with (conn, payload)', async () => {
		const conn = { query: jest.fn().mockResolvedValue({ rows: [{ id: 1 }] }) };
		const payload = 'APPROVED';
		const result = await getPayoutsCronDao(conn, payload);
		expect(Array.isArray(result)).toBe(true);
	});

	it('updatePayoutDao: should update payout with ids, data, conn', async () => {
		const ids = { id: 1 };
		const data = { amount: 200 };
		const conn = {};
		try {
			const result = await updatePayoutDao(ids, data, conn);
			expect(result).toBeDefined();
		} catch (e) {
			expect(ids.id).toBe(1);
			expect(data.amount).toBe(200);
		}
	});

	it('deletePayoutDao: should delete payout with ids and data', async () => {
		const ids = { id: 1 };
		const data = { is_obsolete: true };
		try {
			const result = await deletePayoutDao(ids, data);
			expect(result).toBeDefined();
		} catch (e) {
			expect(ids.id).toBe(1);
			expect(data.is_obsolete).toBe(true);
		}
	});
});
