import Redis from 'ioredis';
import { closeRedis } from './redisClient.js';
import { logger } from './logger.js';
import chalk from 'chalk';

jest.mock('ioredis');
jest.mock('./logger.js', () => ({
  logger: { info: jest.fn(), error: jest.fn() },
}));

describe('Redis Utility', () => {
  let mockRedis;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRedis = {
      on: jest.fn(),
      quit: jest.fn().mockResolvedValue('OK'),
    };
    Redis.mockImplementation(() => mockRedis);
  });

  it('should initialize Redis client and attach event listeners', () => {
    require('./redis.js'); // re-import to trigger initialization

    expect(Redis).toHaveBeenCalledWith(expect.any(String));
    expect(mockRedis.on).toHaveBeenCalledWith('connect', expect.any(Function));
    expect(mockRedis.on).toHaveBeenCalledWith('error', expect.any(Function));

    // simulate connect event
    const connectCallback = mockRedis.on.mock.calls.find(call => call[0] === 'connect')[1];
    connectCallback();
    expect(logger.info).toHaveBeenCalledWith(chalk.bold.green(`Redis Connected Successfully`));

    // simulate error event
    const errorCallback = mockRedis.on.mock.calls.find(call => call[0] === 'error')[1];
    const error = new Error('fail');
    errorCallback(error);
    expect(logger.error).toHaveBeenCalledWith('Redis Error:', error);
  });

  describe('closeRedis', () => {
    it('should quit Redis client successfully', async () => {
      await closeRedis();
      expect(mockRedis.quit).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(chalk.bold.red(`Redis Connection closed`));
    });

    it('should handle quit errors', async () => {
      mockRedis.quit.mockRejectedValueOnce(new Error('fail'));
      await closeRedis();
      expect(logger.error).toHaveBeenCalledWith('Redis Close error:', expect.any(Error));
    });
  });
});
