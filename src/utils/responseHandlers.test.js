import { sendSuccess, sendNewSuccess, sendError } from './responseHandlers.js';
import { logger } from './logger.js';

jest.mock('./logger.js', () => ({
  logger: { info: jest.fn(), error: jest.fn() },
}));

describe('Response Utilities', () => {
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      req: { method: 'POST' }, // default to POST
    };
  });

  describe('sendSuccess', () => {
    it('should send response with data, message, status, total, and page', () => {
      const data = { id: 1 };
      const message = 'Success';
      const status = 201;
      const total = 5;
      const page = 2;

      sendSuccess(res, data, message, status, total, page);

      expect(res.status).toHaveBeenCalledWith(status);
      expect(res.json).toHaveBeenCalledWith({
        error: {},
        meta: { message },
        data,
        total,
        page,
      });
      expect(logger.info).toHaveBeenCalledWith(message, { status, data });
    });

    it('should log only status for GET requests', () => {
      res.req.method = 'GET';
      sendSuccess(res, { id: 1 }, 'Get message');

      expect(logger.info).toHaveBeenCalledWith('Get message', { status: 200 });
    });
  });

  describe('sendNewSuccess', () => {
    it('should send response with message, statusCode, and data', () => {
      const data = { id: 2 };
      const message = 'New success';
      const status = 202;

      sendNewSuccess(res, data, message, status);

      expect(res.status).toHaveBeenCalledWith(200); // always returns 200
      expect(res.json).toHaveBeenCalledWith({
        message,
        statusCode: status,
        data,
      });
      expect(logger.info).toHaveBeenCalledWith(message, { status, data });
    });
  });

  describe('sendError', () => {
    it('should send error response with message and statusCode', () => {
      const message = 'Error occurred';
      const statusCode = 400;

      const now = new Date();
      jest.spyOn(global, 'Date').mockImplementation(() => now);

      sendError(res, message, statusCode);

      expect(res.status).toHaveBeenCalledWith(statusCode);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          additionalInfo: {},
          level: 'info',
          timestamp: now.toISOString(),
          message,
          status: statusCode,
        },
      });
      expect(logger.error).toHaveBeenCalledWith({
        error: {
          additionalInfo: {},
          level: 'info',
          timestamp: now.toISOString(),
          message,
          status: statusCode,
        },
      });

      jest.restoreAllMocks();
    });
  });
});
