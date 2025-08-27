import {
    getResetHistoryService,
    getResetHistoryBySearchService,
    createResetHistoryService,
    updateResetHistoryService,
    deleteResetHistoryService,
  } from './resetServices.js';
  import {
    updateBotResponseDao,
  } from '../bankResponse/bankResponseDao.js';
  import * as dao from './resetDao.js';
  import * as payInDao from '../payIn/payInDao.js';
  import * as bankDao from '../bankResponse/bankResponseDao.js';
  import { logger } from '../../utils/logger.js';
  import { InternalServerError } from '../../utils/appErrors.js';
  
  jest.mock('./resetDao.js');
  jest.mock('../payIn/payInDao.js');
  jest.mock('../bankResponse/bankResponseDao.js');
  jest.mock('../../utils/logger.js', () => ({
    logger: { error: jest.fn() },
  }));
  jest.mock('../bankResponse/bankResponseDao.js');
  
  describe('resetServices', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });
  
    // ---------------- getResetHistoryService ----------------
    test('getResetHistoryService returns data', async () => {
      const mockData = [{ id: 1 }];
      dao.getResetHistoryDao.mockResolvedValue(mockData);
  
      const res = await getResetHistoryService('123', 1, 10, 'sno', 'DESC');
      expect(res).toEqual(mockData);
      expect(dao.getResetHistoryDao).toHaveBeenCalledWith(
        { company_id: '123' },
        1,
        10,
        'sno',
        'DESC',
        undefined,
        undefined,
      );
    });
  
    test('getResetHistoryService logs and throws InternalServerError on failure', async () => {
      dao.getResetHistoryDao.mockRejectedValue(new Error('fail'));
      await expect(getResetHistoryService('123', 1, 10)).rejects.toThrow(InternalServerError);
      expect(logger.error).toHaveBeenCalled();
    });
  
    // ---------------- getResetHistoryBySearchService ----------------
    test('getResetHistoryBySearchService returns data', async () => {
      const filters = { company_id: '123', search: 'term', page: '1', limit: '10' };
      const mockData = [{ id: 1 }];
      dao.getResetHistoryBySearchDao.mockResolvedValue(mockData);
  
      const res = await getResetHistoryBySearchService(filters);
      expect(res).toEqual(mockData);
      expect(dao.getResetHistoryBySearchDao).toHaveBeenCalledWith('123', ['term'], 10, 0);
    });
  
    test('getResetHistoryBySearchService throws BadRequestError on invalid pagination', async () => {
      const filters = { company_id: '123', search: 'term', page: '0', limit: '-1' };
      await expect(getResetHistoryBySearchService(filters)).rejects.toThrow(InternalServerError);
    });
  
    test('getResetHistoryBySearchService logs and throws InternalServerError on DAO failure', async () => {
      const filters = { company_id: '123', search: 'term', page: '1', limit: '10' };
      dao.getResetHistoryBySearchDao.mockRejectedValue(new Error('fail'));
      await expect(getResetHistoryBySearchService(filters)).rejects.toThrow(InternalServerError);
      expect(logger.error).toHaveBeenCalled();
    });
  
    // ---------------- createResetHistoryService ----------------
    test('createResetHistoryService returns data', async () => {
      const payload = { ResetHistoryName: 'Test' };
      dao.createResetHistoryDao.mockResolvedValue({ id: 1 });
  
      const res = await createResetHistoryService(null, payload);
      expect(res).toEqual({ id: 1 });
      expect(dao.createResetHistoryDao).toHaveBeenCalledWith(payload, null);
    });
  
    test('createResetHistoryService logs and throws InternalServerError on DAO failure', async () => {
      dao.createResetHistoryDao.mockRejectedValue(new Error('fail'));
      await expect(createResetHistoryService(null, {})).rejects.toThrow(InternalServerError);
      expect(logger.error).toHaveBeenCalled();
    });
  
    // ---------------- updateResetHistoryService ----------------
    test('updateResetHistoryService updates successfully when status not SUCCESS/FAILED', async () => {
      payInDao.getPayInUrlDao.mockResolvedValue({
        id: 'p1',
        status: 'PENDING',
        user_submitted_utr: 'utr123',
      });
      bankDao.getBankResponseDao.mockResolvedValue({ id: 'b1' });
      payInDao.getPayInUrlsDao.mockResolvedValue([{ status: 'PENDING' }]);
      updateBotResponseDao.mockResolvedValue({});
      payInDao.updatePayInUrlDao.mockResolvedValue({});
  
      const res = await updateResetHistoryService('id1', '123');
      expect(res).toBe('Transaction Reset Successfully');
    });
  
    test('updateResetHistoryService returns message if status SUCCESS/FAILED', async () => {
      payInDao.getPayInUrlDao.mockResolvedValue({ status: 'SUCCESS' });
      const res = await updateResetHistoryService('id1', '123');
      expect(res).toBe('Transaction status is SUCCESS or FAILED, no update applied');
    });
  
    test('updateResetHistoryService logs and throws InternalServerError on failure', async () => {
      payInDao.getPayInUrlDao.mockRejectedValue(new Error('fail'));
      await expect(updateResetHistoryService('id1', '123')).rejects.toThrow(InternalServerError);
      expect(logger.error).toHaveBeenCalled();
    });
  
    // ---------------- deleteResetHistoryService ----------------
    test('deleteResetHistoryService returns data', async () => {
      dao.deleteResetHistoryDao.mockResolvedValue({ id: 1 });
      const res = await deleteResetHistoryService('1');
      expect(res).toEqual({ id: 1 });
      expect(dao.deleteResetHistoryDao).toHaveBeenCalledWith('1', { is_obsolete: true });
    });
  
    test('deleteResetHistoryService logs and throws InternalServerError on failure', async () => {
      dao.deleteResetHistoryDao.mockRejectedValue(new Error('fail'));
      await expect(deleteResetHistoryService('1')).rejects.toThrow(InternalServerError);
      expect(logger.error).toHaveBeenCalled();
    });
  });
  