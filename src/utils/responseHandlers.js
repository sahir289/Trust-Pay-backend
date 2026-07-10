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
    timestamp: new Date().toISOString(),
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
    // apiVersion: API_VERSION_V2,
    requestId,
    timestamp: new Date().toISOString(),
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
    apiVersion: API_VERSION_V2,
    statusCode,
    code: body.error.code,
    message: body.error.message,
    requestId,
  });
  return res.status(statusCode).json(body);
};

// ---------------------------------------------------------------------------
// V2 response envelope
// ---------------------------------------------------------------------------
// V2 standardizes on a single, stable, self-describing shape for every
// response so merchants can rely on a consistent contract:
//   success     -> boolean
//   apiVersion  -> 'v2'
//   requestId   -> per-request correlation id (set by addLogIdInRequest)
//   timestamp   -> ISO-8601
//   data/error  -> payload on success / structured error on failure
//   pagination  -> optional { page, pageSize, total }
// The V1 helpers above are intentionally left untouched for backward
// compatibility; only new /v2 endpoints should use these.
const API_VERSION_V2 = 'v2';

const sendV2Success = (
  res,
  data = {},
  message = '',
  status = 200,
  pagination,
) => {
  const requestId = res.req?.identifier || null;
  const body = {
    success: true,
    statusCode: status,
    // apiVersion: API_VERSION_V2,
    requestId,
    timestamp: new Date().toISOString(),
    message: message || '',
    data: data ?? {},
  };

  if (pagination && typeof pagination === 'object') {
    body.pagination = pagination;
  }

  logger.info(message || 'v2 success', {
    apiVersion: API_VERSION_V2,
    status,
    requestId,
  });
  return res.status(status).json(body);
};

const sendV2Error = (
  res,
  message,
  status = 400,
  code = V2_ERROR_CODES.ERROR,
  details,
) => {
  const requestId = res.req?.identifier || null;
  const body = {
    success: false,
    statusCode: status,
    // apiVersion: API_VERSION_V2,
    requestId,
    timestamp: new Date().toISOString(),
    error: {
      code: code || V2_ERROR_CODES.ERROR,
      message: message || 'An error occurred',
    },
  };

  if (details && typeof details === 'object') {
    body.error.details = details;
  }

  logger.error('v2 error response', {
    apiVersion: API_VERSION_V2,
    status,
    code: body.error.code,
    message: body.error.message,
    requestId,
  });
  return res.status(status).json(body);
};

export {
  sendSuccess,
  sendError,
  sendNewSuccess,
  sendV2Success,
  sendV2Error,
  API_VERSION_V2,
};
