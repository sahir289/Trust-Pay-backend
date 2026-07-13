import { HTTPError, CustomError } from '../utils/appErrors.js';
import { logger } from '../utils/logger.js';
import { STATUS_ERROR_CODES, V2_ERROR_CODES } from '../constants/index.js';

// const API_VERSION_V1 = 'v1';

// eslint-disable-next-line no-unused-vars
const errorHandler = (error, req, res, next) => {
  let statusCode = 500;
  let message = 'Server encountered a problem';

  const additionalInfo = {};

  // Handle Axios / third-party API errors
  if (error.isAxiosError) {
    const { response, config, code } = error;
    statusCode = response?.status || 502;

    message =
      response?.data?.message ||
      response?.statusText ||
      error.message ||
      'Third-party API error';

    additionalInfo.type = 'AxiosError';
    additionalInfo.code = code || 'AXIOS_ERROR';

    // Include API metadata (if captured by interceptors)
    additionalInfo.api = {
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
    message = error.message;
    additionalInfo.name = error.name;
  } else if (error instanceof CustomError) {
    statusCode = error.status || error.statusCode || statusCode;
    message = error.message || message;
    if (error.code) additionalInfo.code = error.code;
  } else if (error) {
    message = error.message || message;
    if (error.code) additionalInfo.code = error.code;
    if (error.type) additionalInfo.type = error.type;

    if (error.response?.data) {
      const data = error.response.data;
      additionalInfo.type = data.type || 'error';
      additionalInfo.code = data.code || 'unknown_error';
      message = data.message || message;
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

  const body = {
    success: false,
    statusCode,
    // apiVersion: API_VERSION_V1,
    requestId: req?.identifier || null,
    timestamp: new Date().toISOString(),
    error: {
      code: STATUS_ERROR_CODES[statusCode] || V2_ERROR_CODES.ERROR,
      message,
    },
    additionalInfo,
  };

  res.status(statusCode).json(body);
};

export default errorHandler;
