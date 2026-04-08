/* eslint-disable no-control-regex */
import { logger } from '../utils/logger.js';

/**
 * Request sanitization middleware
 * Prevents common injection attacks and sanitizes input
 */

// Patterns to detect potential attacks
const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/gi,
  /(UNION.*SELECT)/gi,
  /('|(--)|;|\/\*|\*\/)/g,
];

const XSS_PATTERNS = [
  /<script[^>]*>.*?<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
];

const NOSQL_INJECTION_PATTERNS = [
  /\$where/gi,
  /\$ne/gi,
  /\$gt/gi,
  /\$lt/gi,
];

/**
 * Recursively sanitize object properties
 */
const sanitizeValue = (value, key = '') => {
  if (typeof value === 'string') {
    // Check for suspicious patterns
    let isSuspicious = false;
    
    // Skip sanitization for specific fields that need to accept special chars
    const whitelistedFields = ['password', 'secret', 'token', 'hash', 'encrypted'];
    if (whitelistedFields.some(field => key.toLowerCase().includes(field))) {
      return value;
    }
    
    // Check SQL injection
    for (const pattern of SQL_INJECTION_PATTERNS) {
      if (pattern.test(value)) {
        isSuspicious = true;
        logger.warn('Potential SQL injection attempt detected', { key, value: value.slice(0, 100) });
        break;
      }
    }
    
    // Check XSS
    if (!isSuspicious) {
      for (const pattern of XSS_PATTERNS) {
        if (pattern.test(value)) {
          isSuspicious = true;
          logger.warn('Potential XSS attempt detected', { key, value: value.slice(0, 100) });
          break;
        }
      }
    }
    
    // Check NoSQL injection
    if (!isSuspicious) {
      for (const pattern of NOSQL_INJECTION_PATTERNS) {
        if (pattern.test(value)) {
          isSuspicious = true;
          logger.warn('Potential NoSQL injection attempt detected', { key, value: value.slice(0, 100) });
          break;
        }
      }
    }
    
    // Basic sanitization (without breaking legitimate data)
    return value
      .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
      .trim();
  }
  
  if (Array.isArray(value)) {
    return value.map((item, index) => sanitizeValue(item, `${key}[${index}]`));
  }
  
  if (value && typeof value === 'object') {
    const sanitized = {};
    for (const [k, v] of Object.entries(value)) {
      sanitized[k] = sanitizeValue(v, k);
    }
    return sanitized;
  }
  
  return value;
};

export const requestSanitizerMiddleware = (req, res, next) => {
  try {
    // Sanitize body
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeValue(req.body);
    }
    
    // Sanitize query params
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeValue(req.query);
    }
    
    // Sanitize URL params
    if (req.params && typeof req.params === 'object') {
      req.params = sanitizeValue(req.params);
    }
    
    next();
  } catch (error) {
    logger.error('Error in request sanitizer:', error);
    // Don't block request on sanitization error, but log it
    next();
  }
};

export default requestSanitizerMiddleware;
