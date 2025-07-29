import { HTTPError, CustomError } from '../utils/appErrors.js';
import { logger } from '../utils/logger.js';

// eslint-disable-next-line no-unused-vars
const errorHandler = (error, req, res, next) => {
  logger.error(error);
  let statusCode = 500;
  let message = 'Server encountered a problem';
  let err = {
    message,
    statusCode,
  };

  if (error && error instanceof HTTPError) {
    statusCode = error.statusCode;
    message = error.message;
    // Custom message for DbError (502)
    if (error.name === 'DbError' || statusCode === 502) {
      message = 'The server is experiencing database issues or is temporarily unavailable. Please try again later.';
    }
    err = {
      ...err,
      statusCode: error.statusCode,
      name: error.name,
      message,
    };
  } else if (error && error instanceof CustomError) {
    statusCode = error.statusCode || statusCode;
    err = {
      ...error,
      message: error.message || message,
    };
  } else if (error) {
    // Check for timeout error
    if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
      statusCode = 504;
      message = 'The request timed out. Please check your connection and try again.';
    }
    err = { ...error, message };
  }

  const finalRes = {};
  finalRes.error = { ...err };

  res.status(statusCode).json(finalRes);
};

export default errorHandler;
