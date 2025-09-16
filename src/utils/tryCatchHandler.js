import { logger } from './logger.js';

const tryCatchHandler = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (error) {
    logger.error(error.message || 'An error occurred in route handler');
    return next(error);
  }
};

export default tryCatchHandler;
