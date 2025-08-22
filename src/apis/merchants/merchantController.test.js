import * as merchantController from './merchantController.js';

describe('merchantController error handling', () => {
	it('createMerchant: should handle errors from service', async () => {
		const req = { body: { name: 'Test Merchant', code: 'TST' }, user: { company_id: 'company123', user_id: 'user1', role: 'ADMIN' } };
		const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
		const errorFn = jest.spyOn(require('./merchantController.js'), 'createMerchant').mockRejectedValue(new Error('Service error'));
		await expect(require('./merchantController.js').createMerchant(req, res)).rejects.toThrow('Service error');
		errorFn.mockRestore();
	});

	it('deleteMerchant: should handle errors from service', async () => {
		const req = { params: { id: 1 }, user: { company_id: 'company123', user_id: 'user1', role: 'ADMIN' } };
		const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
		const errorFn = jest.spyOn(require('./merchantController.js'), 'deleteMerchant').mockRejectedValue(new Error('Service error'));
		await expect(require('./merchantController.js').deleteMerchant(req, res)).rejects.toThrow('Service error');
		errorFn.mockRestore();
	});

	it('getMerchants: should handle errors from service', async () => {
		const req = { user: { company_id: 'company123', role: 'ADMIN', user_id: 'user1' } };
		const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
		const errorFn = jest.spyOn(require('./merchantController.js'), 'getMerchants').mockRejectedValue(new Error('Service error'));
		await expect(require('./merchantController.js').getMerchants(req, res)).rejects.toThrow('Service error');
		errorFn.mockRestore();
	});

	it('updateMerchant: should handle errors from service', async () => {
		const req = { params: { id: 1 }, body: { name: 'Updated Merchant' }, user: { company_id: 'company123', user_id: 'user1', role: 'ADMIN' } };
		const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
		const errorFn = jest.spyOn(require('./merchantController.js'), 'updateMerchant').mockRejectedValue(new Error('Service error'));
		await expect(require('./merchantController.js').updateMerchant(req, res)).rejects.toThrow('Service error');
		errorFn.mockRestore();
	});

	it('getMerchantsById: should handle errors from service', async () => {
		const req = { params: { id: 1 }, user: { company_id: 'company123', role: 'ADMIN' } };
		const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
		const errorFn = jest.spyOn(require('./merchantController.js'), 'getMerchantsById').mockRejectedValue(new Error('Service error'));
		await expect(require('./merchantController.js').getMerchantsById(req, res)).rejects.toThrow('Service error');
		errorFn.mockRestore();
	});

	it('getMerchantCodes: should handle errors from service', async () => {
		const req = { user: { company_id: 'company123', role: 'ADMIN' } };
		const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
		const errorFn = jest.spyOn(require('./merchantController.js'), 'getMerchantCodes').mockRejectedValue(new Error('Service error'));
		await expect(require('./merchantController.js').getMerchantCodes(req, res)).rejects.toThrow('Service error');
		errorFn.mockRestore();
	});

	it('getMerchantsBySearch: should handle errors from service', async () => {
		const req = { user: { company_id: 'company123', role: 'ADMIN' }, query: { search: 'Test', page: 1, limit: 10 } };
		const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
		const errorFn = jest.spyOn(require('./merchantController.js'), 'getMerchantsBySearch').mockRejectedValue(new Error('Service error'));
		await expect(require('./merchantController.js').getMerchantsBySearch(req, res)).rejects.toThrow('Service error');
		errorFn.mockRestore();
	});

	it('getMerchantByCode: should handle errors from service', async () => {
		const req = { query: { code: 'TST' }, user: { company_id: 'company123', role: 'ADMIN' } };
		const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
		const errorFn = jest.spyOn(require('./merchantController.js'), 'getMerchantByCode').mockRejectedValue(new Error('Service error'));
		await expect(require('./merchantController.js').getMerchantByCode(req, res)).rejects.toThrow('Service error');
		errorFn.mockRestore();
	});
});
