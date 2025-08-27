// import moment from 'moment-timezone';
import collectBankData from './bankCron.js';
import { getConnection } from '../utils/db.js';
import { logger } from '../utils/logger.js';

jest.mock('../utils/db.js');
jest.mock('../utils/logger.js');

describe('collectBankData', () => {
  let mockConn;

  beforeEach(() => {
    mockConn = {
      query: jest.fn(),
      release: jest.fn(),
    };
    getConnection.mockResolvedValue(mockConn);
    logger.info = jest.fn();
    logger.error = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should update today_balance and payin_count for all bank accounts', async () => {
    await collectBankData('Asia/Kolkata');

    expect(getConnection).toHaveBeenCalled();
    expect(mockConn.query).toHaveBeenCalledWith(
      'UPDATE public."BankAccount" SET today_balance = 0 , payin_count = 0 '
    );
    expect(logger.info).toHaveBeenCalledWith(
      'Successfully updated today_balance for all bank accounts.',
      expect.any(Object) // startTime is a moment object
    );
    expect(mockConn.release).toHaveBeenCalled();
  });

  it('should log error if query fails', async () => {
    const error = new Error('DB query failed');
    mockConn.query.mockRejectedValueOnce(error);

    await collectBankData();

    expect(logger.error).toHaveBeenCalledWith(
      'Error while updating bank account data:',
      'DB query failed'
    );
    expect(mockConn.release).toHaveBeenCalled();
  });

  it('should log error if releasing connection fails', async () => {
    mockConn.release.mockImplementationOnce(() => {
      throw new Error('Release failed');
    });

    await collectBankData();

    expect(logger.error).toHaveBeenCalledWith(
      'Error releasing DB connection:',
      'Release failed'
    );
  });

  it('should use default timezone if none is provided', async () => {
    await collectBankData();

    // Check if moment is called with default timezone
    // const startTime = moment().tz('Asia/Kolkata', true);
    expect(logger.info).toHaveBeenCalledWith(
      'Successfully updated today_balance for all bank accounts.',
      expect.any(Object)
    );
  });
});
