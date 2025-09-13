import Redis from 'ioredis';
import { closeRedis } from './redisClient.js';
import { logger } from './logger.js';
import chalk from 'chalk';
// import redisClient from './redisClient.js';

jest.mock('ioredis');
jest.mock('./logger.js', () => ({
  logger: { info: jest.fn(), error: jest.fn() },
}));
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
  describe('closeRedis', () => {
    it('should quit Redis client successfully', async () => {
      await closeRedis();
      // expect(mockRedis.quit).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(chalk.bold.red(`Redis Connection closed`));
    });

    it('should handle quit errors', async () => {
      mockRedis.quit.mockRejectedValueOnce(new Error('fail'));
      await closeRedis();
      // expect(logger.error).toHaveBeenCalledWith('Redis Close error:', expect.any(Error));
    });
  });
  // describe('Redis Client', () => {
  //   let mockRedisInstance;
  
  //   beforeEach(() => {
  //     jest.clearAllMocks();
  
  //     mockRedisInstance = {
  //       on: jest.fn(),
  //       quit: jest.fn().mockResolvedValue(true),
  //     };
  
  //     Redis.mockImplementation(() => mockRedisInstance);
  //   });
  
  //   it('should log successful connection', () => {
  //     const connectHandler = mockRedisInstance.on.mock.calls.find(
  //       ([event]) => event === 'connect'
  //     )[1];
  
  //     connectHandler(); 
  
  //     expect(logger.info).toHaveBeenCalledWith(
  //       chalk.bold.green('Redis Connected Successfully')
  //     );
  //   });
  
  //   it('should close redis connection and log', async () => {
  //     await closeRedis();
  
  //     expect(mockRedisInstance.quit).toHaveBeenCalled();
  //     expect(logger.info).toHaveBeenCalledWith(
  //       chalk.bold.red('Redis Connection closed')
  //     );
  //   });
  // });
});
