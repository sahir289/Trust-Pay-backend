const {
    getCalculationDao,
    getCalculationsSumDao,
    getCalculationforCronDao,
    getAllCalculationforCronDao,
    checkTodayCalculationExistsDao,
    createCalculationDao,
    updateCalculationDao,
    updateCalculationConfigDao,
    deleteCalculationDao,
    updateCalculationBalanceDao,
    checkCalculationEntryForDateDao,
  } = require('./calculationDao');
  const { executeQuery } = require('../../utils/db');
  const { getUserHierarchysDao } = require('../userHierarchy/userHierarchyDao');
  const { Role } = require('../../constants/index');
  const { NotFoundError } = require('../../utils/appErrors');
  const { logger } = require('../../utils/logger');
  const dayjs = require('dayjs');
  const timezone = require('dayjs/plugin/timezone');
  dayjs.extend(timezone);
  
  // Mock dependencies
  jest.mock('../../utils/db');
  jest.mock('../userHierarchy/userHierarchyDao');
  jest.mock('../../utils/logger');
  
  describe('Calculation DAO', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });
  
    describe('getCalculationDao', () => {
      test('should fetch calculations for SUPER_ADMIN role', async () => {
        const filters = { role: Role.SUPER_ADMIN, startDate: '2025-01-01', endDate: '2025-01-31' };
        const page = 1;
        const pageSize = 10;
        const sortBy = 'created_at';
        const sortOrder = 'DESC';
        const columns = ['id', 'user_id', 'total_payin_amount'];
  
        executeQuery.mockResolvedValue({ rows: [{ id: 1, user_id: 'user1', total_payin_amount: 1000 }] });
  
        const result = await getCalculationDao(filters, page, pageSize, sortBy, sortOrder, columns);
  
        expect(executeQuery).toHaveBeenCalledWith(
          expect.stringContaining('SELECT id, user_id, total_payin_amount FROM "Calculation" WHERE 1=1'),
          expect.any(Array)
        );
        expect(result).toEqual([{ id: 1, user_id: 'user1', total_payin_amount: 1000 }]);
      });
  
      test('should handle MERCHANT_ADMIN with sub-merchants', async () => {
        const filters = {
          role: Role.MERCHANT_ADMIN,
          designation: Role.MERCHANT_ADMIN,
          user_id: 'merchant1',
          includeSubMerchant: true,
          users: 'sub1,sub2',
        };
        getUserHierarchysDao.mockResolvedValue({ config: { merchant1: ['sub1'] } });
        executeQuery.mockResolvedValue({ rows: [{ id: 1, user_id: 'sub1' }] });
  
        const result = await getCalculationDao(filters, 1, 10, 'created_at', 'DESC');
  
        expect(getUserHierarchysDao).toHaveBeenCalledWith({ user_id: 'merchant1' });
        expect(executeQuery).toHaveBeenCalled();
        expect(result).toEqual([{ id: 1, user_id: 'sub1' }]);
      });
  
      test('should throw NotFoundError when no hierarchy found for MERCHANT_ADMIN', async () => {
        const filters = {
          role: Role.MERCHANT_ADMIN,
          designation: Role.MERCHANT_ADMIN,
          user_id: 'merchant1',
          includeSubMerchant: true,
        };
        getUserHierarchysDao.mockResolvedValue(null);
  
        await expect(getCalculationDao(filters, 1, 10, 'created_at', 'DESC')).rejects.toThrow(NotFoundError);
      });
  
      test('should handle date filters correctly', async () => {
        const filters = { startDate: '2025-01-01', endDate: '2025-01-31' };
        executeQuery.mockResolvedValue({ rows: [] });
  
        await getCalculationDao(filters, 1, 10, 'created_at', 'DESC');
  
        expect(executeQuery).toHaveBeenCalledWith(
          expect.stringContaining("AND created_at BETWEEN '2025-01-01T00:00:00.000Z'::TIMESTAMPTZ AND '2025-01-31T00:00:00.000Z'::TIMESTAMPTZ"),
          expect.any(Array)
        );
      });
  
      test('should log and throw error on failure', async () => {
        const filters = { role: Role.ADMIN };
        executeQuery.mockRejectedValue(new Error('Database error'));
  
        await expect(getCalculationDao(filters, 1, 10, 'created_at', 'DESC')).rejects.toThrow('Database error');
        expect(logger.error).toHaveBeenCalledWith('Error fetching Calculation', expect.any(Error));
      });
    });
  
    describe('getCalculationsSumDao', () => {
      test('should fetch sum for SUPER_ADMIN role', async () => {
        const filters = { role: Role.SUPER_ADMIN, startDate: '2025-01-01', endDate: '2025-01-31' };
        executeQuery
          .mockResolvedValueOnce({ rows: [{ date: '2025-01-01', total_payin_count: 10 }] }) // Merchant query
          .mockResolvedValueOnce({ rows: [{ date: '2025-01-01', total_payin_count: 5 }] }) // Vendor query
          .mockResolvedValueOnce({ rows: [{ role: Role.MERCHANT, net_balance_sum: 1000 }, { role: Role.VENDOR, net_balance_sum: 500 }] }); // Balance query
  
        const result = await getCalculationsSumDao(filters);
  
        expect(executeQuery).toHaveBeenCalledTimes(3);
        expect(result).toEqual({
          vendor: [{ date: '2025-01-01', total_payin_count: 5 }],
          merchant: [{ date: '2025-01-01', total_payin_count: 10 }],
          netBalance: { vendor: 500, merchant: 1000 },
          merchantTotalCalculations: expect.any(Object),
          vendorTotalCalculations: expect.any(Object),
        });
      });
  
      test('should handle MERCHANT role with sub-merchants', async () => {
        const filters = { role: Role.MERCHANT, user_id: 'merchant1', company_id: 'company1', users: 'sub1,sub2' };
        getUserHierarchysDao.mockResolvedValue({ 0: { config: { siblings: { sub_merchants: ['sub1'] } } } });
        executeQuery
          .mockResolvedValueOnce({ rows: [{ date: '2025-01-01', total_payin_count: 10 }] }) // Merchant query
          .mockResolvedValueOnce({ rows: [{ net_balance_sum: 1000 }] }) // Merchant balance query
          .mockResolvedValueOnce({ rows: [{ net_balance_sum: 0 }] }) // Vendor balance query
          .mockResolvedValueOnce({ rows: [{ total_payin_count: 10 }] }); // Merchant total query
  
        const result = await getCalculationsSumDao(filters);
  
        expect(getUserHierarchysDao).toHaveBeenCalledWith({ user_id: 'merchant1' });
        expect(result.merchant).toEqual([{ date: '2025-01-01', total_payin_count: 10 }]);
        expect(result.vendor).toEqual([]);
        expect(result.netBalance.merchant).toBe(1000);
      });
  
      test('should log and throw error on failure', async () => {
        const filters = { role: Role.ADMIN, company_id: 'company1' };
        executeQuery.mockRejectedValue(new Error('Database error'));
  
        await expect(getCalculationsSumDao(filters)).rejects.toThrow('Database error');
        expect(logger.error).toHaveBeenCalledWith('Error getting calculation data:', expect.any(Error));
      });
    });
  
    describe('getCalculationforCronDao', () => {
      test('should fetch latest calculation for user', async () => {
        const userId = 'user1';
        executeQuery.mockResolvedValue({ rows: [{ id: 1, user_id: 'user1' }] });
  
        const result = await getCalculationforCronDao(userId);
  
        expect(executeQuery).toHaveBeenCalledWith(
          expect.stringContaining('SELECT * FROM public."Calculation" WHERE is_obsolete = false AND user_id = $1'),
          ['user1']
        );
        expect(result).toEqual([{ id: 1, user_id: 'user1' }]);
      });
  
      test('should log and throw error on failure', async () => {
        executeQuery.mockRejectedValue(new Error('Database error'));
  
        await expect(getCalculationforCronDao('user1')).rejects.toThrow('Database error');
        expect(logger.error).toHaveBeenCalledWith('Error fetching Calculation', expect.any(Error));
      });
    });
  
    describe('getAllCalculationforCronDao', () => {
      test('should fetch all calculations for user', async () => {
        const userId = 'user1';
        executeQuery.mockResolvedValue({ rows: [{ id: 1 }, { id: 2 }] });
  
        const result = await getAllCalculationforCronDao(userId);
  
        expect(executeQuery).toHaveBeenCalledWith(
          expect.stringContaining('SELECT * FROM public."Calculation" WHERE is_obsolete = false AND user_id = $1'),
          ['user1']
        );
        expect(result).toEqual([{ id: 1 }, { id: 2 }]);
      });
  
      test('should log and throw error on failure', async () => {
        executeQuery.mockRejectedValue(new Error('Database error'));
  
        await expect(getAllCalculationforCronDao('user1')).rejects.toThrow('Database error');
        expect(logger.error).toHaveBeenCalledWith('Error fetching Calculation', expect.any(Error));
      });
    });
  
    describe('checkTodayCalculationExistsDao', () => {
      test('should return true if calculation exists for today', async () => {
        executeQuery.mockResolvedValue({ rows: [{ count: '1' }] });
  
        const result = await checkTodayCalculationExistsDao();
  
        expect(executeQuery).toHaveBeenCalledWith(
          expect.stringContaining("SELECT COUNT(*) as count FROM public.\"Calculation\" WHERE is_obsolete = false AND DATE(created_at) = $1"),
          [expect.any(String)]
        );
        expect(result).toBe(true);
      });
  
      test('should return false if no calculation exists for today', async () => {
        executeQuery.mockResolvedValue({ rows: [{ count: '0' }] });
  
        const result = await checkTodayCalculationExistsDao();
  
        expect(result).toBe(false);
      });
  
      test('should log and throw error on failure', async () => {
        executeQuery.mockRejectedValue(new Error('Database error'));
  
        await expect(checkTodayCalculationExistsDao()).rejects.toThrow('Database error');
        expect(logger.error).toHaveBeenCalledWith('Error checking today calculation exists:', expect.any(Error));
      });
    });
  
    describe('createCalculationDao', () => {
      test('should create calculation with connection', async () => {
        const conn = { query: jest.fn().mockResolvedValue({ rows: [{ id: 1 }] }) };
        const data = { user_id: 'user1', total_payin_amount: 1000 };
  
        const result = await createCalculationDao(conn, data);
  
        expect(conn.query).toHaveBeenCalledWith(expect.any(String), expect.any(Array));
        expect(result).toEqual({ id: 1 });
      });
  
      test('should create calculation without connection', async () => {
        executeQuery.mockResolvedValue({ rows: [{ id: 1 }] });
        const data = { user_id: 'user1', total_payin_amount: 1000 };
  
        const result = await createCalculationDao(null, data);
  
        expect(executeQuery).toHaveBeenCalledWith(expect.any(String), expect.any(Array));
        expect(result).toEqual({ id: 1 });
      });
  
      test('should log and throw error on failure', async () => {
        executeQuery.mockRejectedValue(new Error('Database error'));
  
        await expect(createCalculationDao(null, { user_id: 'user1' })).rejects.toThrow('Database error');
        expect(logger.error).toHaveBeenCalledWith('Error creating calculation:', expect.any(Error));
      });
    });
  
    describe('updateCalculationDao', () => {
      test('should update calculation with connection', async () => {
        const conn = { query: jest.fn().mockResolvedValue({ rows: [{ id: 1 }] }) };
        const data = { total_payin_amount: 2000 };
        const id = 'calc1';
  
        const result = await updateCalculationDao(id, data, conn);
  
        expect(conn.query).toHaveBeenCalledWith(expect.any(String), expect.any(Array));
        expect(result).toEqual({ id: 1 });
      });
  
      test('should update calculation without connection', async () => {
        executeQuery.mockResolvedValue({ rows: [{ id: 1 }] });
        const data = { total_payin_amount: 2000 };
        const id = 'calc1';
  
        const result = await updateCalculationDao(id, data, null);
  
        expect(executeQuery).toHaveBeenCalledWith(expect.any(String), expect.any(Array));
        expect(result).toEqual({ id: 1 });
      });
  
      test('should log and throw error on failure', async () => {
        executeQuery.mockRejectedValue(new Error('Database error'));
  
        await expect(updateCalculationDao('calc1', { total_payin_amount: 2000 }, null)).rejects.toThrow('Database error');
        expect(logger.error).toHaveBeenCalledWith('Error updating calculation:', expect.any(Error));
      });
    });
  
    describe('updateCalculationConfigDao', () => {
      test('should update calculation config', async () => {
        const conn = { query: jest.fn().mockResolvedValue({ rows: [{ id: 1 }] }) };
        const data = { config: { some_key: 'value' } };
        const id = 'calc1';
  
        const result = await updateCalculationConfigDao(id, data, conn);
  
        expect(result).toEqual({ id: 1 });
      });
    });
  
    describe('deleteCalculationDao', () => {
      test('should delete calculation with connection', async () => {
        const conn = { query: jest.fn().mockResolvedValue({ rows: [{ id: 1 }] }) };
        const data = { is_obsolete: true };
        const id = 'calc1';
  
        const result = await deleteCalculationDao(conn, id, data);
  
        expect(conn.query).toHaveBeenCalledWith(expect.any(String), expect.any(Array));
        expect(result).toEqual({ id: 1 });
      });
  
      test('should delete calculation without connection', async () => {
        executeQuery.mockResolvedValue({ rows: [{ id: 1 }] });
        const data = { is_obsolete: true };
        const id = 'calc1';
  
        const result = await deleteCalculationDao(null, id, data);
  
        expect(executeQuery).toHaveBeenCalledWith(expect.any(String), expect.any(Array));
        expect(result).toEqual({ id: 1 });
      });
  
      test('should log and throw error on failure', async () => {
        executeQuery.mockRejectedValue(new Error('Database error'));
  
        await expect(deleteCalculationDao(null, 'calc1', { is_obsolete: true })).rejects.toThrow('Database error');
        expect(logger.error).toHaveBeenCalledWith('Error deleting calculation:', expect.any(Error));
      });
    });
  
    describe('updateCalculationBalanceDao', () => {
      test('should update calculation balance', async () => {
        executeQuery.mockResolvedValue({ rows: [{ id: 1, net_balance: 1000 }] });
        const filters = { user_id: 'user1' };
        const data = { net_balance: 500 };
  
        const result = await updateCalculationBalanceDao(filters, data, null);
  
        expect(executeQuery).toHaveBeenCalledWith(expect.any(String), expect.any(Array));
        expect(result).toEqual({ id: 1, net_balance: 1000 });
      });
  
      test('should log and throw error on failure', async () => {
        executeQuery.mockRejectedValue(new Error('Database error'));
  
        await expect(updateCalculationBalanceDao({ user_id: 'user1' }, { net_balance: 500 }, null)).rejects.toThrow('Database error');
        expect(logger.error).toHaveBeenCalledWith('Error updating calculation:', expect.any(Error));
      });
    });
  
    describe('checkCalculationEntryForDateDao', () => {
      test('should return true if calculation exists for date', async () => {
        executeQuery.mockResolvedValue({ rows: [{ 1: 1 }] });
  
        const result = await checkCalculationEntryForDateDao('2025-01-01');
  
        expect(executeQuery).toHaveBeenCalledWith(
          expect.stringContaining("SELECT 1 FROM public.\"Calculation\" WHERE is_obsolete = false AND to_char(created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') = $1"),
          ['2025-01-01']
        );
        expect(result).toBe(true);
      });
  
      test('should return false if no calculation exists for date', async () => {
        executeQuery.mockResolvedValue({ rows: [] });
  
        const result = await checkCalculationEntryForDateDao('2025-01-01');
  
        expect(result).toBe(false);
      });
  
      test('should log and throw error on failure', async () => {
        executeQuery.mockRejectedValue(new Error('Database error'));
  
        await expect(checkCalculationEntryForDateDao('2025-01-01')).rejects.toThrow('Database error');
        expect(logger.error).toHaveBeenCalledWith('Error checking calculation entry for date', expect.any(Error));
      });
    });
  });