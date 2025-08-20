import {
    getBankaccount,
    getBankAccountBySearch,
    getBankaccountNickName,
    getBankaccountById,
    createBankaccount,
    updateBankaccount,
    getMerchantBank,
    deleteBankaccount,
  } from './bankaccountController.js'; 
  import {
    BANK_ACCOUNT_SCHEMA,
    UPDATE_BANK_ACCOUNT_SCHEMA,
    VALIDATE_BANK_RESPONSE_BY_ID,
  } from '../../schemas/bankAccoountSchema.js';
  import { ValidationError } from '../../utils/appErrors.js';
  import { transactionWrapper } from '../../utils/db.js';
  import { sendError, sendSuccess } from '../../utils/responseHandlers.js';
  import { getBankaccountDao, getMerchantBankDao } from './bankaccountDao.js';
  import {
    getBankaccountService,
    getBankaccountServiceNickName,
    getBankAccountBySearchService,
  } from './bankaccountServices.js';
  import { columns, merchantColumns, Role, vendorColumns } from '../../constants/index.js';
  
  jest.mock('../../schemas/bankAccoountSchema.js');
  jest.mock('../../utils/appErrors.js');
  jest.mock('../../utils/db.js');
  jest.mock('../../utils/responseHandlers.js');
  jest.mock('./bankaccountDao.js');
  jest.mock('./bankaccountServices.js');
  jest.mock('../../constants/index.js');
  
  const mockReq = () => ({
    user: { company_id: 'comp1', role: Role.ADMIN, user_id: 'user1', designation: 'desig1', user_name: 'username' },
    body: {},
    params: {},
    query: {},
  });
  
  const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };
  
  sendSuccess.mockImplementation((res, data, message) => res.json({ success: true, data, message }));
  sendError.mockImplementation((res, message, status) => res.status(status).json({ success: false, message }));
  
  describe('Bank Account Controller', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });
  
    describe('getBankaccount', () => {
      it('should get bank accounts successfully', async () => {
        const req = mockReq();
        req.query = { page: 1, limit: 10, bank_used_for: 'PayIn' };
        const res = mockRes();
        const mockData = [{ id: 1 }];
        getBankaccountService.mockResolvedValue(mockData);
  
        await getBankaccount(req, res);
  
        expect(getBankaccountService).toHaveBeenCalledWith(
          { bank_used_for: 'PayIn' },
          'comp1',
          Role.ADMIN,
          1,
          10,
          'user1',
          'desig1'
        );
        expect(sendSuccess).toHaveBeenCalledWith(res, mockData, 'get Banks successfully');
      });
  
      it('should handle errors from service', async () => {
        const req = mockReq();
        const res = mockRes();
        getBankaccountService.mockRejectedValue(new Error('Service error'));
  
        await expect(getBankaccount(req, res)).rejects.toThrow('Service error');
      });
    });
  
    describe('getBankAccountBySearch', () => {
      it('should get bank accounts by search successfully', async () => {
        const req = mockReq();
        req.query = { page: 1, limit: 10, bank_used_for: 'PayIn', search: 'test' };
        const res = mockRes();
        const mockData = [{ id: 1 }];
        getBankAccountBySearchService.mockResolvedValue(mockData);
  
        await getBankAccountBySearch(req, res);
  
        expect(getBankAccountBySearchService).toHaveBeenCalledWith(
          { bank_used_for: 'PayIn' },
          'comp1',
          Role.ADMIN,
          1,
          10,
          'user1',
          'desig1',
          'test'
        );
        expect(sendSuccess).toHaveBeenCalledWith(res, mockData, 'get Banks successfully');
      });
  
      it('should handle errors from service', async () => {
        const req = mockReq();
        const res = mockRes();
        getBankAccountBySearchService.mockRejectedValue(new Error('Service error'));
  
        await expect(getBankAccountBySearch(req, res)).rejects.toThrow('Service error');
      });
    });
  
    describe('getBankaccountNickName', () => {
      it('should get bank account nicknames successfully', async () => {
        const req = mockReq();
        req.query = { type: 'type1', user: 'userquery' };
        const res = mockRes();
        const mockData = ['nick1'];
        getBankaccountServiceNickName.mockResolvedValue(mockData);
  
        await getBankaccountNickName(req, res);
  
        expect(getBankaccountServiceNickName).toHaveBeenCalledWith(
          'comp1',
          'type1',
          Role.ADMIN,
          'user1',
          'desig1',
          'userquery',
          undefined
        );
        expect(sendSuccess).toHaveBeenCalledWith(res, mockData, 'get Banks successfully');
      });
  
      it('should handle errors from service', async () => {
        const req = mockReq();
        const res = mockRes();
        getBankaccountServiceNickName.mockRejectedValue(new Error('Service error'));
  
        await expect(getBankaccountNickName(req, res)).rejects.toThrow('Service error');
      });
    });
  
    describe('getBankaccountById', () => {
      it('should get bank account by ID successfully', async () => {
        const req = mockReq();
        req.params = { id: '1' };
        const res = mockRes();
        const mockData = { id: 1 };
        getBankaccountService.mockResolvedValue(mockData);
  
        await getBankaccountById(req, res);
  
        expect(getBankaccountService).toHaveBeenCalledWith(
          { company_id: 'comp1', id: '1' },
          Role.ADMIN
        );
        expect(sendSuccess).toHaveBeenCalledWith(res, mockData, 'get Bank successfully');
      });
  
      it('should handle errors from service', async () => {
        const req = mockReq();
        req.params = { id: '1' };
        const res = mockRes();
        getBankaccountService.mockRejectedValue(new Error('Service error'));
  
        await expect(getBankaccountById(req, res)).rejects.toThrow('Service error');
      });
    });
  
    describe('createBankaccount', () => {
      it('should create bank account successfully for PayIn with phonepe and intent', async () => {
        const req = mockReq();
        req.body = {
          nick_name: 'unique',
          bank_used_for: 'PayIn',
          is_phonepay: true,
          is_intent: true,
          other: 'data'
        };
        const res = mockRes();
        BANK_ACCOUNT_SCHEMA.validate.mockReturnValue({ error: null });
        getBankaccountDao.mockResolvedValue([]);
        const mockService = jest.fn().mockResolvedValue({ id: 1 });
        transactionWrapper.mockReturnValue(mockService);
        const expectedPayload = {
          nick_name: 'unique',
          bank_used_for: 'PayIn',
          other: 'data',
          config: { merchants: [], is_phonepay: true, is_intent: true },
          created_by: 'user1',
          updated_by: 'user1',
          company_id: 'comp1',
          payin_count: 0
        };
  
        await createBankaccount(req, res);
  
        expect(BANK_ACCOUNT_SCHEMA.validate).toHaveBeenCalledWith(req.body);
        expect(getBankaccountDao).toHaveBeenCalledWith({ nick_name: 'unique' }, null, null, Role.ADMIN);
        expect(mockService).toHaveBeenCalledWith(expectedPayload, 'desig1', 'user1', 'comp1');
        expect(sendSuccess).toHaveBeenCalledWith(res, { id: 1, created_by: 'username' }, 'Created Banks successfully');
      });
  
      it('should create bank account successfully for non-PayIn', async () => {
        const req = mockReq();
        req.body = {
          nick_name: 'unique',
          bank_used_for: 'Other',
          other: 'data'
        };
        const res = mockRes();
        BANK_ACCOUNT_SCHEMA.validate.mockReturnValue({ error: null });
        getBankaccountDao.mockResolvedValue([]);
        const mockService = jest.fn().mockResolvedValue({ id: 1 });
        transactionWrapper.mockReturnValue(mockService);
        const expectedPayload = {
          nick_name: 'unique',
          bank_used_for: 'Other',
          other: 'data',
          config: {},
          created_by: 'user1',
          updated_by: 'user1',
          company_id: 'comp1',
          payin_count: 0
        };
  
        await createBankaccount(req, res);
  
        expect(mockService).toHaveBeenCalledWith(expectedPayload, 'desig1', 'user1', 'comp1');
      });
  
      it('should throw validation error on invalid payload', async () => {
        const req = mockReq();
        req.body = { invalid: true };
        const res = mockRes();
        BANK_ACCOUNT_SCHEMA.validate.mockReturnValue({ error: 'validation error' });
        ValidationError.mockImplementation((err) => new Error(err));
  
        await expect(createBankaccount(req, res)).rejects.toThrow('validation error');
      });
  
      it('should send error if nickname is not unique', async () => {
        const req = mockReq();
        req.body = { nick_name: 'duplicate' };
        const res = mockRes();
        BANK_ACCOUNT_SCHEMA.validate.mockReturnValue({ error: null });
        getBankaccountDao.mockResolvedValue([{ id: 1 }]);
  
        await createBankaccount(req, res);
  
        expect(sendError).toHaveBeenCalledWith(res, 'Nick Name Must Be Unique', 400);
      });
  
      it('should set payin_count to 0 if not provided', async () => {
        const req = mockReq();
        req.body = { nick_name: 'unique', bank_used_for: 'PayIn' };
        const res = mockRes();
        BANK_ACCOUNT_SCHEMA.validate.mockReturnValue({ error: null });
        getBankaccountDao.mockResolvedValue([]);
        const mockService = jest.fn().mockResolvedValue({ id: 1 });
        transactionWrapper.mockReturnValue(mockService);
  
        await createBankaccount(req, res);
  
        expect(mockService.mock.calls[0][0].payin_count).toBe(0);
      });
  
      it('should handle errors from service', async () => {
        const req = mockReq();
        req.body = { nick_name: 'unique', bank_used_for: 'PayIn' };
        const res = mockRes();
        BANK_ACCOUNT_SCHEMA.validate.mockReturnValue({ error: null });
        getBankaccountDao.mockResolvedValue([]);
        const mockService = jest.fn().mockRejectedValue(new Error('Service error'));
        transactionWrapper.mockReturnValue(mockService);
  
        await expect(createBankaccount(req, res)).rejects.toThrow('Service error');
      });
    });
  
    describe('updateBankaccount', () => {
      it('should update bank account successfully', async () => {
        const req = mockReq();
        req.params = { id: '1' };
        req.body = { field: 'updated' };
        const res = mockRes();
        UPDATE_BANK_ACCOUNT_SCHEMA.validate.mockReturnValue({ error: null });
        const mockService = jest.fn().mockResolvedValue({ id: 1 });
        transactionWrapper.mockReturnValue(mockService);
  
        await updateBankaccount(req, res);
  
        expect(UPDATE_BANK_ACCOUNT_SCHEMA.validate).toHaveBeenCalledWith(req.body);
        expect(mockService).toHaveBeenCalledWith(
          { id: '1', company_id: 'comp1' },
          { field: 'updated', updated_by: 'user1' },
          Role.ADMIN,
          'comp1',
          'user1'
        );
        expect(sendSuccess).toHaveBeenCalledWith(res, { id: 1, updated_by: 'username' }, 'Updated Banks successfully');
      });
  
      it('should throw validation error on invalid payload', async () => {
        const req = mockReq();
        req.params = { id: '1' };
        req.body = { invalid: true };
        const res = mockRes();
        UPDATE_BANK_ACCOUNT_SCHEMA.validate.mockReturnValue({ error: 'validation error' });
        ValidationError.mockImplementation((err) => new Error(err));
  
        await expect(updateBankaccount(req, res)).rejects.toThrow('validation error');
      });
  
      it('should handle errors from service', async () => {
        const req = mockReq();
        req.params = { id: '1' };
        req.body = { field: 'updated' };
        const res = mockRes();
        UPDATE_BANK_ACCOUNT_SCHEMA.validate.mockReturnValue({ error: null });
        const mockService = jest.fn().mockRejectedValue(new Error('Service error'));
        transactionWrapper.mockReturnValue(mockService);
  
        await expect(updateBankaccount(req, res)).rejects.toThrow('Service error');
      });
    });
  
    describe('getMerchantBank', () => {
      it('should get merchant bank for MERCHANT role', async () => {
        const req = mockReq();
        req.user.role = Role.MERCHANT;
        const res = mockRes();
        const mockData = [{ id: 1 }];
        getMerchantBankDao.mockResolvedValue(mockData);
  
        await getMerchantBank(req, res);
  
        expect(getMerchantBankDao).toHaveBeenCalledWith(
          { company_id: 'comp1', user_id: 'user1' },
          null,
          null,
          null,
          null,
          merchantColumns.BANK_ACCOUNT
        );
        expect(sendSuccess).toHaveBeenCalledWith(res, mockData, 'Bank details fetched successfully');
      });
  
      it('should get merchant bank for VENDOR role', async () => {
        const req = mockReq();
        req.user.role = Role.VENDOR;
        const res = mockRes();
        const mockData = [{ id: 1 }];
        getMerchantBankDao.mockResolvedValue(mockData);
  
        await getMerchantBank(req, res);
  
        expect(getMerchantBankDao).toHaveBeenCalledWith(
          { company_id: 'comp1', user_id: 'user1' },
          null,
          null,
          null,
          null,
          vendorColumns.BANK_ACCOUNT
        );
      });
  
      it('should get merchant bank for other roles', async () => {
        const req = mockReq();
        req.user.role = Role.ADMIN;
        const res = mockRes();
        const mockData = [{ id: 1 }];
        getMerchantBankDao.mockResolvedValue(mockData);
  
        await getMerchantBank(req, res);
  
        expect(getMerchantBankDao).toHaveBeenCalledWith(
          { company_id: 'comp1', user_id: 'user1' },
          null,
          null,
          null,
          null,
          columns.BANK_ACCOUNT
        );
      });
  
      it('should handle errors from DAO', async () => {
        const req = mockReq();
        const res = mockRes();
        getMerchantBankDao.mockRejectedValue(new Error('DAO error'));
  
        await expect(getMerchantBank(req, res)).rejects.toThrow('DAO error');
      });
    });
  
    describe('deleteBankaccount', () => {
      it('should delete bank account successfully', async () => {
        const req = mockReq();
        req.params = { id: '1' };
        const res = mockRes();
        VALIDATE_BANK_RESPONSE_BY_ID.validate.mockReturnValue({ error: null });
        const mockService = jest.fn().mockResolvedValue({ id: 1 });
        transactionWrapper.mockReturnValue(mockService);
  
        await deleteBankaccount(req, res);
  
        expect(VALIDATE_BANK_RESPONSE_BY_ID.validate).toHaveBeenCalledWith('1');
        expect(mockService).toHaveBeenCalledWith(
          { id: '1', company_id: 'comp1' },
          'user1'
        );
        expect(sendSuccess).toHaveBeenCalledWith(res, { id: 1, deleted_by: 'username' }, 'Deleted Banks Successfully');
      });
  
      it('should throw validation error on invalid ID', async () => {
        const req = mockReq();
        req.params = { id: 'invalid' };
        const res = mockRes();
        VALIDATE_BANK_RESPONSE_BY_ID.validate.mockReturnValue({ error: 'validation error' });
        ValidationError.mockImplementation((err) => new Error(err));
  
        await expect(deleteBankaccount(req, res)).rejects.toThrow('validation error');
      });
  
      it('should handle errors from service', async () => {
        const req = mockReq();
        req.params = { id: '1' };
        const res = mockRes();
        VALIDATE_BANK_RESPONSE_BY_ID.validate.mockReturnValue({ error: null });
        const mockService = jest.fn().mockRejectedValue(new Error('Service error'));
        transactionWrapper.mockReturnValue(mockService);
  
        await expect(deleteBankaccount(req, res)).rejects.toThrow('Service error');
      });
    });
  });