import { logger } from './logger.js';
import { V2_ERROR_CODES } from '../constants/index.js';

// const API_VERSION_V1 = 'v1';

const sendSuccess = (
  res,
  data = {},
  message = '',
  status = 200,
  total,
  page,
) => {
  const requestId = res.req?.identifier || null;
  let body = {
    success: true,
    statusCode: status,
    // apiVersion: API_VERSION_V2,
    requestId,
    message: message || '',
    data: data ?? {},
    meta: {},
  };

  if (message) {
    body.meta.message = message;
  }
  if (data) {
    body.data = data;
  }
  if (total) {
    body = { ...body, total };
  }
  if (page) {
    body = { ...body, page };
  }
  if (res.req.method == 'GET') {
    logger.info(message, { status });
  } else {
    logger.info(message, { status, data: body.data });
  }
  return res.status(status).json(body);
};

const sendNewSuccess = (res, Data = {}, message = '', status = 200) => {
  const finalRes = {
    message: message || '',
    statusCode: status,
    // apiVersion: API_VERSION_V1,
    data: Data || {},
  };
  logger.info(message, { status, data: finalRes.data });
  return res.status(200).json(finalRes);
};

const sendError = (
  res,
  message,
  statusCode = 400,
  code = V2_ERROR_CODES.ERROR,
  details,
) => {
  const requestId = res.req?.identifier || null;
  const body = {
    success: false,
    statusCode: statusCode,
    requestId,
    error: {
      code: code || V2_ERROR_CODES.ERROR,
      message: message || 'An error occurred',
    },
    additionalInfo: {},
  };

  if (details && typeof details === 'object') {
    body.error.details = details;
  }

  logger.error('v2 error response', {
    // apiVersion: API_VERSION_V2,
    statusCode,
    code: body.error.code,
    message: body.error.message,
    requestId,
  });
  return res.status(statusCode).json(body);
};

export {
  sendSuccess,
  sendError,
  sendNewSuccess,
  // API_VERSION_V2,
};
