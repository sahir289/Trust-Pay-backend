import {
    getResetHistory,
    getResetHistoryBySearch,
    createResetHistory,
    updateResetHistory,
    deleteResetHistory,
  } from './resetController.js';
  
  import * as services from './resetServices.js';
  import { transactionWrapper } from '../../utils/db.js';
  import { sendSuccess } from '../../utils/responseHandlers.js';
  import { logger } from '../../utils/logger.js';
  
  jest.mock('../../utils/db.js');
  
  jest.mock('../../utils/responseHandlers.js', () => ({
    sendSuccess: jest.fn(),
  }));
  
  jest.mock('../../utils/logger.js', () => ({
    logger: { error: jest.fn() },
  }));
  
  describe('resetController', () => {
    let req, res;
  
    beforeEach(() => {
      req = { user: {}, body: {}, params: {}, query: {} };
      res = {};
      jest.clearAllMocks();
    });
  
    // ---------------- GET RESET HISTORY ----------------
    test('getResetHistory should call service and send success', async () => {
      req.user.company_id = '123';
      req.query = { page: 1, limit: 10 };
  
      const mockData = [{ id: 1 }];
      jest.spyOn(services, 'getResetHistoryService').mockResolvedValue(mockData);
  
      await getResetHistory(req, res);
  
      expect(services.getResetHistoryService).toHaveBeenCalledWith(
        '123',
        1,
        10,
        'sno',
        'DESC',
        undefined,
        undefined,
      );
      expect(sendSuccess).toHaveBeenCalledWith(res, mockData, 'reset history successfully');
    });
  
    // ---------------- GET RESET HISTORY BY SEARCH ----------------
    test('getResetHistoryBySearch should call service and send success', async () => {
      req.user.company_id = '123';
      req.user.role = 'ADMIN';
      req.query = { search: 'test', page: 1, limit: 10 };
  
      const mockData = [{ id: 1 }];
      jest.spyOn(services, 'getResetHistoryBySearchService').mockResolvedValue(mockData);
  
      await getResetHistoryBySearch(req, res);
  
      expect(services.getResetHistoryBySearchService).toHaveBeenCalledWith(
        { company_id: '123', search: 'test', page: 1, limit: 10, ...req.query },
        'ADMIN',
      );
      expect(sendSuccess).toHaveBeenCalledWith(res, mockData, 'History fetched successfully');
    });
  
    // ---------------- CREATE RESET HISTORY ----------------
    test('createResetHistory should call service and send success', async () => {
      req.user = { user_id: 'u1', company_id: '123' };
      req.body = { ResetHistoryName: 'Test' };
  
      const mockData = { id: 1 };
      jest.spyOn(services, 'createResetHistoryService').mockResolvedValue(mockData);
  
      await createResetHistory(req, res);
  
      expect(transactionWrapper).toHaveBeenCalled();
      expect(services.createResetHistoryService).toHaveBeenCalledWith({
        ResetHistoryName: 'Test',
        created_by: 'u1',
        updated_by: 'u1',
        company_id: '123',
      });
      expect(sendSuccess).toHaveBeenCalledWith(res, mockData, 'reset history successfully');
    });
  
    // ---------------- UPDATE RESET HISTORY ----------------
    test('updateResetHistory should call service and send success', async () => {
      req.user.company_id = '123';
      req.params.id = '1';
  
      const mockData = { id: 1 };
      jest.spyOn(services, 'updateResetHistoryService').mockResolvedValue(mockData);
  
      await updateResetHistory(req, res);
  
      expect(services.updateResetHistoryService).toHaveBeenCalledWith('1', '123');
      expect(sendSuccess).toHaveBeenCalledWith(res, mockData, 'reset history successfully');
    });
  
    // ---------------- DELETE RESET HISTORY ----------------
    test('deleteResetHistory should call service and send success', async () => {
      req.params.id = '1';
      const mockData = { id: 1 };
      jest.spyOn(services, 'deleteResetHistoryService').mockResolvedValue(mockData);
  
      await deleteResetHistory(req, res);
  
      expect(services.deleteResetHistoryService).toHaveBeenCalledWith('1');
      expect(sendSuccess).toHaveBeenCalledWith(res, mockData, 'reset history successfully');
    });
  
    // ---------------- ERROR HANDLING ----------------
    test('getResetHistory should log error on service failure', async () => {
      req.user.company_id = '123';
      jest.spyOn(services, 'getResetHistoryService').mockRejectedValue(new Error('fail'));
  
      await getResetHistory(req, res);
  
      expect(logger.error).toHaveBeenCalledWith(
        'error getting while fetching reports',
        expect.any(Error),
      );
    });
  });
  