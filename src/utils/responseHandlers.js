import { logger } from './logger.js';

const sendSuccess = (
  res,
  data = undefined,
  message = undefined,
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
  if (data) {
    finalRes.data = data;
  }
  if (total) {
    finalRes = { ...finalRes, total };
  }
  if (page) {
    finalRes = { ...finalRes, page };
  }
  logger.info(finalRes);
  return res.status(status).json(finalRes);
};

const sendNewSuccess = (
  res,
  data = undefined,
  message = undefined,
  status = 200,

) => {
  const finalRes = {
    message: message || '',
    statusCode: status,
    data: data || {},
  };
  logger.info(finalRes);
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
