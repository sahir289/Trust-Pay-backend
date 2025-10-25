import axios from 'axios';
import { logger } from './logger.js';

/**
 * Reusable HTTP request helper
 * Supports GET, POST, PUT, DELETE with unified config.
 *
 * @param {string} method - HTTP method (get, post, put, delete)
 * @param {string} endpoint - API endpoint (relative to baseUrl)
 * @param {object} options - Optional: { params, data, headers, timeout }
 * @returns {Promise<any>} - Axios response data
 */

export const apiRequest = async (method, endpoint, options = {}) => {
  const { params = {}, data = {}, headers = {}, timeout = 15000 } = options;

  try {
    const response = await axios({
      method,
      url: `${process.env.BASE_URL || ''}${endpoint}`,
      headers,
      params: method.toLowerCase() === 'get' ? params : undefined,
      data: method.toLowerCase() !== 'get' ? data : undefined,
      timeout,
      maxRedirects: 3,
      validateStatus: (status) => status < 500, // Accept 4xx, reject 5xx
    });

    return response.data;
  } catch (error) {
    logger.error(
      `API ${method.toUpperCase()} ${endpoint} failed:`,
      error.message,
    );
    throw error;
  }
};

// Helper function for retry logic with exponential backoff
export const retryAxiosRequest = async (
  requestFn,
  maxRetries = 3,
  baseDelay = 1000,
) => {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await requestFn();
    } catch (error) {
      lastError = error;

      // Don't retry on 4xx errors (client errors) - only retry on network/server errors
      if (
        error.response &&
        error.response.status >= 400 &&
        error.response.status < 500
      ) {
        throw error;
      }

      if (attempt === maxRetries) {
        break;
      }

      // Log retry attempt
      logger.warn(
        `Request failed (attempt ${attempt}/${maxRetries}), retrying in ${baseDelay * Math.pow(2, attempt - 1)}ms:`,
        error.message,
      );

      // Exponential backoff: wait baseDelay * 2^(attempt-1) milliseconds
      await new Promise((resolve) =>
        setTimeout(resolve, baseDelay * Math.pow(2, attempt - 1)),
      );
    }
  }

  throw lastError;
};
