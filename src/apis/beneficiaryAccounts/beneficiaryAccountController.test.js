import {
    getBeneficiaryAccount,
    getBeneficiaryAccountBySearch,
    getBeneficiaryAccountById,
    createBeneficiaryAccount,
    updateBeneficiaryAccount,
    deleteBeneficiaryAccount,
    getBeneficiaryAccountByBankName,
  } from './beneficiaryAccountController.js';
  import { Role } from '../../constants/index.js';
  import {
    BENEFICIARY_ACCOUNT_SCHEMA,
    UPDATE_BENEFICIARY_ACCOUNT_SCHEMA,
    VALIDATE_BENEFICIARY_ACCOUNT_BY_ID,
  } from '../../schemas/BeneficiaryAccountSchema.js';
  import { logger } from '../../utils/logger.js';
  import { sendSuccess } from '../../utils/responseHandlers.js';
  import {
    getBeneficiaryAccountService,
    createBeneficiaryAccountService,
    updateBeneficiaryAccountService,
    deleteBeneficiaryAccountService,
    getBeneficiaryAccountServiceByBankName,
    getBeneficiaryAccountBySearchService,
  } from './beneficiaryAccountServices.js';
  
  jest.mock('../../schemas/BeneficiaryAccountSchema.js', () => ({
    BENEFICIARY_ACCOUNT_SCHEMA: {
      validate: jest.fn(),
    },
    UPDATE_BENEFICIARY_ACCOUNT_SCHEMA: {
      validate: jest.fn(),
    },
    VALIDATE_BENEFICIARY_ACCOUNT_BY_ID: {
      validate: jest.fn(),
    },
  }));
  
  jest.mock('../../utils/appErrors.js', () => ({
    ValidationError: jest.fn((error) => ({ message: error.message })),
  }));
  
  jest.mock('../../utils/db.js', () => ({
    transactionWrapper: jest.fn((fn) => fn),
  }));
  
  jest.mock('../../utils/logger.js', () => ({
    logger: {
      log: jest.fn(),
    },
  }));
  
  jest.mock('../../utils/responseHandlers.js', () => ({
    sendSuccess: jest.fn((res, data, message) => ({ status: 200, data, message })),
  }));
  
  jest.mock('./beneficiaryAccountServices.js', () => ({
    getBeneficiaryAccountService: jest.fn(),
    createBeneficiaryAccountService: jest.fn(),
    updateBeneficiaryAccountService: jest.fn(),
    deleteBeneficiaryAccountService: jest.fn(),
    getBeneficiaryAccountServiceByBankName: jest.fn(),
    getBeneficiaryAccountBySearchService: jest.fn(),
  }));
  
  describe('Beneficiary Account Controller', () => {
    let req, res;
  
    beforeEach(() => {
      req = {
        user: { role: Role.ADMIN, user_id: 1, designation: 'OPERATIONS', company_id: 1 },
        query: {},
        params: {},
        body: {},
      };
      res = {};
      jest.clearAllMocks();
    });
  
    describe('getBeneficiaryAccount', () => {
      test('should fetch beneficiary accounts with filters and return success', async () => {
        req.query = { page: 1, limit: 10, beneficiary_role: 'user', is_enabled: 'true' };
        const mockData = [{ id: 1, bankAccountsname: 'test_account' }];
        getBeneficiaryAccountService.mockResolvedValue(mockData);
  
        const result = await getBeneficiaryAccount(req, res);
  
        expect(getBeneficiaryAccountService).toHaveBeenCalledWith(
          { beneficiary_role: 'user', 'config->>is_enabled': 'true' },
          Role.ADMIN,
          1,
          10,
          1,
          'OPERATIONS',
          1
        );
        expect(logger.log).toHaveBeenCalledWith('get Beneficiary successfully', Role.ADMIN);
        expect(sendSuccess).toHaveBeenCalledWith(res, mockData, 'get Beneficiary successfully');
        expect(result).toEqual({ status: 200, data: mockData, message: 'get Beneficiary successfully' });
      });
  
      test('should apply is_enabled filter for VENDOR role', async () => {
        req.user.role = Role.VENDOR;
        req.query = { page: 1, limit: 10 };
        const mockData = [{ id: 1, bankAccountsname: 'test_account' }];
        getBeneficiaryAccountService.mockResolvedValue(mockData);
  
        const result = await getBeneficiaryAccount(req, res);
  
        expect(getBeneficiaryAccountService).toHaveBeenCalledWith(
          { 'config->>is_enabled': 'true' },
          Role.VENDOR,
          1,
          10,
          1,
          'OPERATIONS',
          1
        );
        expect(result).toEqual({ status: 200, data: mockData, message: 'get Beneficiary successfully' });
      });
    });
  
    describe('getBeneficiaryAccountBySearch', () => {
      test('should fetch beneficiary accounts by search with filters and return success', async () => {
        req.query = { page: 1, limit: 10, beneficiary_role: 'user', search: 'test', is_enabled: 'true' };
        const mockData = [{ id: 1, bankAccountsname: 'test_account' }];
        getBeneficiaryAccountBySearchService.mockResolvedValue(mockData);
  
        const result = await getBeneficiaryAccountBySearch(req, res);
  
        expect(getBeneficiaryAccountBySearchService).toHaveBeenCalledWith(
          { beneficiary_role: 'user', search: 'test', 'config->>is_enabled': 'true' },
          Role.ADMIN,
          1,
          10,
          1,
          'OPERATIONS',
          1
        );
        expect(logger.log).toHaveBeenCalledWith('get Beneficiary successfully', Role.ADMIN);
        expect(sendSuccess).toHaveBeenCalledWith(res, mockData, 'get Beneficiary successfully');
        expect(result).toEqual({ status: 200, data: mockData, message: 'get Beneficiary successfully' });
      });
  
      test('should apply is_enabled filter for VENDOR role', async () => {
        req.user.role = Role.VENDOR;
        req.query = { page: 1, limit: 10, search: 'test' };
        const mockData = [{ id: 1, bankAccountsname: 'test_account' }];
        getBeneficiaryAccountBySearchService.mockResolvedValue(mockData);
  
        const result = await getBeneficiaryAccountBySearch(req, res);
  
        expect(getBeneficiaryAccountBySearchService).toHaveBeenCalledWith(
          { search: 'test', 'config->>is_enabled': 'true' },
          Role.VENDOR,
          1,
          10,
          1,
          'OPERATIONS',
          1
        );
        expect(result).toEqual({ status: 200, data: mockData, message: 'get Beneficiary successfully' });
      });
    });
  
    describe('getBeneficiaryAccountByBankName', () => {
      test('should fetch beneficiary accounts by bank name and return success', async () => {
        req.query = { type: 'savings' };
        const mockData = [{ id: 1, bankAccountsname: 'test_account' }];
        getBeneficiaryAccountServiceByBankName.mockResolvedValue(mockData);
  
        const result = await getBeneficiaryAccountByBankName(req, res);
  
        expect(getBeneficiaryAccountServiceByBankName).toHaveBeenCalledWith(
          1,
          'savings',
          Role.ADMIN,
          1,
          'OPERATIONS'
        );
        expect(sendSuccess).toHaveBeenCalledWith(res, mockData, 'get Beneficiary successfully');
        expect(result).toEqual({ status: 200, data: mockData, message: 'get Beneficiary successfully' });
      });
    });
  
    describe('getBeneficiaryAccountById', () => {
      test('should fetch beneficiary account by ID and return success', async () => {
        req.params = { id: '1' };
        const mockData = { id: 1, bankAccountsname: 'test_account' };
        getBeneficiaryAccountService.mockResolvedValue(mockData);
  
        const result = await getBeneficiaryAccountById(req, res);
  
        expect(getBeneficiaryAccountService).toHaveBeenCalledWith({ id: '1' }, Role.ADMIN);
        expect(sendSuccess).toHaveBeenCalledWith(res, mockData, 'get Bank successfully');
        expect(result).toEqual({ status: 200, data: mockData, message: 'get Bank successfully' });
      });
    });
  
    describe('createBeneficiaryAccount', () => {
      test('should create beneficiary account and return success', async () => {
        req.body = { bankName: 'test_account' };
        BENEFICIARY_ACCOUNT_SCHEMA.validate.mockReturnValue({ error: null });
        createBeneficiaryAccountService.mockResolvedValue({});
  
        const result = await createBeneficiaryAccount(req, res);
  
        expect(BENEFICIARY_ACCOUNT_SCHEMA.validate).toHaveBeenCalledWith(req.body);
        expect(createBeneficiaryAccountService).toHaveBeenCalledWith(
          { bankName: 'test_account', created_by: 1, updated_by: 1, company_id: 1 },
          1
        );
        expect(sendSuccess).toHaveBeenCalledWith(res, {}, 'Beneficiary Created successfully');
        expect(result).toEqual({ status: 200, data: {}, message: 'Beneficiary Created successfully' });
      });
  
      test('should throw ValidationError on invalid payload', async () => {
        req.body = { bankName: '' };
        BENEFICIARY_ACCOUNT_SCHEMA.validate.mockReturnValue({ error: { message: 'Invalid payload' } });
  
        await expect(createBeneficiaryAccount(req, res)).rejects.toEqual({ message: 'Invalid payload' });
        expect(BENEFICIARY_ACCOUNT_SCHEMA.validate).toHaveBeenCalledWith(req.body);
        expect(createBeneficiaryAccountService).not.toHaveBeenCalled();
      });
    });
  
    describe('updateBeneficiaryAccount', () => {
      test('should update beneficiary account and return success', async () => {
        req.params = { id: '1' };
        req.body = { bankAccountsname: 'updated_account' };
        UPDATE_BENEFICIARY_ACCOUNT_SCHEMA.validate.mockReturnValue({ error: null });
        updateBeneficiaryAccountService.mockResolvedValue({});
  
        const result = await updateBeneficiaryAccount(req, res);
  
        expect(UPDATE_BENEFICIARY_ACCOUNT_SCHEMA.validate).toHaveBeenCalledWith(req.body);
        expect(updateBeneficiaryAccountService).toHaveBeenCalledWith(
          { id: '1', company_id: 1 },
          { bankAccountsname: 'updated_account', updated_by: 1 },
          Role.ADMIN
        );
        expect(sendSuccess).toHaveBeenCalledWith(res, {}, 'Beneficiary Updated successfully');
        expect(result).toEqual({ status: 200, data: {}, message: 'Beneficiary Updated successfully' });
      });
  
      test('should throw ValidationError on invalid payload', async () => {
        req.params = { id: '1' };
        req.body = { bankAccountsname: '' };
        UPDATE_BENEFICIARY_ACCOUNT_SCHEMA.validate.mockReturnValue({ error: { message: 'Invalid payload' } });
  
        await expect(updateBeneficiaryAccount(req, res)).rejects.toEqual({ message: 'Invalid payload' });
        expect(UPDATE_BENEFICIARY_ACCOUNT_SCHEMA.validate).toHaveBeenCalledWith(req.body);
        expect(updateBeneficiaryAccountService).not.toHaveBeenCalled();
      });
    });
  
    describe('deleteBeneficiaryAccount', () => {
      test('should delete beneficiary account and return success', async () => {
        req.params = { id: '1' };
        VALIDATE_BENEFICIARY_ACCOUNT_BY_ID.validate.mockReturnValue({ error: null });
        deleteBeneficiaryAccountService.mockResolvedValue({});
  
        const result = await deleteBeneficiaryAccount(req, res);
  
        expect(VALIDATE_BENEFICIARY_ACCOUNT_BY_ID.validate).toHaveBeenCalledWith('1');
        expect(deleteBeneficiaryAccountService).toHaveBeenCalledWith({ id: '1', company_id: 1 });
        expect(sendSuccess).toHaveBeenCalledWith(res, {}, 'deleted Beneficiary successfully');
        expect(result).toEqual({ status: 200, data: {}, message: 'deleted Beneficiary successfully' });
      });
  
      test('should throw ValidationError on invalid ID', async () => {
        req.params = { id: 'invalid' };
        VALIDATE_BENEFICIARY_ACCOUNT_BY_ID.validate.mockReturnValue({ error: { message: 'Invalid ID' } });
  
        await expect(deleteBeneficiaryAccount(req, res)).rejects.toEqual({ message: 'Invalid ID' });
        expect(VALIDATE_BENEFICIARY_ACCOUNT_BY_ID.validate).toHaveBeenCalledWith('invalid');
        expect(deleteBeneficiaryAccountService).not.toHaveBeenCalled();
      });
    });
  });