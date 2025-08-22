const request = require('supertest');
const express = require('express');
const {
  getBankaccount,
  getBankAccountBySearch,
  getBankaccountById,
  createBankaccount,
  updateBankaccount,
  deleteBankaccount,
  getMerchantBank,
  getBankaccountNickName,
} = require('../bankAccounts/bankaccountController.js'); // Adjust path to your controller file
const {
  getBankaccountService,
  getBankAccountBySearchService,
  getBankaccountServiceNickName,
  createBankaccountService,
  updateBankaccountService,
  deleteBankaccountService,
  getMerchantBankDao,
  getBankaccountDao,
} = require('../bankAccounts/bankaccountServices.js'); // Adjust path to your services
const { transactionWrapper } = require('../../utils/db');
const { ValidationError } = require('../../utils/appErrors');
const { Role, columns, merchantColumns, vendorColumns } = require('../../constants');

jest.mock('../bankAccounts/bankaccountServices.js');
jest.mock('../../utils/db');

const app = express();
app.use(express.json());

// Middleware to simulate req.user
app.use((req, res, next) => {
  req.user = req.get('user') ? JSON.parse(req.get('user')) : null;
  next();
});

// Define routes
app.get('/bankaccount', getBankaccount);
app.get('/bankaccount/search', getBankAccountBySearch);
app.get('/bankaccount/nickname', getBankaccountNickName);
app.get('/bankaccount/:id', getBankaccountById);
app.post('/bankaccount', createBankaccount);
app.put('/bankaccount/:id', updateBankaccount);
app.get('/merchant/bank', getMerchantBank);
app.delete('/bankaccount/:id', deleteBankaccount);

// Mock user for req.user
const mockUser = {
  company_id: '123',
  user_id: 'user1',
  role: Role.ADMIN,
  designation: 'manager',
  user_name: 'John Doe',
};

describe('Bank Account Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    transactionWrapper.mockImplementation(fn => fn); // Mock transaction wrapper to call function directly
  });

  describe('getBankaccount', () => {
    it('should return bank accounts successfully', async () => {
      const mockData = [{ id: 1, nick_name: 'Bank1' }];
      getBankaccountService.mockResolvedValue(mockData);

      const response = await request(app)
        .get('/bankaccount?page=1&limit=10&bank_used_for=PayIn')
        .set('user', JSON.stringify(mockUser));

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: mockData,
        message: 'get Banks successfully',
      });
      expect(getBankaccountService).toHaveBeenCalledWith(
        { bank_used_for: 'PayIn' },
        mockUser.company_id,
        mockUser.role,
        '1',
        '10',
        mockUser.user_id,
        mockUser.designation
      );
    });

    it('should handle errors from getBankaccountService', async () => {
      getBankaccountService.mockRejectedValue(new Error('Service error'));

      const response = await request(app)
        .get('/bankaccount')
        .set('user', JSON.stringify(mockUser));

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Service error');
    });

    it('should handle missing query parameters', async () => {
      const mockData = [{ id: 1, nick_name: 'Bank1' }];
      getBankaccountService.mockResolvedValue(mockData);

      const response = await request(app)
        .get('/bankaccount')
        .set('user', JSON.stringify(mockUser));

      expect(response.status).toBe(200);
      expect(getBankaccountService).toHaveBeenCalledWith(
        { bank_used_for: undefined },
        mockUser.company_id,
        mockUser.role,
        undefined,
        undefined,
        mockUser.user_id,
        mockUser.designation
      );
    });
  });

  describe('getBankAccountBySearch', () => {
    it('should return bank accounts based on search', async () => {
      const mockData = [{ id: 1, nick_name: 'Bank1' }];
      getBankAccountBySearchService.mockResolvedValue(mockData);

      const response = await request(app)
        .get('/bankaccount/search?page=1&limit=10&bank_used_for=PayIn&search=Bank1')
        .set('user', JSON.stringify(mockUser));

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: mockData,
        message: 'get Banks successfully',
      });
      expect(getBankAccountBySearchService).toHaveBeenCalledWith(
        { bank_used_for: 'PayIn' },
        mockUser.company_id,
        mockUser.role,
        '1',
        '10',
        mockUser.user_id,
        mockUser.designation,
        'Bank1'
      );
    });

    it('should handle missing search parameter', async () => {
      const mockData = [{ id: 1, nick_name: 'Bank1' }];
      getBankAccountBySearchService.mockResolvedValue(mockData);

      const response = await request(app)
        .get('/bankaccount/search?page=1&limit=10')
        .set('user', JSON.stringify(mockUser));

      expect(response.status).toBe(200);
      expect(getBankAccountBySearchService).toHaveBeenCalledWith(
        { bank_used_for: undefined },
        mockUser.company_id,
        mockUser.role,
        '1',
        '10',
        mockUser.user_id,
        mockUser.designation,
        undefined
      );
    });

    it('should handle service errors', async () => {
      getBankAccountBySearchService.mockRejectedValue(new Error('Search error'));

      const response = await request(app)
        .get('/bankaccount/search?search=Bank1')
        .set('user', JSON.stringify(mockUser));

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Search error');
    });
  });

  describe('getBankaccountNickName', () => {
    it('should return bank accounts by nickname', async () => {
      const mockData = [{ nick_name: 'Bank1' }];
      getBankaccountServiceNickName.mockResolvedValue(mockData);

      const response = await request(app)
        .get('/bankaccount/nickname?type=PayIn&user=user1')
        .set('user', JSON.stringify(mockUser));

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: mockData,
        message: 'get Banks successfully',
      });
      expect(getBankaccountServiceNickName).toHaveBeenCalledWith(
        mockUser.company_id,
        'PayIn',
        mockUser.role,
        mockUser.user_id,
        mockUser.designation,
        'user1'
      );
    });

    it('should handle missing type and user parameters', async () => {
      const mockData = [{ nick_name: 'Bank1' }];
      getBankaccountServiceNickName.mockResolvedValue(mockData);

      const response = await request(app)
        .get('/bankaccount/nickname')
        .set('user', JSON.stringify(mockUser));

      expect(response.status).toBe(200);
      expect(getBankaccountServiceNickName).toHaveBeenCalledWith(
        mockUser.company_id,
        undefined,
        mockUser.role,
        mockUser.user_id,
        mockUser.designation,
        undefined
      );
    });

    it('should handle service errors', async () => {
      getBankaccountServiceNickName.mockRejectedValue(new Error('Nickname error'));

      const response = await request(app)
        .get('/bankaccount/nickname?type=PayIn')
        .set('user', JSON.stringify(mockUser));

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Nickname error');
    });
  });

  describe('getBankaccountById', () => {
    it('should return bank account by ID', async () => {
      const mockData = { id: '1', nick_name: 'Bank1' };
      getBankaccountService.mockResolvedValue(mockData);

      const response = await request(app)
        .get('/bankaccount/1')
        .set('user', JSON.stringify(mockUser));

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: mockData,
        message: 'get Bank successfully',
      });
      expect(getBankaccountService).toHaveBeenCalledWith(
        { company_id: mockUser.company_id, id: '1' },
        mockUser.role
      );
    });

    it('should handle invalid ID', async () => {
      getBankaccountService.mockRejectedValue(new Error('Bank not found'));

      const response = await request(app)
        .get('/bankaccount/invalid')
        .set('user', JSON.stringify(mockUser));

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Bank not found');
    });
  });

  describe('createBankaccount', () => {
    it('should create bank account successfully for PayIn', async () => {
      const payload = {
        nick_name: 'Bank1',
        bank_used_for: 'PayIn',
        is_phonepay: true,
        is_intent: false,
      };
      const mockBank = { id: '1', nick_name: 'Bank1' };
      getBankaccountDao.mockResolvedValue([]);
      createBankaccountService.mockResolvedValue(mockBank);

      const response = await request(app)
        .post('/bankaccount')
        .send(payload)
        .set('user', JSON.stringify(mockUser));

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: { id: mockBank.id, created_by: mockUser.user_name },
        message: 'Created Banks successfully',
      });
      expect(getBankaccountDao).toHaveBeenCalledWith(
        { nick_name: 'Bank1' },
        null,
        null,
        mockUser.role
      );
      expect(createBankaccountService).toHaveBeenCalledWith(
        {
          nick_name: 'Bank1',
          bank_used_for: 'PayIn',
          payin_count: 0,
          config: { merchants: [], is_phonepay: true, is_intent: false },
          created_by: mockUser.user_id,
          updated_by: mockUser.user_id,
          company_id: mockUser.company_id,
        },
        mockUser.designation,
        mockUser.user_id,
        mockUser.company_id
      );
    });

    it('should create bank account with default payin_count', async () => {
      const payload = { nick_name: 'Bank2', bank_used_for: 'Payout' };
      const mockBank = { id: '2', nick_name: 'Bank2' };
      getBankaccountDao.mockResolvedValue([]);
      createBankaccountService.mockResolvedValue(mockBank);

      const response = await request(app)
        .post('/bankaccount')
        .send(payload)
        .set('user', JSON.stringify(mockUser));

      expect(response.status).toBe(200);
      expect(createBankaccountService).toHaveBeenCalledWith(
        expect.objectContaining({ payin_count: 0, config: {} }),
        mockUser.designation,
        mockUser.user_id,
        mockUser.company_id
      );
    });

    it('should return error for duplicate nickname', async () => {
      const payload = { nick_name: 'Bank1', bank_used_for: 'PayIn' };
      getBankaccountDao.mockResolvedValue([{ id: '1', nick_name: 'Bank1' }]);

      const response = await request(app)
        .post('/bankaccount')
        .send(payload)
        .set('user', JSON.stringify(mockUser));

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'Nick Name Must Be Unique',
        status: 400,
      });
    });

    it('should throw validation error for invalid payload', async () => {
      const payload = { nick_name: '' }; // Invalid payload
      getBankaccountDao.mockResolvedValue([]);

      const response = await request(app)
        .post('/bankaccount')
        .send(payload)
        .set('user', JSON.stringify(mockUser));

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('ValidationError');
    });
  });

  describe('updateBankaccount', () => {
    it('should update bank account successfully', async () => {
      const payload = { nick_name: 'UpdatedBank' };
      const mockBank = { id: '1', nick_name: 'UpdatedBank' };
      updateBankaccountService.mockResolvedValue(mockBank);

      const response = await request(app)
        .put('/bankaccount/1')
        .send(payload)
        .set('user', JSON.stringify(mockUser));

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: { id: mockBank.id, updated_by: mockUser.user_name },
        message: 'Updated Banks successfully',
      });
      expect(updateBankaccountService).toHaveBeenCalledWith(
        { id: '1', company_id: mockUser.company_id },
        { nick_name: 'UpdatedBank', updated_by: mockUser.user_id },
        mockUser.role,
        mockUser.company_id,
        mockUser.user_id
      );
    });

    it('should throw validation error for invalid payload', async () => {
      const payload = { nick_name: '' }; // Invalid payload

      const response = await request(app)
        .put('/bankaccount/1')
        .send(payload)
        .set('user', JSON.stringify(mockUser));

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('ValidationError');
    });

    it('should handle service errors', async () => {
      const payload = { nick_name: 'UpdatedBank' };
      updateBankaccountService.mockRejectedValue(new Error('Update error'));

      const response = await request(app)
        .put('/bankaccount/1')
        .send(payload)
        .set('user', JSON.stringify(mockUser));

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Update error');
    });
  });

  describe('getMerchantBank', () => {
    it('should return bank accounts for merchant role', async () => {
      const mockData = [{ id: '1', nick_name: 'Bank1' }];
      getMerchantBankDao.mockResolvedValue(mockData);
      const merchantUser = { ...mockUser, role: Role.MERCHANT };

      const response = await request(app)
        .get('/merchant/bank')
        .set('user', JSON.stringify(merchantUser));

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: mockData,
        message: 'Bank details fetched successfully',
      });
      expect(getMerchantBankDao).toHaveBeenCalledWith(
        { company_id: merchantUser.company_id, user_id: merchantUser.user_id },
        null,
        null,
        null,
        null,
        merchantColumns.BANK_ACCOUNT
      );
    });

    it('should return bank accounts for vendor role', async () => {
      const mockData = [{ id: '1', nick_name: 'Bank1' }];
      getMerchantBankDao.mockResolvedValue(mockData);
      const vendorUser = { ...mockUser, role: Role.VENDOR };

      const response = await request(app)
        .get('/merchant/bank')
        .set('user', JSON.stringify(vendorUser));

      expect(response.status).toBe(200);
      expect(getMerchantBankDao).toHaveBeenCalledWith(
        { company_id: vendorUser.company_id, user_id: vendorUser.user_id },
        null,
        null,
        null,
        null,
        vendorColumns.BANK_ACCOUNT
      );
    });

    it('should return bank accounts for admin role', async () => {
      const mockData = [{ id: '1', nick_name: 'Bank1' }];
      getMerchantBankDao.mockResolvedValue(mockData);

      const response = await request(app)
        .get('/merchant/bank')
        .set('user', JSON.stringify(mockUser));

      expect(response.status).toBe(200);
      expect(getMerchantBankDao).toHaveBeenCalledWith(
        { company_id: mockUser.company_id, user_id: mockUser.user_id },
        null,
        null,
        null,
        null,
        columns.BANK_ACCOUNT
      );
    });

    it('should handle DAO errors', async () => {
      getMerchantBankDao.mockRejectedValue(new Error('DAO error'));

      const response = await request(app)
        .get('/merchant/bank')
        .set('user', JSON.stringify(mockUser));

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('DAO error');
    });
  });

  describe('deleteBankaccount', () => {
    it('should delete bank account successfully', async () => {
      const mockBank = { id: '1' };
      deleteBankaccountService.mockResolvedValue(mockBank);

      const response = await request(app)
        .delete('/bankaccount/1')
        .set('user', JSON.stringify(mockUser));

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: { id: mockBank.id, deleted_by: mockUser.user_name },
        message: 'Deleted Banks Successfully',
      });
      expect(deleteBankaccountService).toHaveBeenCalledWith(
        { id: '1', company_id: mockUser.company_id },
        mockUser.user_id
      );
    });

    it('should throw validation error for invalid ID', async () => {
      const response = await request(app)
        .delete('/bankaccount/invalid')
        .set('user', JSON.stringify(mockUser));

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('ValidationError');
    });

    it('should handle service errors', async () => {
      deleteBankaccountService.mockRejectedValue(new Error('Delete error'));

      const response = await request(app)
        .delete('/bankaccount/1')
        .set('user', JSON.stringify(mockUser));

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Delete error');
    });
  });
});