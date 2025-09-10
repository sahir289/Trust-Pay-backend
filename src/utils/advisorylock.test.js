import { checkLockEdit } from './advisoryLock.js';
import { BadRequestError } from './appErrors.js';
import { logger } from './logger.js';

jest.mock('./logger.js', () => ({
  logger: { error: jest.fn() },
}));

describe('checkLockEdit', () => {
  let mockConn;

  beforeEach(() => {
    mockConn = {
      query: jest.fn(),
    };
    jest.clearAllMocks();
  });

  it('should acquire lock and return true when lock is available and payin=true', async () => {
    mockConn.query.mockResolvedValue({ rows: [{ acquired: true }] });

    const result = await checkLockEdit(mockConn, 'abcd-1234', true);

    expect(result).toBe(true);
    expect(mockConn.query).toHaveBeenCalledWith(
      'SELECT pg_try_advisory_xact_lock($1) AS acquired',
      [expect.any(Number)]
    );
  });

  it('should acquire lock and wait for 2 seconds if payin=false', async () => {
    mockConn.query.mockResolvedValue({ rows: [{ acquired: true }] });

    const start = Date.now();
    const result = await checkLockEdit(mockConn, 'abcd-1234', false);
    const elapsed = Date.now() - start;

    expect(result).toBe(true);
    expect(elapsed).toBeGreaterThanOrEqual(2000); // ensures wait happened
  });

  it('should throw BadRequestError if lock is not acquired', async () => {
    mockConn.query.mockResolvedValue({ rows: [{ acquired: false }] });

    await expect(checkLockEdit(mockConn, 'abcd-1234', true)).rejects.toThrow(
      BadRequestError
    );
  });

  it('should log and rethrow error if query fails', async () => {
    const error = new Error('DB error');
    mockConn.query.mockRejectedValue(error);

    await expect(checkLockEdit(mockConn, 'abcd-1234', true)).rejects.toThrow(
      'DB error'
    );
    expect(logger.error).toHaveBeenCalledWith(
      'Error while attempting to check lock for ID',
      error
    );
  });
});
