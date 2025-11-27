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
    logger: { 
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn()
    },
  }));

dayjs.extend(utc);
dayjs.extend(timezone);

describe('collectCalculationData Cron Test', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock IST formatted time
    jest.spyOn(dayjs.prototype, 'tz').mockReturnValue({
      format: jest.fn(() => '2025-04-23T19:26:00+05:30'),
    });
  });

  // ------------------------------------------------------------
  // 1. SHOULD SKIP WHEN ALREADY EXISTS
  // ------------------------------------------------------------
  it('should skip execution when calculation entry exists', async () => {
    checkCalculationEntryForDateDao.mockResolvedValue(true);

    await collectCalculationData();

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('already exists')
    );

    expect(getUsersForCronDao).not.toHaveBeenCalled();
    expect(createCalculationDao).not.toHaveBeenCalled();
  });

  // ------------------------------------------------------------
  // 2. SHOULD PROCESS USERS + CREATE CALCULATION ENTRY
  // ------------------------------------------------------------
  it('should process all users and create calculation entries', async () => {
    checkCalculationEntryForDateDao.mockResolvedValue(false);

    getUsersForCronDao.mockResolvedValue([
      { id: 1 },
      { id: 2 },
    ]);

    getCalculationforCronDao
      .mockResolvedValueOnce([
        {
          user_id: 1,
          role_id: 10,
          company_id: 20,
          net_balance: '100.50',
        },
      ])
      .mockResolvedValueOnce([
        {
          user_id: 2,
          role_id: 11,
          company_id: 21,
          net_balance: '300.75',
        },
      ]);

    createCalculationDao.mockResolvedValue(true);

    await collectCalculationData();

    expect(getUsersForCronDao).toHaveBeenCalledTimes(1);
    expect(getCalculationforCronDao).toHaveBeenCalledTimes(2);
    expect(createCalculationDao).toHaveBeenCalledTimes(2);
  });

  // ------------------------------------------------------------
  // 3. SHOULD LOG USER ERROR & CONTINUE
  // ------------------------------------------------------------
  it('should continue even if one user processing fails', async () => {
    checkCalculationEntryForDateDao.mockResolvedValue(false);

    getUsersForCronDao.mockResolvedValue([{ id: 1 }, { id: 2 }]);

    getCalculationforCronDao
      .mockResolvedValueOnce([{ user_id: 1, role_id: 10, company_id: 20, net_balance: '50' }])
      .mockRejectedValueOnce(new Error('DB ERROR'));

    await collectCalculationData();

    // First user processed
    expect(createCalculationDao).toHaveBeenCalledTimes(1);

    // Error logged for second user
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Error processing data for user 2:'),
      'DB ERROR'
    );
  });

  // ------------------------------------------------------------
  // 4. SHOULD THROW ERROR ON MAIN FAILURE
  // ------------------------------------------------------------
  it('should throw error when top-level execution fails', async () => {
    checkCalculationEntryForDateDao.mockRejectedValue(new Error('MAIN FAILED'));

    await expect(collectCalculationData()).rejects.toThrow('MAIN FAILED');

    expect(logger.error).toHaveBeenCalledWith(
      'Error while collecting user data:',
      'MAIN FAILED'
    );
  });
});
