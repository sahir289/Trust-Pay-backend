// // __tests__/rateLimiter.test.js
// import { rateLimitMiddleware, rateLimitMiddlewareBot } from '../middlewares/rateLimiter.js';
// import { publishBankResponse } from '../utils/rabbitmq-bank-response.js';
// import { logger } from '../utils/logger.js';
// import { Role } from '../constants/index.js';

// jest.mock('rate-limiter-flexible', () => {
//   return {
//     RateLimiterRedis: jest.fn().mockImplementation(() => ({
//       consume: jest.fn(),
//     })),
//     RateLimiterMemory: jest.fn().mockImplementation(() => ({
//       consume: jest.fn(),
//     })),
//   };
// });

// jest.mock('../utils/rabbitmq-bank-response.js', () => ({
//   publishBankResponse: jest.fn(),
// }));

// jest.mock('../utils/logger.js', () => ({
//   logger: {
//     warn: jest.fn(),
//     error: jest.fn(),
//   },
// }));

// describe('RateLimiter Middleware', () => {
//   let mockReq, mockRes, mockNext, rateLimiter;

//   beforeEach(() => {
//     jest.clearAllMocks();

//     // Re-import limiter so it uses mocked RateLimiter
//     rateLimiter = require('rate-limiter-flexible').RateLimiterRedis.mock.results[0].value;

//     mockReq = {
//       ip: '127.0.0.1',
//       user: {
//         user_id: '123',
//         user_name: 'TestUser',
//         company_id: 'c1',
//         role: 'USER',
//       },
//       body: { body: { foo: 'bar' } },
//       headers: { 'x-auth-token': 'token123' },
//     };

//     mockRes = {
//       status: jest.fn().mockReturnThis(),
//       json: jest.fn(),
//     };

//     mockNext = jest.fn();
//   });

//   describe('rateLimitMiddleware', () => {
//     it('should call next when rate limit not exceeded', async () => {
//       rateLimiter.consume.mockResolvedValueOnce({ remainingPoints: 5 });

//       await rateLimitMiddleware(mockReq, mockRes, mockNext);

//       expect(rateLimiter.consume).toHaveBeenCalledWith('123');
//       expect(mockNext).toHaveBeenCalled();
//       expect(mockRes.status).not.toHaveBeenCalled();
//     });

//     it('should return 429 and publish bank response when rate limit exceeded', async () => {
//       rateLimiter.consume.mockRejectedValueOnce({ msBeforeNext: 5000 });

//       await rateLimitMiddleware(mockReq, mockRes, mockNext);

//       expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Rate limit exceeded for key: 123'), expect.any(Object));
//       expect(publishBankResponse).toHaveBeenCalledWith({
//         payload: { foo: 'bar' },
//         role: 'USER',
//         user_name: 'TestUser',
//         company_id: 'c1',
//         user_id: '123',
//       });
//       expect(mockRes.status).toHaveBeenCalledWith(429);
//       expect(mockRes.json).toHaveBeenCalledWith({
//         success: false,
//         message: 'Too many requests. Please try again later.',
//       });
//     });
//   });

//   describe('rateLimitMiddlewareBot', () => {
//     it('should call next when rate limit not exceeded', async () => {
//       rateLimiter.consume.mockResolvedValueOnce({ remainingPoints: 5 });

//       await rateLimitMiddlewareBot(mockReq, mockRes, mockNext);

//       expect(rateLimiter.consume).toHaveBeenCalledWith('123');
//       expect(mockNext).toHaveBeenCalled();
//       expect(mockRes.status).not.toHaveBeenCalled();
//     });

//     it('should return 429 and publish bank response for bot when rate limit exceeded', async () => {
//       rateLimiter.consume.mockRejectedValueOnce({ msBeforeNext: 3000 });

//       await rateLimitMiddlewareBot(mockReq, mockRes, mockNext);

//       expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Rate limit exceeded for key: 123'), expect.any(Object));
//       expect(publishBankResponse).toHaveBeenCalledWith({
//         payload: { foo: 'bar' },
//         x_auth_token: 'token123',
//         role: Role.BOT,
//       });
//       expect(mockRes.status).toHaveBeenCalledWith(429);
//       expect(mockRes.json).toHaveBeenCalledWith({
//         success: false,
//         message: 'Too many requests. Please try again later.',
//       });
//     });
//   });
// });
