// __tests__/errorHandling.test.js

// Mock logger first
// jest.mock('../utils/logger.js', () => ({
//   logger: {
//     info: jest.fn(),
//     error: jest.fn(),
//     warn: jest.fn(),
//     log: jest.fn(),
//   },
// }));

// Mock redisClient to prevent side effects
jest.mock('../utils/redisClient.js', () => ({
  __esModule: true,
  default: {
    on: jest.fn(),
    quit: jest.fn(),
  },
  closeRedis: jest.fn(),
}));

describe('errorHandler middleware', () => {
  let req, res, next;
  let errorHandler;
  // let logger;
  let HTTPError;
  let CustomError;

  beforeEach(() => {
    jest.isolateModules(() => {
      // const loggerModule = require('../utils/logger.js');
      // logger = loggerModule.logger;

      const errorHandlerModule = require('../middlewares/errorHandler.js');
      errorHandler = errorHandlerModule.default;

      const appErrors = require('../utils/appErrors.js');
      HTTPError = appErrors.HTTPError;
      CustomError = appErrors.CustomError;
    });

    req = {};
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  it('should handle HTTPError properly', () => {
    const error = new HTTPError('Not Found', 500);
    errorHandler(error, req, res, next);

    // expect(logger.error).toHaveBeenCalledWith(error);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: { message: 'Not Found', name: 'HTTPError', statusCode: 500 },
    });
  });

  it('should handle CustomError properly', () => {
    const error = new CustomError('Custom failure', 500);
    errorHandler(error, req, res, next);

    // expect(logger.error).toHaveBeenCalledWith(error);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: { additionalInfo: undefined, message: 500, status: 'Custom failure' },
    });
  });

  it('should handle generic error properly', () => {
    const error = new Error('Some failure');
    errorHandler(error, req, res, next);

    // expect(logger.error).toHaveBeenCalledWith(error);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: { message: 'Some failure' , statusCode : 500 },
    });
  });

  it('should handle null/undefined error', () => {
    errorHandler(null, req, res, next);

    // expect(logger.error).toHaveBeenCalledWith(null);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: { message: 'Server encountered a problem', statusCode: 500 },
    });
  });
});
