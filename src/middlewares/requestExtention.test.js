import { methodNotFound, addLogIdInRequest } from './requestExtension.js';
import { logger } from '../utils/logger.js';
// import { generateUUID } from '../utils/generateUUID.js';

jest.mock('../utils/logger.js', () => ({
  logger: {
    error: jest.fn(),
    log: jest.fn(),
  },
}));

jest.mock('../utils/generateUUID.js', () => ({
  generateUUID: jest.fn(() => 'mock-uuid-123'),
}));

describe('requestExtension Tests', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      originalUrl: '/test/url',
      headers: { 'user-agent': 'jest-agent' },
      method: 'GET',
      hostname: 'localhost',
      ip: '127.0.0.1',
      body: { a: 1 },
      query: { b: 2 },
      params: { c: 3 },
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    next = jest.fn();

    jest.clearAllMocks();
  });

  // -------------------------------------------------------
  // TEST: methodNotFound
  // -------------------------------------------------------
  test('methodNotFound should return 404 and log error', () => {
    methodNotFound(req, res);

    expect(logger.error).toHaveBeenCalledWith(
      'the url you are trying to reach is not hosted on our server'
    );

    expect(res.status).toHaveBeenCalledWith(404);

    expect(res.json).toHaveBeenCalledWith({
      statusCode: 404,
      message: 'the url you are trying to reach is not hosted on our server',
      meta: {},
      data: {},
    });
  });

  // -------------------------------------------------------
  // TEST: addLogIdInRequest - Non Auth Route (should include body)
  // -------------------------------------------------------
  test('addLogIdInRequest should assign UUID, log request, and call next()', () => {
    addLogIdInRequest(req, res, next);

    // UUID added
    expect(req.identifier).toBe('mock-uuid-123');

    // log() called
    expect(logger.log).toHaveBeenCalled();

    const loggedData = logger.log.mock.calls[0][0];

    // Body SHOULD exist for non-auth URL
    expect(loggedData.body).toEqual({ a: 1 });

    expect(loggedData.url).toBe('/test/url');
    expect(loggedData.method).toBe('GET');

    // next was called
    expect(next).toHaveBeenCalled();
  });

  // -------------------------------------------------------
  // TEST: addLogIdInRequest - Auth Route (body should be removed)
  // -------------------------------------------------------
  test('addLogIdInRequest should not include body for /auth/ routes', () => {
    req.originalUrl = '/auth/login';
    req.body = { password: 'secret' };

    addLogIdInRequest(req, res, next);

    const loggedData = logger.log.mock.calls[0][0];

    // Body SHOULD BE REMOVED
    expect(loggedData.body).toBeUndefined();

    expect(loggedData.url).toBe('/auth/login');
    expect(loggedData.method).toBe('GET');
  });

  // -------------------------------------------------------
  // TEST: addLogIdInRequest - Should include IP correctly
  // -------------------------------------------------------
  test('addLogIdInRequest should include IP address from req.ip', () => {
    req.ip = '55.55.55.55';

    addLogIdInRequest(req, res, next);

    const loggedData = logger.log.mock.calls[0][0];

    expect(loggedData.ip).toBe('55.55.55.55');
  });

  // -------------------------------------------------------
  // TEST: addLogIdInRequest - Fallback to x-forwarded-for
  // -------------------------------------------------------
  test('addLogIdInRequest should use x-forwarded-for when present', () => {
    req.headers['x-forwarded-for'] = '100.100.100.100';
    req.ip = undefined;

    addLogIdInRequest(req, res, next);

    const loggedData = logger.log.mock.calls[0][0];

    expect(loggedData.ip).toBe('100.100.100.100');
  });
});
