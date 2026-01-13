import { logger } from '../utils/logger.js';

/**
 * Request timeout middleware to prevent hanging requests
 * Applies configurable timeouts based on route patterns
 */

const DEFAULT_TIMEOUT = 30000; // 30 seconds
const LONG_TIMEOUT = 120000; // 2 minutes for bulk operations

const TIMEOUT_CONFIG = {
  '/api/bulk': LONG_TIMEOUT,
  '/api/reports': LONG_TIMEOUT,
  '/api/settlement': LONG_TIMEOUT,
  '/api/bank-response/import': LONG_TIMEOUT,
  default: DEFAULT_TIMEOUT,
};

export const requestTimeoutMiddleware = (req, res, next) => {
  // Determine timeout based on route
  let timeout = DEFAULT_TIMEOUT;
  
  for (const [pattern, duration] of Object.entries(TIMEOUT_CONFIG)) {
    if (pattern !== 'default' && req.path.startsWith(pattern)) {
      timeout = duration;
      break;
    }
  }

  // Set timeout
  req.setTimeout(timeout, () => {
    logger.error('Request timeout exceeded', {
      path: req.path,
      method: req.method,
      timeout,
      ip: req.ip,
      user_id: req.user?.user_id,
    });

    if (!res.headersSent) {
      res.status(408).json({
        success: false,
        error: {
          statusCode: 408,
          message: 'Request timeout - operation took too long to complete',
          timeout: timeout / 1000,
        },
      });
    }
  });

  next();
};

export default requestTimeoutMiddleware;
