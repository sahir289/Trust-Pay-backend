import { logger } from './logger.js';

const sendSuccess = (
  res,
  Data = {},
  message = "",
  status = 200,
  total,
  page,
) => {
  let finalRes = {
    error: {},
    meta: {},
    data: {},
  };

  if (message) {
    finalRes.meta.message = message;
  }
  if (Data) {
    finalRes.data = Data;
  }
  if (total) {
    finalRes = { ...finalRes, total };
  }
  if (page) {
    finalRes = { ...finalRes, page };
  }
  const data = finalRes.data;
  logger.info(message, 
    status,
    data,
  );

  return res.status(status).json(finalRes);
};

const sendNewSuccess = (
  res,
  Data = {},
  message = '',
  status = 200,
) => {
  const finalRes = {
    message: message || '',
    statusCode: status,
    data: Data || {},
  };
  const data = finalRes.data;
  logger.info(message, 
    status,
    data
  );
  return res.status(200).json(finalRes);
};

const sendError = (
  res,
  error,
  message,
  statusCode,
) => {
  const finalRes = {
    error: {},
    meta: {},
    data: {},
  };

  if (message) {
    finalRes.error.message = message;
  }
  if (error && typeof error === 'object' && Object.keys(error).length > 0) {
    finalRes.error = { ...error };
  }
  logger.error(message);
  return res.status(statusCode).json(finalRes);
};

export { sendSuccess, sendError, sendNewSuccess };
