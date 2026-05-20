import { stringifyJSON } from "./index.js";

class HTTPError extends Error {
  statusCode = 500;
  name = '';

  constructor(message) {
    let errorMessage = '';
    if (message instanceof Object) {
      try {
        errorMessage = stringifyJSON(message);
      } catch (err) {
        errorMessage = 'Could not stringify message: ' + err.message;
      }
    } else {
      errorMessage = message;
    }

    super(errorMessage);
    Error.captureStackTrace(this, this.constructor);
    this.name = this.constructor.name;
  }
}

class HTTPClientError extends HTTPError {}

class HTTPServerError extends HTTPError {}

class BadRequestError extends HTTPClientError {
  statusCode = 400;

  constructor(message = 'Bad request') {
    super(message);
  }
}

class AuthenticationError extends HTTPClientError {
  statusCode = 401;

  constructor(message = 'Authorization Error') {
    super(message);
  }
}

class AccessDeniedError extends HTTPClientError {
  statusCode = 401;

  constructor(message = 'Access denied') {
    super(message);
  }
}

class NotFoundError extends HTTPClientError {
  statusCode = 404;

  constructor(message = 'Not found') {
    super(message);
  }
}

class DuplicateDataError extends HTTPClientError {
  statusCode = 409;

  constructor(message = 'Conflict') {
    super(message);
  }
}

class InternalServerError extends HTTPServerError {
  statusCode = 500;

  constructor(message = 'Server encountered a problem') {
    super(message);
  }
}

class DbError extends HTTPServerError {
  statusCode = 502;

  constructor(message = 'Database error', options = {}) {
    super(message);
    this.code = options.code;
    this.cause = options.cause;
    this.meta = options.meta;
  }
}

const parseValidationMessage = (errorDetails) => {
  // Joi error: { details: [{ message }, ...] }
  if (errorDetails && Array.isArray(errorDetails.details)) {
    let errString = '';
    errorDetails.details.forEach((d) => {
      let msg = typeof d?.message === 'string' ? d.message : String(d?.message ?? '');
      msg = msg.replace(/"/g, '');
      errString = errString ? `${errString}, ${msg}` : msg;
    });
    return errString || 'Validation failed';
  }
  // Joi error instance may also expose `.message` directly
  if (errorDetails && typeof errorDetails.message === 'string') {
    return errorDetails.message.replace(/"/g, '');
  }
  // Fallback: plain string or anything else — don't crash the server
  if (typeof errorDetails === 'string') {
    return errorDetails;
  }
  return 'Validation failed';
};
class ValidationError extends BadRequestError {
  constructor(message) {
    super(parseValidationMessage(message));
  }
}

export class CustomError extends Error {
  constructor(status, message, additionalInfo) {
    super(message);
    this.status = status;
    this.message = message;
    this.additionalInfo = additionalInfo;
  }
}

export {
  HTTPError,
  HTTPClientError,
  HTTPServerError,
  BadRequestError,
  AuthenticationError,
  AccessDeniedError,
  NotFoundError,
  DuplicateDataError,
  DbError,
  InternalServerError,
  ValidationError,
};
