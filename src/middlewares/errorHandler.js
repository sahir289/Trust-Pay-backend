import { HTTPError, CustomError } from '../utils/appErrors.js';
import { logger } from '../utils/logger.js';

// eslint-disable-next-line no-unused-vars
const errorHandler = (error, req, res, next) => {
  let statusCode = 500;
  let message = 'Server encountered a problem';

  const errResponse = {
    statusCode,
    message,
  };

  // Handle Axios / third-party API errors
  if (error.isAxiosError) {
    const { response, config, code } = error;
    statusCode = response?.status || 502;

    errResponse.type = 'AxiosError';
    errResponse.code = code || 'AXIOS_ERROR';
    errResponse.message =
      response?.data?.message ||
      response?.statusText ||
      error.message ||
      'Third-party API error';

    // Include API metadata (if captured by interceptors)
    errResponse.api = {
      method: config?.method?.toUpperCase(),
      url: config?.url,
      status: response?.status,
      duration: config?.metadata?.duration || null,
      retries: config?.metadata?.retryCount || 0,
    };

    // Trimmed response data for logging
    const dataStr =
      typeof response?.data === 'object'
        ? JSON.stringify(response.data).slice(0, 800)
        : String(response?.data || '').slice(0, 800);

    console.error('AXIOS ERROR:', {
      url: config?.url,
      status: response?.status,
      duration: config?.metadata?.duration,
      retries: config?.metadata?.retryCount,
      message: error.message,
      data: dataStr + (dataStr.length === 800 ? '... [truncated]' : ''),
    });

    logger.error('AXIOS ERROR: ', {
      url: config?.url,
      status: response?.status,
      duration: config?.metadata?.duration,
      retries: config?.metadata?.retryCount,
      message: error.message,
      data: dataStr + (dataStr.length === 800 ? '... [truncated]' : ''),
    });
  }

  // Handle Custom / HTTP errors
  else if (error instanceof HTTPError) {
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


  // Log non-Axios errors
  if (!error.isAxiosError) {
    console.error('ERROR HANDLER LOG:', {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
      code: error?.code,
      //response.data exists is a safe placeholder for large objects. Prevents recursive or huge data from crashing logs. Still tells you response.data was there
      response: error?.response?.data ? 'response.data exists' : undefined,
    });

    logger.error('ERROR HANDLER LOG', {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
      code: error?.code,
      response: error?.response?.data ? 'response.data exists' : undefined,
    });
  }

  res.status(statusCode).json({ error: errResponse });
};

export default errorHandler;
