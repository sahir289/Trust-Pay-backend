import { HTTPError, CustomError } from '../utils/appErrors.js';
import { logger } from '../utils/logger.js';

// eslint-disable-next-line no-unused-vars
const errorHandler = (error, req, res, next) => {
  let statusCode = 500;
  let message = 'Server encountered a problem';

  // Default safe object for client
  const errResponse = {
    statusCode,
    message,
  };

  console.error('Getting Error in error handler ', {
    message: error?.message,
    stack: error?.stack,
    name: error?.name,
    code: error?.code,
    response: error?.response?.data ? 'response.data exists' : undefined,
  });
  logger.error('Getting Error in error handler', {
    message: error?.message,
    stack: error?.stack,
    name: error?.name,
    code: error?.code,
    response: error?.response?.data ? 'response.data exists' : undefined,
  })

  if (error instanceof HTTPError) {
    statusCode = error.statusCode;
    errResponse.statusCode = error.statusCode;
    errResponse.name = error.name;
    errResponse.message = error.message;
  } else if (error instanceof CustomError) {
    statusCode = error.statusCode || statusCode;
    errResponse.statusCode = statusCode;
    errResponse.message = error.message || message;
    if (error.code) errResponse.code = error.code;
  } else if (error) {
    errResponse.message = error.message || message;
    if (error.code) errResponse.code = error.code;
    if (error.type) errResponse.type = error.type;

    if (error.response?.data) {
      const data = error.response.data;
      errResponse.type = data.type || 'error';
      errResponse.code = data.code || 'unknown_error';
      errResponse.message = data.message || message;
    }
  }

  res.status(statusCode).json({ error: errResponse });
};


export default errorHandler;
