import {
    getBankaccountDao,
    getAllBankaccountDao,
    getBankAccountsBySearchDao,
    getMerchantBankDao,
    getBankByIdDao,
    createBankaccountDao,
    getBankAccountDaoNickName,
    updateBankaccountDao,
    deleteBankaccountDao,
    updateBanktBalanceDao,
  } from './bankAccountDao.js';
  
  jest.mock('../../utils/db.js');
  jest.mock('../../utils/logger.js');
  jest.mock('../../constants/index.js');
  
  const mockDb = require('../../utils/db.js');
  const mockLogger = require('../../utils/logger.js');
  const mockConstants = require('../../constants/index.js');
  
  mockConstants.Role = {
    ADMIN: 'Admin',
    OPERATIONS: 'Operations',
    TRANSACTIONS: 'Transactions',
  };
  mockConstants.tableName = {
    BANK_ACCOUNT: 'BankAccount',
  };
  
  describe('BankAccount DAO Tests', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      mockDb.executeQuery.mockResolvedValue({ rows: [] });
      mockLogger.error = jest.fn();
    });
  
    describe('getBankaccountDao', () => {
      it('should fetch bank accounts with no filters, no pagination, role MERCHANT', async () => {
        mockDb.executeQuery.mockResolvedValue({ rows: [{ id: 1 }] });
        const result = await getBankaccountDao({}, null, null, 'MERCHANT', 'Any');
        expect(result).toEqual([{ id: 1 }]);
        expect(mockDb.executeQuery).toHaveBeenCalledWith(expect.stringContaining('ba.is_obsolete = false'), expect.arrayContaining([]));
        expect(mockDb.executeQuery).toHaveBeenCalledWith(expect.not.stringContaining('commissionSelect'), []);
      });
  
      it('should handle pagination', async () => {
        mockDb.executeQuery.mockResolvedValue({ rows: [{ id: 1 }] });
        await getBankaccountDao({}, 2, 10, 'MERCHANT', 'Any');
        expect(mockDb.executeQuery).toHaveBeenCalledWith(expect.stringContaining('LIMIT $1 OFFSET $2'), [10, 10]);
      });
  
      it('should handle date range filter', async () => {
        mockDb.executeQuery.mockResolvedValue({ rows: [{ id: 1 }] });
        await getBankaccountDao({ startDate: '2023-01-01', endDate: '2023-12-31' }, null, null, 'MERCHANT', 'Any');
        expect(mockDb.executeQuery).toHaveBeenCalledWith(expect.stringContaining('ba.created_at BETWEEN $1 AND $2'), ['2023-01-01', '2023-12-31']);
      });
  
      it('should handle bank_used_for filter', async () => {
        mockDb.executeQuery.mockResolvedValue({ rows: [{ id: 1 }] });
        await getBankaccountDao({ bank_used_for: 'PayIn' }, null, null, 'MERCHANT', 'Any');
        expect(mockDb.executeQuery).toHaveBeenCalledWith(expect.stringContaining('ba.bank_used_for = $1'), ['PayIn']);
      });
  
      it('should handle nick_name filter', async () => {
        mockDb.executeQuery.mockResolvedValue({ rows: [{ id: 1 }] });
        await getBankaccountDao({ nick_name: 'TestNick' }, null, null, 'MERCHANT', 'Any');
        expect(mockDb.executeQuery).toHaveBeenCalledWith(expect.stringContaining('ba.nick_name= $1'), ['TestNick']);
      });
  
      it('should handle merchant_id filter', async () => {
        mockDb.executeQuery.mockResolvedValue({ rows: [{ id: 1 }] });
        await getBankaccountDao({ merchant_id: ['123'] }, null, null, 'MERCHANT', 'Any');
        expect(mockDb.executeQuery).toHaveBeenCalledWith(expect.stringContaining("(ba.config->'merchants')::jsonb ?| $1::text[]"), [['123']]);
      });
  
      it('should handle other scalar filters', async () => {
        mockDb.executeQuery.mockResolvedValue({ rows: [{ id: 1 }] });
        await getBankaccountDao({ some_key: 'value' }, null, null, 'MERCHANT', 'Any');
        expect(mockDb.executeQuery).toHaveBeenCalledWith(expect.stringContaining('ba."some_key" = $1'), ['value']);
      });
  
      it('should handle other array filters', async () => {
        mockDb.executeQuery.mockResolvedValue({ rows: [{ id: 1 }] });
        await getBankaccountDao({ some_key: ['val1', 'val2'] }, null, null, 'MERCHANT', 'Any');
        expect(mockDb.executeQuery).toHaveBeenCalledWith(expect.stringContaining('ba."some_key" = ANY($1)'), [['val1', 'val2']]);
      });
  
      it('should select fields for VENDOR role', async () => {
        mockDb.executeQuery.mockResolvedValue({ rows: [{ id: 1 }] });
        await getBankaccountDao({}, null, null, 'VENDOR', 'Any');
        expect(mockDb.executeQuery).toHaveBeenCalledWith(expect.stringContaining('ba.ifsc AS ifsc_code'), expect.any(Array));
      });
  
      it('should select fields for other role with ADMIN designation', async () => {
        mockDb.executeQuery.mockResolvedValue({ rows: [{ id: 1 }] });
        await getBankaccountDao({}, null, null, 'OTHER', 'Admin');
        expect(mockDb.executeQuery).toHaveBeenCalledWith(expect.stringContaining('COALESCE(m.merchant_details'), expect.any(Array));
      });
  
      it('should select fields for other role without special designation', async () => {
        mockDb.executeQuery.mockResolvedValue({ rows: [{ id: 1 }] });
        await getBankaccountDao({}, null, null, 'OTHER', 'User');
        expect(mockDb.executeQuery).not.toHaveBeenCalledWith(expect.stringContaining('COALESCE(m.merchant_details'), expect.any(Array));
      });
  
      it('should handle error', async () => {
        const error = new Error('DB error');
        mockDb.executeQuery.mockRejectedValue(error);
        await expect(getBankaccountDao({}, null, null, 'MERCHANT', 'Any')).rejects.toThrow('DB error');
      });
    });
  
    describe('getAllBankaccountDao', () => {
      it('should fetch all bank accounts with no filters, role MERCHANT', async () => {
        mockDb.executeQuery.mockResolvedValue({ rows: [{ id: 1 }] });
        const result = await getAllBankaccountDao({}, null, null, 'MERCHANT', 'Any');
        expect(result).toEqual([{ id: 1 }]);
        expect(mockDb.executeQuery).toHaveBeenCalledWith(expect.stringContaining('ba.is_obsolete = false'), expect.arrayContaining([]));
      });
  
      it('should select fields for VENDOR role', async () => {
        mockDb.executeQuery.mockResolvedValue({ rows: [{ id: 1 }] });
        await getAllBankaccountDao({}, null, null, 'VENDOR', 'Any');
        expect(mockDb.executeQuery).toHaveBeenCalledWith(expect.stringContaining('ba.is_enabled'), expect.any(Array));
      });
  
      it('should select fields for other role with ADMIN designation', async () => {
        mockDb.executeQuery.mockResolvedValue({ rows: [{ id: 1 }] });
        await getAllBankaccountDao({}, null, null, 'OTHER', 'Admin');
        expect(mockDb.executeQuery).toHaveBeenCalledWith(expect.stringContaining('ba.is_qr'), expect.any(Array));
        expect(mockDb.executeQuery).toHaveBeenCalledWith(expect.stringContaining('COALESCE(m.merchant_details'), expect.any(Array));
      });
  
      it('should handle error', async () => {
        const error = new Error('DB error');
        mockDb.executeQuery.mockRejectedValue(error);
        await expect(getAllBankaccountDao({}, null, null, 'MERCHANT', 'Any')).rejects.toThrow('DB error');
      });
    });
  
    describe('getBankAccountsBySearchDao', () => {
      it('should fetch with no filters, no searchTerms, role MERCHANT', async () => {
        mockDb.executeQuery.mockResolvedValueOnce({ rows: [{ total: '5' }] }).mockResolvedValueOnce({ rows: [{ id: 1 }] });
        const result = await getBankAccountsBySearchDao({}, null, null, 'MERCHANT', 'Any', []);
        expect(result).toEqual({ totalCount: 5, totalPages: 1, banks: [{ id: 1 }] });
        expect(mockDb.executeQuery).toHaveBeenCalledTimes(2);
      });
  
      it('should handle searchTerms with boolean true', async () => {
        mockDb.executeQuery.mockResolvedValueOnce({ rows: [{ total: '1' }] }).mockResolvedValueOnce({ rows: [{ id: 1 }] });
        await getBankAccountsBySearchDao({}, null, null, 'MERCHANT', 'Any', ['true']);
        expect(mockDb.executeQuery).toHaveBeenCalledWith(expect.stringContaining('ba.is_enabled = $1'), [true]);
      });
  
      it('should handle searchTerms with LIKE', async () => {
        mockDb.executeQuery.mockResolvedValueOnce({ rows: [{ total: '1' }] }).mockResolvedValueOnce({ rows: [{ id: 1 }] });
        await getBankAccountsBySearchDao({}, null, null, 'MERCHANT', 'Any', ['test']);
        expect(mockDb.executeQuery).toHaveBeenCalledWith(expect.stringContaining('LOWER(ba.id::text) LIKE LOWER($1)'), ['%test%']);
      });
  
      it('should reset offset if no results on higher page', async () => {
        mockDb.executeQuery
          .mockResolvedValueOnce({ rows: [{ total: '5' }] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ id: 1 }] });
        const result = await getBankAccountsBySearchDao({}, 2, 10, 'MERCHANT', 'Any', []);
        expect(result.banks).toEqual([{ id: 1 }]);
        expect(mockDb.executeQuery).toHaveBeenCalledTimes(3);
      });
  
      it('should select fields for VENDOR role with is_freezed', async () => {
        mockDb.executeQuery.mockResolvedValueOnce({ rows: [{ total: '1' }] }).mockResolvedValueOnce({ rows: [{ id: 1 }] });
        await getBankAccountsBySearchDao({}, null, null, 'VENDOR', 'Any', []);
        expect(mockDb.executeQuery).toHaveBeenCalledWith(expect.stringContaining("(ba.config->>'is_freeze')::boolean AS is_freezed"), expect.any(Array));
      });
  
      it('should handle error', async () => {
        const error = new Error('DB error');
        mockDb.executeQuery.mockRejectedValue(error);
        await expect(getBankAccountsBySearchDao({}, null, null, 'MERCHANT', 'Any', [])).rejects.toThrow('DB error');
      });
    });
  
    describe('getMerchantBankDao', () => {
      it('should fetch merchant banks with filters', async () => {
        mockDb.buildSelectQuery.mockReturnValue(['SELECT * FROM "BankAccount" WHERE id = $1', [1]]);
        mockDb.executeQuery.mockResolvedValue({ rows: [{ id: 1 }] });
        const result = await getMerchantBankDao({ id: 1 });
        expect(result).toEqual([{ id: 1 }]);
        expect(mockDb.buildSelectQuery).toHaveBeenCalledWith(expect.stringContaining('SELECT * FROM  "BankAccount" WHERE 1=1'), { id: 1 });
      });
  
      it('should handle error', async () => {
        const error = new Error('DB error');
        mockDb.buildSelectQuery.mockReturnValue(['query', []]);
        mockDb.executeQuery.mockRejectedValue(error);
        await expect(getMerchantBankDao({})).rejects.toThrow('DB error');
      });
    });
  
    describe('getBankByIdDao', () => {
      it('should fetch bank by id with specific fields', async () => {
        mockDb.buildSelectQuery.mockReturnValue(['SELECT min, max, is_enabled, payin_count, balance, today_balance, user_id, id FROM "BankAccount" WHERE id = $1', [1]]);
        mockDb.executeQuery.mockResolvedValue({ rows: [{ min: 100 }] });
        const result = await getBankByIdDao({ id: 1 });
        expect(result).toEqual([{ min: 100 }]);
        const calledQuery = mockDb.buildSelectQuery.mock.calls[0][0].replace(/\s+/g, ' ').trim();
        expect(calledQuery).toContain('SELECT min, max, is_enabled, payin_count, balance,today_balance, user_id ,id FROM "BankAccount" WHERE 1=1');
        });
  
      it('should handle error', async () => {
        const error = new Error('DB error');
        mockDb.buildSelectQuery.mockReturnValue(['query', []]);
        mockDb.executeQuery.mockRejectedValue(error);
        await expect(getBankByIdDao({})).rejects.toThrow('DB error');
      });
    });
  
    describe('createBankaccountDao', () => {
      it('should create bank account', async () => {
        mockDb.buildInsertQuery.mockReturnValue(['INSERT INTO "BankAccount" ...', [{ nick_name: 'Test' }]]);
        mockDb.executeQuery.mockResolvedValue({ rows: [{ id: 1 }] });
        const result = await createBankaccountDao({ nick_name: 'Test' });
        expect(result).toEqual({ id: 1 });
      });
  
      it('should handle error', async () => {
        const error = new Error('DB error');
        mockDb.buildInsertQuery.mockReturnValue(['query', []]);
        mockDb.executeQuery.mockRejectedValue(error);
        await expect(createBankaccountDao({})).rejects.toThrow('DB error');
      });
    });
  
    describe('getBankAccountDaoNickName', () => {
      it('should fetch nicknames for PayIn type', async () => {
        const mockConn = { query: jest.fn().mockResolvedValue({ rowCount: 1, rows: [{ label: 'Test' }] }) };
        const result = await getBankAccountDaoNickName(mockConn, 1, 'PayIn');
        expect(result).toEqual({ totalCount: 1, bankNames: [{ label: 'Test' }] });
        expect(mockConn.query).toHaveBeenCalledWith(expect.stringContaining('bank_used_for = $2'), [1, 'PayIn']);
        expect(mockConn.query).toHaveBeenCalledWith(expect.not.stringContaining('is_enabled = true'), expect.any(Array));
      });
  
      it('should add is_enabled for non-PayIn type', async () => {
        const mockConn = { query: jest.fn().mockResolvedValue({ rowCount: 0, rows: [] }) };
        await getBankAccountDaoNickName(mockConn, 1, 'Other');
        expect(mockConn.query).toHaveBeenCalledWith(expect.stringContaining('is_enabled = true'), [1, 'Other']);
      });
  
      it('should handle filters with scalar', async () => {
        const mockConn = { query: jest.fn().mockResolvedValue({ rowCount: 0, rows: [] }) };
        await getBankAccountDaoNickName(mockConn, 1, 'PayIn', { some_key: 'val' });
        expect(mockConn.query).toHaveBeenCalledWith(expect.stringContaining('"some_key" = $3'), [1, 'PayIn', 'val']);
      });
  
      it('should handle filters with array (take first)', async () => {
        const mockConn = { query: jest.fn().mockResolvedValue({ rowCount: 0, rows: [] }) };
        await getBankAccountDaoNickName(mockConn, 1, 'PayIn', { some_key: ['val1', 'val2'] });
        expect(mockConn.query).toHaveBeenCalledWith(expect.stringContaining('"some_key" = $3'), [1, 'PayIn', 'val1']);
      });
  
      it('should handle error', async () => {
        const error = new Error('DB error');
        const mockConn = { query: jest.fn().mockRejectedValue(error) };
        await expect(getBankAccountDaoNickName(mockConn, 1, 'PayIn')).rejects.toThrow('DB error');
      });
    });
  
    describe('updateBankaccountDao', () => {
      it('should update with config merge for merchant_added', async () => {
        mockDb.executeQuery.mockResolvedValueOnce({ rows: [{ config: { merchant_added: { old: 'data' } } }] });
        mockDb.buildAndExecuteUpdateQuery.mockResolvedValue({ rows: [{ id: 1 }] });
        const result = await updateBankaccountDao({ id: 1, company_id: 1 }, { config: { merchant_added: { new: 'data' } } }, null, false);
        expect(mockDb.buildAndExecuteUpdateQuery).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ config: { merchant_added: { old: 'data', new: 'data' } } }), expect.any(Object), expect.any(Object), expect.any(Object), null);
        expect(result).toEqual({ rows: [{ id: 1 }] });
      });
  
      it('should handle isParentDeleted with conn.query', async () => {
        const mockConn = { query: jest.fn().mockResolvedValue({ rows: [{ id: 1 }] }) };
        mockDb.executeQuery.mockResolvedValueOnce({ rows: [{ config: {} }] });
        mockDb.buildUpdateQuery.mockReturnValue(['UPDATE ...', []]);
        await updateBankaccountDao({ id: 1, company_id: 1 }, { some: 'update' }, mockConn, true);
        expect(mockConn.query).toHaveBeenCalledWith('UPDATE ...', []);
      });
  
      it('should handle error', async () => {
        const error = new Error('DB error');
        mockDb.executeQuery.mockResolvedValueOnce({ rows: [{ config: {} }] });
        mockDb.buildAndExecuteUpdateQuery.mockRejectedValue(error);
        await expect(updateBankaccountDao({ id: 1, company_id: 1 }, {}, null, false)).rejects.toThrow('DB error');
      });
    });
  
    describe('deleteBankaccountDao', () => {
      it('should delete (update) with conn', async () => {
        const mockConn = { query: jest.fn().mockResolvedValue({ rows: [{ id: 1 }] }) };
        mockDb.buildUpdateQuery.mockReturnValue(['UPDATE ...', [1]]);
        const result = await deleteBankaccountDao(mockConn, { id: 1 }, { is_obsolete: true });
        expect(result).toEqual({ id: 1 });
        expect(mockConn.query).toHaveBeenCalled();
      });
  
      it('should delete without conn using executeQuery', async () => {
        mockDb.buildUpdateQuery.mockReturnValue(['UPDATE ...', [1]]);
        mockDb.executeQuery.mockResolvedValue({ rows: [{ id: 1 }] });
        const result = await deleteBankaccountDao(null, { id: 1 }, { is_obsolete: true });
        expect(result).toEqual({ id: 1 });
        expect(mockDb.executeQuery).toHaveBeenCalled();
      });
  
      it('should handle error', async () => {
        const error = new Error('DB error');
        mockDb.buildUpdateQuery.mockReturnValue(['query', []]);
        mockDb.executeQuery.mockRejectedValue(error);
        await expect(deleteBankaccountDao(null, { id: 1 }, {})).rejects.toThrow('DB error');
      });
    });
  
    describe('updateBanktBalanceDao', () => {
      it('should update balance with conn', async () => {
        const mockConn = { query: jest.fn().mockResolvedValue({ rows: [{ balance: 100 }] }) };
        mockDb.buildUpdateQuery.mockReturnValue(['UPDATE ... balance = balance + $1', [50]]);
        const result = await updateBanktBalanceDao({ id: 1 }, 50, 2, mockConn);
        expect(result).toEqual({ balance: 100 });
        expect(mockDb.buildUpdateQuery).toHaveBeenCalledWith('BankAccount', { balance: 50, today_balance: 50, updated_by: 2 }, { id: 1 }, { balance: '+', today_balance: '+' });
      });
  
    //   it('should update without conn', async () => {
    //     const mockConn = { query: jest.fn().mockResolvedValue({ rows: [{ balance: 100 }] }) };
    //     mockDb.buildUpdateQuery.mockReturnValue([
    //       'UPDATE "BankAccount" SET balance = balance + $1, today_balance = today_balance + $2, updated_by = $3 WHERE id = $4 RETURNING balance',
    //       [50, 50, 'user_1', 1]
    //     ]);
    //     mockDb.executeQuery.mockResolvedValue({ rows: [{ balance: 100 }] });
    //     const result = await updateBanktBalanceDao({ id: 1 }, 50, 'user_1', mockConn);
    //     console.log(result, 'result___')
    //     expect(result).toEqual({ balance: 100 });
    //     expect(mockDb.buildUpdateQuery).toHaveBeenCalledWith('BankAccount', { balance: 50, today_balance: 50, updated_by: 2 }, { id: 1 }, { balance: '+', today_balance: '+' });
    //   });
  
      it('should handle error', async () => {
        const error = new Error('DB error');
        mockDb.buildUpdateQuery.mockReturnValue(['query', []]);
        mockDb.executeQuery.mockRejectedValue(error);
        await expect(updateBanktBalanceDao({ id: 1 }, 0, 1, null)).rejects.toThrow('DB error');
      });
    });
  });