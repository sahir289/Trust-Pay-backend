import {
	walletsPayoutsService,
	createPayoutService,
	getPayoutsService,
	getPayoutsBySearchService,
	updatePayoutService,
	updateCalculationTable,
	processEkoPayout,
	activateEkoService,
	createEkoWithdraw,
	ekoPayoutStatus,
	assignedPayoutService,
	deletePayoutService,
	ekoWalletBalanceEnquiryInternally,
	checkPayOutStatusService,
	getWalletsBalanceService
} from './payOutService.js';

// Mock DAOs and external dependencies
jest.mock('./payOutDao.js', () => ({
    getPayoutBankDetailsDao: jest.fn(() => [{ id: 1, user_bank_details: { account_holder_name: 'Test', account_no: '123', bank_name: 'Bank', ifsc_code: 'IFSC' }, amount: 100 }]),
    getPayoutsDao: jest.fn(() => []),
    createPayoutDao: jest.fn(() => ({ id: 1 })),
    deletePayoutDao: jest.fn(() => [{ id: 1 }]),
    assignedPayoutDao: jest.fn(() => [{ id: 1 }]),
    getAllPayoutsDao: jest.fn(() => [{ total: 1 }]),
    getPayoutsBySearchDao: jest.fn(() => [{ id: 1 }]),
    updatePayoutDao: jest.fn(() => ({ id: 1 })),
}));
jest.mock('../../utils/db.js', () => ({
    getConnection: jest.fn(() => ({})),
    beginTransaction: jest.fn(),
    commit: jest.fn(),
    rollback: jest.fn(),
    buildSelectQuery: jest.fn(() => [[], {}]), // Mock buildSelectQuery to return an iterable
    executeQuery: jest.fn(() => Promise.resolve([])), // Mock executeQuery to resolve with an empty array
}));
jest.mock('../../utils/logger.js', () => ({ logger: { info: jest.fn(), error: jest.fn() } }));
jest.mock('axios', () => ({ post: jest.fn(() => ({ data: { ErrorCode: '0', Response: { refno: 'REF123', txnid: 'TXN123' } } })), get: jest.fn(() => ({ data: { Response: { Balance: 1000 } } })) }));
jest.mock('../company/companyDao.js', () => ({ getCompanyByIDDao: jest.fn(() => [{ config: { PAY_ASSIST: { walletsPayoutsAgent: 'agent', walletsPayoutsApiKey: 'key', walletsPayoutsUrl: 'url', walletsPayoutsAgentCode: 'code' }, defaultBankId: 1 } }]) }));
jest.mock('../merchants/merchantDao.js', () => ({ getMerchantsDao: jest.fn(() => [{ id: 1, payout_commission: 10, config: { keys: { private: 'key', public: 'key' }, urls: {} }, balance: 100, min_payout: 10, max_payout: 1000 }]), getMerchantsByCodeDao: jest.fn(() => [{ id: 1, payout_commission: 10, config: { keys: { private: 'key', public: 'key' }, urls: {} }, balance: 100, min_payout: 10, max_payout: 1000 }]), getMerchantByUserIdDao: jest.fn(() => [{ id: 1 }]) }));
jest.mock('../vendors/vendorDao.js', () => ({ getVendorsDao: jest.fn(() => [{ id: 1, payout_commission: 10 }]) }));
jest.mock('../bankAccounts/bankaccountDao.js', () => ({ getBankByIdDao: jest.fn(() => [{ id: 1, user_id: 1, today_balance: 1000, balance: 1000, payin_count: 1, config: { max_limit: 10000 } }]), updateBankaccountDao: jest.fn() }));
jest.mock('../calculation/calculationDao.js', () => ({ getCalculationDao: jest.fn(() => ({ totalNetBalance: 1000 })), getCalculationforCronDao: jest.fn(() => [{ id: 1 }]), updateCalculationBalanceDao: jest.fn(() => ({})) }));
jest.mock('../../helpers/index.js', () => ({ calculateCommission: jest.fn(() => 10), filterResponse: jest.fn(() => ({})) }));
jest.mock('../../constants/index.js', () => ({ Status: { APPROVED: 'APPROVED', REJECTED: 'REJECTED', PENDING: 'PENDING', INITIATED: 'INITIATED' }, Method: { EKO: 'EKO' }, tableName: { PAYOUT: 'PAYOUT' }, payAssistErrorCodeMap: { '0': 'Success', '14': 'Failed', 'TUP': 'Transaction Under Process' }, columns: { PAYOUT: {} }, merchantColumns: { PAYOUT: {} }, vendorColumns: { PAYOUT: {} }, Role: { MERCHANT: 'MERCHANT', VENDOR: 'VENDOR', ADMIN: 'ADMIN', SUB_MERCHANT: 'SUB_MERCHANT', MERCHANT_OPERATIONS: 'MERCHANT_OPERATIONS', VENDOR_OPERATIONS: 'VENDOR_OPERATIONS' } }));
jest.mock('../../utils/sockets.js', () => ({ newTableEntry: jest.fn() }));
jest.mock('../../callBacksAndWebHook/merchantCallBacks.js', () => ({ merchantPayoutCallback: jest.fn() }));

describe('payOutService functions', () => {
    it('should process walletsPayoutsService successfully', async () => {
        const conn = {};
        const payload = { mode: 'IMPS', payOutids: [1], company_id: 1 };
        const updatedBy = 1;
        const res = {};
        await expect(walletsPayoutsService(conn, payload, updatedBy, res)).resolves.toBeDefined();
    });
    it('should handle error in walletsPayoutsService', async () => {
        await expect(walletsPayoutsService(null, {}, null, null)).resolves.toMatchObject({ status: 400 });
    });

    it('should process createPayoutService successfully', async () => {
        const conn = {};
        const headers = {};
        const payload = { code: 'M123', amount: 100, x_api_key: 'key', company_id: 1 };
        const role = 'MERCHANT';
        const userIp = '127.0.0.1';
        const fromUI = false;
        await expect(createPayoutService(conn, headers, payload, role, userIp, fromUI)).resolves.toBeDefined();
    });
    it('should handle error in createPayoutService', async () => {
        await expect(createPayoutService(null, null, {}, null, null, null)).resolves.toMatchObject({ status: 404 });
    });

    // it('should process getPayoutsService successfully', async () => {
    //     const company_id = 1
    //     const page = 1
    //     const limit = 10
    //     const sortOrder = 'DESC'
    //     const filters = {}
    //     const role = 'MERCHANT'
    //     const user_id = 1
    //     const designation = 'MERCHANT'
    //     await expect(getPayoutsService(company_id,page,limit,sortOrder,filters,role,user_id,designation)).resolves.toBeDefined();
    // });
    it('should handle error in getPayoutsService', async () => {
        await expect(getPayoutsService(null, null, null, null, {}, null, null, null)).rejects.toBeDefined();
    });

    it('should process getPayoutsBySearchService successfully', async () => {
        await expect(getPayoutsBySearchService({ page: 1, limit: 10, search: '' }, 'MERCHANT', 1, 'MERCHANT', false)).resolves.toBeDefined();
    });
    it('should handle error in getPayoutsBySearchService', async () => {
        await expect(getPayoutsBySearchService({}, null, null, null, null)).rejects.toBeDefined();
    });

    // it('should process updatePayoutService successfully', async () => {
    //     const conn = {};
    //     const ids = { id: 1, company_id: 1 };
    //     const payload = { utr_id: 'UTR123', updated_by: 1 };
    //     await expect(updatePayoutService(conn, ids, payload, 'MERCHANT')).resolves.toBeDefined();
    // });
    it('should handle error in updatePayoutService', async () => {
        await expect(updatePayoutService(null, {}, {}, null)).rejects.toBeDefined();
    });

    it('should process assignedPayoutService successfully', async () => {
        const conn = {};
        const id = 1;
        const payload = [{ id: 1 }];
        const updated_by = 1;
        const company_id = 1;
        await expect(assignedPayoutService(conn, id, payload, updated_by, company_id)).resolves.toBeDefined();
    });
    it('should handle error in assignedPayoutService', async () => {
        await expect(assignedPayoutService(null, null, null, null, null)).resolves.toBeDefined();
    });

    it('should process deletePayoutService successfully', async () => {
        const id = 1;
        const updated_by = 1;
        const role = 'MERCHANT';
        await expect(deletePayoutService(id, updated_by, role)).resolves.toBeDefined();
    });
    it('should handle error in deletePayoutService', async () => {
        await expect(deletePayoutService(null, null, null)).resolves.toEqual({});
    });

    // it('should process checkPayOutStatusService successfully', async () => {
    //     const payOutId = 1;
    //     const merchantCode = 'M123';
    //     const merchantOrderId = 'q13e-rr-y7';
    //     const api_key = 'key';
    //     await expect(checkPayOutStatusService(payOutId, merchantCode, merchantOrderId, api_key)).resolves.toBeDefined();
    // });
    it('should handle error in checkPayOutStatusService', async () => {
        await expect(checkPayOutStatusService(null, null, null, null)).resolves.toMatchObject({ status: 404 });
    });

    it('should process getWalletsBalanceService successfully', async () => {
        const company_id = 1;
        await expect(getWalletsBalanceService(company_id)).resolves.toBeDefined();
    });
    // it('should handle error in getWalletsBalanceService', async () => {
    //     await expect(getWalletsBalanceService(null)).rejects.toBeDefined();
    // });
});
