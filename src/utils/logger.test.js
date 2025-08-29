// __tests__/logger.test.js
jest.mock('../utils/logger.js', () => ({
  logger: {
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { logger } from '../utils/logger.js';

describe('logger mock consistency', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call info correctly', () => {
    logger.info('Test message', { user: 'u1' });
    expect(logger.info).toHaveBeenCalledWith('Test message', { user: 'u1' });
  });

  it('should call warn correctly', () => {
    logger.warn('Warn message');
    expect(logger.warn).toHaveBeenCalledWith('Warn message');
  });

  it('should call error correctly', () => {
    logger.error('Error message', { code: 500 });
    expect(logger.error).toHaveBeenCalledWith('Error message', { code: 500 });
  });

  it('should call log correctly', () => {
    logger.log('Some log');
    expect(logger.log).toHaveBeenCalledWith('Some log');
  });
});
