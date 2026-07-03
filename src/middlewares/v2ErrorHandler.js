import { HTTPError, CustomError } from '../utils/appErrors.js';
import { sendError } from '../utils/responseHandlers.js';
import { logger } from '../utils/logger.js';
import { STATUS_ERROR_CODES, V2_ERROR_CODES } from '../constants/index.js';

function resolveStatusCode(error) {
  if (error?.isAxiosError) {
    return error.response?.status || 502;
  }
  if (error instanceof HTTPError) {
    return error.statusCode || 500;
  }
  if (error instanceof CustomError) {
    return error.status || error.statusCode || 500;
  }
  if (typeof error?.statusCode === 'number') {
    return error.statusCode;
  }
  if (typeof error?.status === 'number') {
    return error.status;
  }
  return 500;
}

/**
 * v2 error-handling middleware.
 *
 * Mounted at the END of the v2 router so every error thrown from a v2 route (or
 * forwarded via next(err) by tryCatchHandler / isAuthenticated) is returned in
 * the standardized v2 envelope (sendV2Error) instead of falling through to the
 * v1 global error handler. The v1 handler and its response shape are untouched.
 *
 * Must keep the 4-arg signature for Express to treat it as an error handler.
 */
const v2ErrorHandler = (error, req, res, next) => {
  // If the response has already started, defer to Express' default handling.
  if (res.headersSent) {
    return next(error);
  }

  const statusCode = resolveStatusCode(error);
  const code = STATUS_ERROR_CODES[statusCode] || V2_ERROR_CODES.ERROR;

  // Never leak internal details on 5xx; surface client-error messages as-is.
  const message =
    statusCode >= 500 ? 'Internal server error' : error?.message || 'Request failed';

  logger.error('v2 error handler', {
    statusCode,
    code,
    name: error?.name,
    message: error?.message,
    requestId: req?.identifier,
  });

  return sendError(res, message, statusCode, code);
};

export default v2ErrorHandler;
