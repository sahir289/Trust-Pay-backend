import { 
  createChargeBackDao,
  getChargebackByIdDao,
  getChargeBackDao,
  getAllChargeBackDao,
  getChargeBacksBySearchDao,
  updateChargeBackDao,
  deleteChargeBackDao
} from './chargeBackDao';

import * as dbUtils from '../../utils/db.js';
import * as logger from '../../utils/logger.js';
import { Role, tableName } from '../../constants/index.js';

jest.mock('../../utils/db.js', () => ({
  createPool: jest.fn(),
  executeQuery: jest.fn(),
  buildInsertQuery: jest.fn(),
  buildSelectQuery: jest.fn(),
  buildUpdateQuery: jest.fn(),
}));

jest.mock('../../utils/logger.js', () => ({
  logger: { error: jest.fn(), warn: jest.fn() }
}));
jest.mock('../../utils/searchBuilder.js', () => ({
  buildSearchFilterObj: jest.fn()
}));

describe('chargeBackDao', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createChargeBackDao', () => {
    test('should insert a chargeback and return result', async () => {
      const mockSql = 'INSERT ...';
      const mockParams = ['param1'];
      const mockResult = { rows: [{ id: 1 }] };

      dbUtils.buildInsertQuery.mockReturnValue([mockSql, mockParams]);
      dbUtils.executeQuery.mockResolvedValue(mockResult);

      const res = await createChargeBackDao({ amount: 100 });
      expect(res).toEqual({ id: 1 });
      expect(dbUtils.buildInsertQuery).toHaveBeenCalledWith(tableName.CHARGE_BACK, { amount: 100 });
      expect(dbUtils.executeQuery).toHaveBeenCalledWith(mockSql, mockParams);
    });

    test('should log and throw error if insert fails', async () => {
      const err = new Error('DB fail');
      dbUtils.buildInsertQuery.mockReturnValue(['sql', []]);
      dbUtils.executeQuery.mockRejectedValue(err);

      await expect(createChargeBackDao({})).rejects.toThrow('DB fail');
      expect(logger.logger.error).toHaveBeenCalled();
    });
  });

  describe('getChargebackByIdDao', () => {
    test('should build select query and return rows', async () => {
      const mockSql = 'SELECT ...';
      const mockParams = [];
      const mockRows = [{ id: 123 }];

      dbUtils.buildSelectQuery.mockReturnValue([mockSql, mockParams]);
      dbUtils.executeQuery.mockResolvedValue({ rows: mockRows });

      const res = await getChargebackByIdDao({ id: 123 });
      expect(res).toEqual(mockRows);
      expect(dbUtils.buildSelectQuery).toHaveBeenCalled();
      expect(dbUtils.executeQuery).toHaveBeenCalledWith(mockSql, mockParams);
    });

    test('should log and throw error if select fails', async () => {
      dbUtils.buildSelectQuery.mockReturnValue(['sql', []]);
      dbUtils.executeQuery.mockRejectedValue(new Error('fail'));

      await expect(getChargebackByIdDao({})).rejects.toThrow();
      expect(logger.logger.error).toHaveBeenCalled();
    });
  });

  describe('getChargeBackDao', () => {
    test('should return chargebacks for given filters', async () => {
      dbUtils.executeQuery.mockResolvedValue({ rows: [{ id: 1 }] });

      const res = await getChargeBackDao(
        { bank_name: 'HDFC' },
        1, 10, 'id', 'ASC', [],
        Role.ADMIN
      );
      expect(res).toEqual([{ id: 1 }]);
      expect(dbUtils.executeQuery).toHaveBeenCalled();
    });

    test('should handle no page/pageSize', async () => {
      dbUtils.executeQuery.mockResolvedValue({ rows: [] });
      await getChargeBackDao({}, undefined, undefined, 'id', 'ASC', [], Role.ADMIN);
      expect(dbUtils.executeQuery).toHaveBeenCalled();
    });

    test('should log and throw on error', async () => {
      dbUtils.executeQuery.mockRejectedValue(new Error('fail'));
      await expect(
        getChargeBackDao({}, 1, 10, 'id', 'ASC', [], Role.ADMIN)
      ).rejects.toThrow();
      expect(logger.logger.error).toHaveBeenCalled();
    });
  });

  describe('getAllChargeBackDao', () => {
    test('should return all chargebacks', async () => {
      dbUtils.executeQuery.mockResolvedValue({ rows: [{ id: 2 }] });
      const res = await getAllChargeBackDao({}, 1, 10, 'id', 'ASC', [], Role.ADMIN);
      expect(res).toEqual([{ id: 2 }]);
    });

    test('should log and throw error', async () => {
      dbUtils.executeQuery.mockRejectedValue(new Error('fail'));
      await expect(
        getAllChargeBackDao({}, 1, 10, 'id', 'ASC', [], Role.ADMIN)
      ).rejects.toThrow();
      expect(logger.logger.error).toHaveBeenCalled();
    });
  });

  describe('getChargeBacksBySearchDao', () => {
    test('should build search query and return paginated results', async () => {
      dbUtils.executeQuery
        .mockResolvedValueOnce({ rows: [{ count: '1' }] }) 
        .mockResolvedValueOnce({ rows: [{ id: 3 }] }); 

      const res = await getChargeBacksBySearchDao({}, 1, 10, 'id', 'ASC', [], Role.ADMIN, ['test']);
      expect(res.totalCount).toBe(1);
      expect(res.chargeBacks).toEqual([{ id: 3 }]);
    });

    test('should fallback to first page if offset has no results', async () => {
      dbUtils.executeQuery
        .mockResolvedValueOnce({ rows: [{ count: '1' }] }) 
        .mockResolvedValueOnce({ rows: [] }) 
        .mockResolvedValueOnce({ rows: [{ id: 4 }] }); 

      const res = await getChargeBacksBySearchDao({}, 2, 10, 'id', 'ASC', [], Role.ADMIN, []);
      expect(res.chargeBacks).toEqual([{ id: 4 }]);
    });

    test('should log and throw error', async () => {
      dbUtils.executeQuery.mockRejectedValue(new Error('fail'));
      await expect(
        getChargeBacksBySearchDao({}, 1, 10, 'id', 'ASC', [], Role.ADMIN, [])
      ).rejects.toThrow();
      expect(logger.logger.error).toHaveBeenCalled();
    });
  });

  describe('updateChargeBackDao', () => {
    test('should update and return row', async () => {
      dbUtils.buildUpdateQuery.mockReturnValue(['UPDATE ...', ['a']]);
      dbUtils.executeQuery.mockResolvedValue({ rows: [{ id: 5 }] });

      const res = await updateChargeBackDao(5, { amount: 200 });
      expect(res).toEqual({ id: 5 });
    });

    test('should log and throw on error', async () => {
      dbUtils.buildUpdateQuery.mockReturnValue(['sql', []]);
      dbUtils.executeQuery.mockRejectedValue(new Error('fail'));
      await expect(updateChargeBackDao(1, {})).rejects.toThrow();
      expect(logger.logger.error).toHaveBeenCalled();
    });
  });

  describe('deleteChargeBackDao', () => {
    test('should soft delete and return row', async () => {
      dbUtils.buildUpdateQuery.mockReturnValue(['UPDATE ...', ['a']]);
      dbUtils.executeQuery.mockResolvedValue({ rows: [{ id: 6 }] });

      const res = await deleteChargeBackDao(6, { is_obsolete: true });
      expect(res).toEqual({ id: 6 });
    });

    test('should log and throw on error', async () => {
      dbUtils.buildUpdateQuery.mockReturnValue(['sql', []]);
      dbUtils.executeQuery.mockRejectedValue(new Error('fail'));
      await expect(deleteChargeBackDao(1, {})).rejects.toThrow();
      expect(logger.logger.error).toHaveBeenCalled();
    });
  });
});
