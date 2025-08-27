import dayjs from 'dayjs';
import collectCalculationData from './calculationCron.js';
import {
  getCalculationforCronDao,
  checkCalculationEntryForDateDao,
  createCalculationDao,
} from '../apis/calculation/calculationDao.js';
import { getUsersForCronDao } from '../apis/users/userDao.js';
import { transactionWrapper } from '../utils/db.js';
import { logger } from '../utils/logger.js';

jest.mock('../apis/calculation/calculationDao.js');
jest.mock('../apis/users/userDao.js');
jest.mock('../utils/db.js');
jest.mock('../utils/logger.js');

describe('collectCalculationData', () => {
  const IST = 'Asia/Kolkata';
  let mockUsers;

  beforeEach(() => {
    jest.clearAllMocks();

    mockUsers = [{ id: 1 }, { id: 2 }];
    transactionWrapper.mockImplementation((fn) => fn);

    getUsersForCronDao.mockResolvedValue(mockUsers);
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
    createCalculationDao.mockResolvedValue(true);
  });

  it('should process calculations for all users when no entry exists', async () => {
    await collectCalculationData();

    expect(transactionWrapper).toHaveBeenCalledWith(getUsersForCronDao);
    expect(getUsersForCronDao).toHaveBeenCalled();
    expect(checkCalculationEntryForDateDao).toHaveBeenCalledWith(
      dayjs().tz(IST).format('YYYY-MM-DD')
    );

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
      'User DAO failed'
    );
  });

  it('should throw error if main cron fails', async () => {
    transactionWrapper.mockImplementation(() => {
      throw new Error('Transaction failed');
    });

    await expect(collectCalculationData()).rejects.toThrow('Transaction failed');
    expect(logger.error).toHaveBeenCalledWith(
      'Error while collecting user data:',
      'Transaction failed'
    );
  });

  it('should call createCalculationDao with parsed net_balance', async () => {
    await collectCalculationData();

    expect(createCalculationDao).toHaveBeenCalledWith(null, expect.objectContaining({
      net_balance: 5000.50,
    }));
  });
});
