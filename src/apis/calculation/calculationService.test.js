import {
    getCalculationService,
    createCalculationService,
    updateCalculationService,
    deleteCalculationService,
    calculateSuccessRatiosService,
  } from './calculationService.js';
  import {
    createCalculationDao,
    updateCalculationDao,
    deleteCalculationDao,
    getCalculationsSumDao,
  } from './calculationDao.js';
  import { getMerchantsDao } from '../../apis/merchants/merchantDao.js';
  import { getPayInUrlsDao } from '../../apis/payIn/payInDao.js';
  import { getConnection } from '../../utils/db.js';
  import { filterResponse } from '../../helpers/index.js';
  import { logger } from '../../utils/logger.js';
  import { BadRequestError } from '../../utils/appErrors.js';
  import { Role, merchantColumns, vendorColumns } from '../../constants/index.js';
  import dayjs from 'dayjs';
  
  // Configure Jest to handle ES modules
  jest.mock('./calculationDao.js');
  jest.mock('../../apis/merchants/merchantDao.js');
  jest.mock('../../apis/payIn/payInDao.js');
  jest.mock('../../utils/db.js');
  jest.mock('../../helpers/index.js');
  jest.mock('../../utils/logger.js');
  
  describe('Calculation Service', () => {
    let mockConn;
  
    beforeEach(() => {
      mockConn = { release: jest.fn() };
      getConnection.mockResolvedValue(mockConn);
      logger.error = jest.fn();
      logger.warn = jest.fn();
      filterResponse.mockImplementation((data) => data);
      // Mock dayjs to control date/time
      jest.spyOn(dayjs, 'apply').mockImplementation(() => ({
        isSame: jest.fn().mockReturnValue(true),
        valueOf: jest.fn().mockReturnValue(new Date('2025-08-14T15:00:00Z').valueOf()),
        format: jest.fn().mockReturnValue('2025-08-14'),
        hour: jest.fn().mockReturnThis(),
        startOf: jest.fn().mockReturnThis(),
        toDate: jest.fn().mockReturnValue(new Date('2025-08-14T00:00:00Z')),
      }));
    });
  
    afterEach(() => {
      jest.clearAllMocks();
    });
  
    describe('getCalculationService', () => {
      it('should throw BadRequestError if filters or role is missing', async () => {
        await expect(getCalculationService(null, null)).rejects.toThrow(BadRequestError);
        expect(logger.error).toHaveBeenCalledWith('Error while fetching calculation data:', 'error', expect.any(BadRequestError));
      });
  
      it('should return calculation data when valid filters and role are provided', async () => {
        const mockResult = { vendor: [], merchant: [], netBalance: { vendor: 0, merchant: 0 } };
        getCalculationsSumDao.mockResolvedValue(mockResult);
  
        const result = await getCalculationService({ some: 'filter' }, Role.MERCHANT);
        expect(result).toEqual(mockResult);
        expect(getCalculationsSumDao).toHaveBeenCalledWith({ some: 'filter', role: Role.MERCHANT });
      });
  
      it('should return default empty result if DAO returns null', async () => {
        getCalculationsSumDao.mockResolvedValue(null);
  
        const result = await getCalculationService({ some: 'filter' }, Role.MERCHANT);
        expect(result).toEqual({
          vendor: [],
          merchant: [],
          netBalance: { vendor: 0, merchant: 0 },
          merchantTotalCalculations: {},
          vendorTotalCalculations: {},
        });
      });
    });
  
    describe('createCalculationService', () => {
      it('should create a calculation record and filter response based on role', async () => {
        const payload = { amount: 100 };
        const mockData = { id: 1, amount: 100 };
        createCalculationDao.mockResolvedValue(mockData);
  
        const result = await createCalculationService(mockConn, payload, Role.MERCHANT);
        expect(result).toEqual(mockData);
        expect(createCalculationDao).toHaveBeenCalledWith(mockConn, payload);
        expect(filterResponse).toHaveBeenCalledWith(mockData, merchantColumns.CALCULATION);
      });
  
      it('should throw an error if creation fails', async () => {
        const error = new Error('Creation failed');
        createCalculationDao.mockRejectedValue(error);
  
        await expect(createCalculationService(mockConn, {}, Role.MERCHANT)).rejects.toThrow(error);
        expect(logger.error).toHaveBeenCalledWith('Error while creating calculation record:', error);
      });
    });
  
    describe('updateCalculationService', () => {
      it('should update a calculation record and filter response based on role', async () => {
        const filters = { id: 1 };
        const payload = { amount: 200 };
        const mockData = { id: 1, amount: 200 };
        updateCalculationDao.mockResolvedValue(mockData);
  
        const result = await updateCalculationService(mockConn, filters, payload, Role.VENDOR);
        expect(result).toEqual(mockData);
        expect(updateCalculationDao).toHaveBeenCalledWith(filters, payload, mockConn);
        expect(filterResponse).toHaveBeenCalledWith(mockData, vendorColumns.CALCULATION);
        expect(mockConn.release).toHaveBeenCalled();
      });
  
      it('should handle connection release error', async () => {
        const error = new Error('Update failed');
        updateCalculationDao.mockRejectedValue(error);
        mockConn.release.mockImplementation(() => {
          throw new Error('Release failed');
        });
  
        await expect(updateCalculationService(mockConn, {}, {}, Role.VENDOR)).rejects.toThrow(error);
        expect(logger.error).toHaveBeenCalledWith('Error while updating calculation record:', error);
        expect(logger.error).toHaveBeenCalledWith('Error while releasing the connection:', expect.any(Error));
      });
    });
  
    describe('deleteCalculationService', () => {
      it('should mark a calculation record as obsolete and filter response', async () => {
        const id = 1;
        const mockData = { id: 1, is_obsolete: true };
        deleteCalculationDao.mockResolvedValue(mockData);
  
        const result = await deleteCalculationService(mockConn, id, Role.MERCHANT);
        expect(result).toEqual(mockData);
        expect(deleteCalculationDao).toHaveBeenCalledWith(mockConn, id, { is_obsolete: true });
        expect(filterResponse).toHaveBeenCalledWith(mockData, merchantColumns.CALCULATION);
      });
  
      it('should throw an error if deletion fails', async () => {
        const error = new Error('Deletion failed');
        deleteCalculationDao.mockRejectedValue(error);
  
        await expect(deleteCalculationService(mockConn, 1, Role.MERCHANT)).rejects.toThrow(error);
        expect(logger.error).toHaveBeenCalledWith('Error while deleting calculation record:', error);
      });
    });
  
    describe('calculateSuccessRatiosService', () => {
      it('should calculate success ratios for given user IDs on current date', async () => {
        const date = '2025-08-14';
        const userIds = ['user1'];
        const merchants = [{ id: 1, user_id: 'user1', code: 'M1' }];
        const payins = [
          { merchant_id: 1, updated_at: '2025-08-14T14:55:00Z', status: 'SUCCESS', user_submitted_utr: 'UTR123' },
          { merchant_id: 1, updated_at: '2025-08-14T14:50:00Z', status: 'FAILED', user_submitted_utr: '' },
        ];
        getMerchantsDao.mockResolvedValue(merchants);
        getPayInUrlsDao.mockResolvedValue(payins);
  
        const result = await calculateSuccessRatiosService(date, userIds);
        expect(result.successRatios).toHaveLength(1);
        expect(result.successRatios[0].merchantCode).toBe('M1');
        expect(result.successRatios[0].stats).toHaveLength(6);
        expect(result.successRatios[0].stats[0]).toEqual({
          interval: 'Last 5m',
          total: 2,
          success: 1,
          utrSubmitted: 1,
          successRatio: 50,
          utrRatio: 50,
        });
        expect(getMerchantsDao).toHaveBeenCalledWith({ user_id: userIds });
        expect(getPayInUrlsDao).toHaveBeenCalledWith({ merchant_id: 1 });
        expect(mockConn.release).toHaveBeenCalled();
      });
  
      it('should calculate success ratios for a past date', async () => {
        const date = '2025-08-13';
        const userIds = ['user1'];
        const merchants = [{ id: 1, user_id: 'user1', code: 'M1' }];
        const payins = [
          { merchant_id: 1, updated_at: '2025-08-13T03:00:00Z', status: 'SUCCESS', user_submitted_utr: 'UTR123' },
        ];
        getMerchantsDao.mockResolvedValue(merchants);
        getPayInUrlsDao.mockResolvedValue(payins);
        jest.spyOn(dayjs, 'apply').mockImplementation(() => ({
          isSame: jest.fn().mockReturnValue(false),
          valueOf: jest.fn().mockReturnValue(new Date('2025-08-13T15:00:00Z').valueOf()),
          format: jest.fn().mockReturnValue('2025-08-13'),
          hour: jest.fn().mockReturnThis(),
          startOf: jest.fn().mockReturnThis(),
          toDate: jest.fn().mockImplementation((h) => new Date(`2025-08-13T${h || '00'}:00:00Z`)),
        }));
  
        const result = await calculateSuccessRatiosService(date, userIds);
        expect(result.successRatios).toHaveLength(1);
        expect(result.successRatios[0].stats[0]).toEqual({
          interval: '04:00',
          total: 1,
          success: 1,
          utrSubmitted: 1,
          successRatio: 100,
          utrRatio: 100,
        });
        expect(mockConn.release).toHaveBeenCalled();
      });
  
      it('should return empty array if no merchant found', async () => {
        getMerchantsDao.mockResolvedValue([]);
        const result = await calculateSuccessRatiosService('2025-08-14', ['user1']);
        expect(result.successRatios).toEqual([]);
        expect(logger.warn).toHaveBeenCalledWith('No merchant found for user_id: user1');
        expect(mockConn.release).toHaveBeenCalled();
      });
  
      it('should handle errors and release connection', async () => {
        const error = new Error('Calculation failed');
        getMerchantsDao.mockRejectedValue(error);
  
        await expect(calculateSuccessRatiosService('2025-08-14', ['user1'])).rejects.toThrow(error);
        expect(logger.error).toHaveBeenCalledWith('Error in calculateSuccessRatiosService:', error);
        expect(mockConn.release).toHaveBeenCalled();
      });
    });
  });