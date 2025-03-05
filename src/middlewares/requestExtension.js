import { generateUUID } from '../utils/generateUUID.js';
import { logger } from '../utils/logger.js';
const methodNotFound = (req, res, next) => {
  logger.error('the url you are trying to reach is not hosted on our server');
  const err = new Error('Not Found');
  err.status = 404;
  res.status(err.status).json({
    type: 'error',
    message: 'the url you are trying to reach is not hosted on our server',
  });
  next(err);
};

const addLogIdInRequest = (req, res, next) => {
  req.identifier = generateUUID();
  const { identifier, url, body } = req;

  let logString = `Request uuid [${identifier}] :: ${url} :: ${req.headers['user-agent']}`;
  if (url && !url.includes('/auth/')) {
    logString = `${logString} :: ${JSON.stringify(body)}`;
  }

  logger.log(logString);
  next();
};

export { methodNotFound, addLogIdInRequest };
