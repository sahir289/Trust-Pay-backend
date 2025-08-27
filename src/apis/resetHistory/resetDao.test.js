import {
    getResetHistoryDao,
    getResetHistoryBySearchDao,
    createResetHistoryDao,
    updateResetHistoryDao,
    deleteResetHistoryDao,
  } from './resetDao.js';
  
  import { executeQuery, buildInsertQuery, buildUpdateQuery } from '../../utils/db.js';
  import { logger } from '../../utils/logger.js';
  
  jest.mock('../../utils/db.js');
  jest.mock('../../utils/logger.js', () => ({
    logger: { error: jest.fn() },
  }));
  
  describe('resetDao', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });
  
    // ---------------- getResetHistoryDao ----------------
    test('getResetHistoryDao returns rows', async () => {
      executeQuery.mockResolvedValue({ rows: [{ id: 1 }] });
      const res = await getResetHistoryDao({ company_id: '123' }, 1, 10);
      expect(res).toEqual({ resetHistory: [{ id: 1 }] });
      expect(executeQuery).toHaveBeenCalled();
    });
  
    test('getResetHistoryDao logs error on failure', async () => {
      executeQuery.mockRejectedValue(new Error('fail'));
      await expect(getResetHistoryDao({})).rejects.toThrow('fail');
      expect(logger.error).toHaveBeenCalled();
    });
  
    // ---------------- getResetHistoryBySearchDao ----------------
    test('getResetHistoryBySearchDao returns rows and total count', async () => {
      executeQuery
        .mockResolvedValueOnce({ rows: [{ total: '2' }] }) // count query
        .mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }] }); // search query
  
      const res = await getResetHistoryBySearchDao('123', ['term'], 10, 0);
      expect(res.resetHistory.length).toBe(2);
      expect(res.totalCount).toBe(2);
      expect(res.totalPages).toBe(1);
    });
  
    test('getResetHistoryBySearchDao logs error on failure', async () => {
      executeQuery.mockRejectedValue(new Error('fail'));
      await expect(getResetHistoryBySearchDao('123', [], 10, 0)).rejects.toThrow('fail');
      expect(logger.error).toHaveBeenCalled();
    });
  
    // ---------------- createResetHistoryDao ----------------
    test('createResetHistoryDao uses conn if provided', async () => {
      const payload = { ResetHistoryName: 'Test' };
      const mockConn = { query: jest.fn().mockResolvedValue({ rows: [{ id: 1 }] }) };
      buildInsertQuery.mockReturnValue(['SQL', []]);
  
      const res = await createResetHistoryDao(payload, mockConn);
      expect(res).toEqual({ id: 1 });
      expect(mockConn.query).toHaveBeenCalled();
    });
  
    test('createResetHistoryDao uses executeQuery if no conn', async () => {
      const payload = { ResetHistoryName: 'Test' };
      buildInsertQuery.mockReturnValue(['SQL', []]);
      executeQuery.mockResolvedValue({ rows: [{ id: 1 }] });
  
      const res = await createResetHistoryDao(payload);
      expect(res).toEqual({ id: 1 });
      expect(executeQuery).toHaveBeenCalled();
    });
  
    test('createResetHistoryDao logs error on failure', async () => {
      buildInsertQuery.mockImplementation(() => { throw new Error('fail'); });
      await expect(createResetHistoryDao({})).rejects.toThrow('fail');
      expect(logger.error).toHaveBeenCalled();
    });
  
    // ---------------- updateResetHistoryDao ----------------
    test('updateResetHistoryDao returns row', async () => {
      buildUpdateQuery.mockReturnValue(['SQL', []]);
      executeQuery.mockResolvedValue({ rows: [{ id: 1 }] });
  
      const res = await updateResetHistoryDao('1', { name: 'Updated' });
      expect(res).toEqual({ id: 1 });
      expect(executeQuery).toHaveBeenCalled();
    });
  
    test('updateResetHistoryDao logs error on failure', async () => {
      buildUpdateQuery.mockReturnValue(['SQL', []]);
      executeQuery.mockRejectedValue(new Error('fail'));
  
      await expect(updateResetHistoryDao('1', {})).rejects.toThrow('fail');
      expect(logger.error).toHaveBeenCalled();
    });
  
    // ---------------- deleteResetHistoryDao ----------------
    test('deleteResetHistoryDao returns row', async () => {
      buildUpdateQuery.mockReturnValue(['SQL', []]);
      executeQuery.mockResolvedValue({ rows: [{ id: 1 }] });
  
      const res = await deleteResetHistoryDao('1', { is_obsolete: true });
      expect(res).toEqual({ id: 1 });
      expect(executeQuery).toHaveBeenCalled();
    });
  
    test('deleteResetHistoryDao logs error on failure', async () => {
      buildUpdateQuery.mockReturnValue(['SQL', []]);
      executeQuery.mockRejectedValue(new Error('fail'));
  
      await expect(deleteResetHistoryDao('1', {})).rejects.toThrow('fail');
      expect(logger.error).toHaveBeenCalled();
    });
  });
  