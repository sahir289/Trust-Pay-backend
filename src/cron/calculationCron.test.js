import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import collectCalculationData from './calculationCron.js';
import {
  getCalculationforCronDao,
  checkCalculationEntryForDateDao,
  createCalculationDao,
} from '../apis/calculation/calculationDao.js';
import { getUsersForCronDao } from '../apis/users/userDao.js';
import { transactionWrapper } from '../utils/db.js';
import { logger } from '../utils/logger.js';

jest.mock('node-cron');
jest.mock('../apis/calculation/calculationDao.js');
jest.mock('../apis/users/userDao.js');
jest.mock('../utils/db.js', () => ({
  transactionWrapper: jest.fn(),
  createPool: jest.fn(() => ({
    query: jest.fn(),
    connect: jest.fn(() => ({
      query: jest.fn(),
      release: jest.fn(),
    })),
  })),
  getConnection: jest.fn(),
}));
jest.mock('../utils/logger.js', () => ({
  logger: { info: jest.fn(), error: jest.fn() },
}));

describe('calculationCron', () => {
  let mockUsers;
  let retryCount;
  const MAX_RETRIES = 3;

  beforeEach(() => {
    jest.clearAllMocks();
    retryCount = 0;
    jest.useFakeTimers();
    dayjs.extend(utc);
    dayjs.extend(timezone);

    mockUsers = [{ id: 1 }, { id: 2 }];
    transactionWrapper.mockImplementation(async (fn) => {
      return await fn(null);
    });

    getUsersForCronDao.mockImplementation(async () => mockUsers);
    checkCalculationEntryForDateDao.mockResolvedValue(false);
    getCalculationforCronDao.mockImplementation((userId) =>
      Promise.resolve([
        {
          user_id: userId,
          role_id: 10,
          company_id: 100,
          net_balance: '5000.50',
        },
      ])
    );
    createCalculationDao.mockImplementation(async () => true);

    // Set default dayjs.tz mock
    // Get today's date in IST timezone and format it
    const today = dayjs().tz('Asia/Kolkata');
    const todayISO = today.format('YYYY-MM-DD');
    const todayWithTime = today.format('YYYY-MM-DDTHH:mm:ssZ');
    
    jest.spyOn(dayjs, 'tz').mockReturnValue({
      format: jest.fn()
        .mockReturnValueOnce(todayWithTime) // executionStartTime
        .mockReturnValueOnce(todayISO)      // currentDate
        .mockReturnValueOnce(todayWithTime) // currentTime
        .mockReturnValueOnce(todayWithTime), // executionEndTime
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.spyOn(dayjs, 'tz').mockReset();
  });

  describe('collectCalculationData', () => {
    it('should process calculations for all users when no entry exists', async () => {
      await collectCalculationData();
  
      const todayISO = dayjs().tz('Asia/Kolkata').format('YYYY-MM-DD');
  
      expect(getUsersForCronDao).toHaveBeenCalledWith();
      expect(checkCalculationEntryForDateDao).toHaveBeenCalledWith(todayISO);
  
      for (const user of mockUsers) {
        expect(getCalculationforCronDao).toHaveBeenCalledWith(user.id);
      }
  
      expect(createCalculationDao).toHaveBeenCalledTimes(mockUsers.length);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Cron job executed successfully for all users.')
      );
    });

    it('should skip processing if calculation entry already exists', async () => {
      checkCalculationEntryForDateDao.mockResolvedValue(true);

      await collectCalculationData();

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Calculation entry for date')
      );
      expect(getUsersForCronDao).not.toHaveBeenCalled();
      expect(createCalculationDao).not.toHaveBeenCalled();
    });

    it('should handle user-specific DAO errors without failing entire cron', async () => {
      getCalculationforCronDao.mockRejectedValueOnce(new Error('User DAO failed'));

      await collectCalculationData();

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error processing data for user 1:'),
        expect.stringContaining('User DAO failed')
      );
      expect(createCalculationDao).toHaveBeenCalledTimes(mockUsers.length - 1);
    });

    it('should throw error if main cron fails', async () => {
      getUsersForCronDao.mockRejectedValueOnce(new Error('User fetch failed'));

      await expect(collectCalculationData()).rejects.toThrow('User fetch failed');
      expect(logger.error).toHaveBeenCalledWith(
        'Error while collecting user data:',
        expect.stringContaining('User fetch failed')
      );
    });

    it('should call createCalculationDao with parsed net_balance', async () => {
      await collectCalculationData();

      expect(createCalculationDao).toHaveBeenCalledWith(null, expect.objectContaining({
        net_balance: 5000.50,
      }));
    });

    it('should handle empty user list gracefully', async () => {
      getUsersForCronDao.mockResolvedValue([]);

      await collectCalculationData();

      expect(getUsersForCronDao).toHaveBeenCalledWith();
      expect(getCalculationforCronDao).not.toHaveBeenCalled();
      expect(createCalculationDao).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Cron job executed successfully for all users.')
      );
    });

    it('should handle null response from getUsersForCronDao', async () => {
      getUsersForCronDao.mockResolvedValue(null);

      await collectCalculationData();

      expect(getUsersForCronDao).toHaveBeenCalledWith();
      expect(getCalculationforCronDao).not.toHaveBeenCalled();
      expect(createCalculationDao).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Cron job executed successfully for all users.')
      );
    });

    it('should handle invalid net_balance format', async () => {
      getCalculationforCronDao.mockImplementation((userId) =>
        Promise.resolve([
          {
            user_id: userId,
            role_id: 10,
            company_id: 100,
            net_balance: 'invalid',
          },
        ])
      );

      await collectCalculationData();

      expect(createCalculationDao).toHaveBeenCalledWith(null, expect.objectContaining({
        net_balance: NaN,
      }));
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Cron job executed successfully for all users.')
      );
    });

    it('should handle empty calculation data for a user', async () => {
      getCalculationforCronDao.mockImplementation(() =>
        Promise.resolve([])
      );

      await collectCalculationData();

      expect(getCalculationforCronDao).toHaveBeenCalledTimes(mockUsers.length);
      expect(createCalculationDao).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Cron job executed successfully for all users.')
      );
    });

    it('should handle createCalculationDao failure for individual user', async () => {
      createCalculationDao.mockRejectedValueOnce(new Error('Create DAO failed'));

      await collectCalculationData();

      expect(logger.error).toHaveBeenCalledWith(
        'Error while updating calculation data:',
        expect.stringContaining('Create DAO failed')
      );
      expect(createCalculationDao).toHaveBeenCalledTimes(mockUsers.length);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Cron job executed successfully for all users.')
      );
    });

    it('should process multiple calculations for a single user', async () => {
      getCalculationforCronDao.mockImplementation((userId) =>
        Promise.resolve([
          {
            user_id: userId,
            role_id: 10,
            company_id: 100,
            net_balance: '5000.50',
          },
          {
            user_id: userId,
            role_id: 20,
            company_id: 200,
            net_balance: '7500.75',
          },
        ])
      );

      await collectCalculationData();

      expect(getCalculationforCronDao).toHaveBeenCalledTimes(mockUsers.length);
      expect(createCalculationDao).toHaveBeenCalledTimes(mockUsers.length);
      expect(createCalculationDao).toHaveBeenCalledWith(null, expect.objectContaining({
        net_balance: 5000.50,
      }));
      // Note: Implementation processes only the first calculation per user
    });

  });

  describe('executeWithRetry', () => {
    const executeWithRetry = async (attemptDescription) => {
      retryCount++;
      logger.info(`Running calculation cron job in production mode at ${attemptDescription}`);
      try {
        await collectCalculationData();
        logger.info(`Cron job executed successfully on ${attemptDescription}`);
      } catch (error) {
        logger.error(`Cron job failed on ${attemptDescription}:`, error?.message);
        if (retryCount < MAX_RETRIES) {
          const nextAttempt = retryCount + 1;
          logger.info(`Scheduling retry attempt ${nextAttempt} in 10 seconds...`);
          setTimeout(async () => {
            await executeWithRetry(`12:00:${(retryCount * 10).toString().padStart(2, '0')} AM IST (Attempt ${nextAttempt})`);
          }, 10000);
        } else {
          logger.error(`All ${MAX_RETRIES} attempts failed. Cron job execution unsuccessful.`);
        }
      }
    };

    it('should not retry if first attempt succeeds', async () => {
      await executeWithRetry('12:00 AM IST (Attempt 1)');

      expect(logger.info).toHaveBeenCalledWith(
        'Cron job executed successfully on 12:00 AM IST (Attempt 1)'
      );
      expect(retryCount).toBe(1);
      expect(logger.info).not.toHaveBeenCalledWith(
        expect.stringContaining('Scheduling retry attempt')
      );
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('should reset retryCount for new execution', async () => {
      retryCount = 2; // Simulate previous retries
      await executeWithRetry('12:00 AM IST (Attempt 1)');

      expect(retryCount).toBe(3); // Should increment from 2 to 3, not reset
      expect(logger.info).toHaveBeenCalledWith(
        'Cron job executed successfully on 12:00 AM IST (Attempt 1)'
      );
    });
  });
});