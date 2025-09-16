import tryCatchHandler from './tryCatchHandler';
import { logger } from './logger.js';

// Mock logger to prevent actual console output
jest.mock('./logger.js', () => ({
  logger: {
    error: jest.fn(),
  },
}));

describe('tryCatchHandler middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {};
    res = { send: jest.fn(), status: jest.fn().mockReturnThis() };
    next = jest.fn();
  });

  test('should call the wrapped function successfully', async () => {
    const mockFn = jest.fn(async (req, res) => {
      res.send('success');
    });

    const wrapped = tryCatchHandler(mockFn);
    await wrapped(req, res, next);

    expect(mockFn).toHaveBeenCalledWith(req, res);
    expect(res.send).toHaveBeenCalledWith('success');
    expect(next).not.toHaveBeenCalled();
  });

  test('should catch errors and call next with error', async () => {
    // const error = new Error('Something went wrong');
    const error = {message : 'Something went wrong'};
    const mockFn = jest.fn(async () => {
      throw error;
    });

    const wrapped = tryCatchHandler(mockFn);
    await wrapped(req, res, next);

    expect(mockFn).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(error.message);
    expect(next).toHaveBeenCalledWith(error);
  });
});
