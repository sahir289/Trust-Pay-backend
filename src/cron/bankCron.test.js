// __tests__/bankCron.test.js

jest.mock('../utils/db.js');
jest.mock('../utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));
jest.mock('../utils/redisClient.js');
jest.mock('../apis/bankHistory/bankHistorySevice.js');

// ✅ now import modules
import collectBankData from './bankCron.js';
import { getConnection } from '../utils/db.js';
import { logger } from '../utils/logger.js';
import { createBankHistoryService } from '../apis/bankHistory/bankHistorySevice.js';

describe('collectBankData', () => {
  let mockConn;

  beforeEach(() => {
    mockConn = {
      query: jest.fn(),
      release: jest.fn(),
    };
    getConnection.mockResolvedValue(mockConn);
    jest.clearAllMocks();
  });

  it('should update today_balance and payin_count for all bank accounts', async () => {
    // Mock dependencies
    getConnection.mockResolvedValue(mockConn);
    mockConn.query.mockResolvedValue(); // Mock query to resolve successfully
    mockConn.release.mockResolvedValue(); // Mock release to resolve
    createBankHistoryService.mockResolvedValue([]); // Mock service to resolve
    logger.info.mockReturnValue(); // Mock logger
    logger.error.mockReturnValue();

    // Call the function
    await collectBankData('Asia/Kolkata');

    // Assertions
    expect(getConnection).toHaveBeenCalledWith('writer');
    expect(createBankHistoryService).toHaveBeenCalledWith(mockConn);
    expect(mockConn.query).toHaveBeenCalledWith(
      'UPDATE public."BankAccount" SET today_balance = 0 , payin_count = 0 '
    );
    expect(logger.info).toHaveBeenCalledWith(
      'Successfully updated today_balance for all bank accounts.',
      expect.any(Object)
    );
    expect(mockConn.release).toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled(); // Ensure no errors occurred
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
});
