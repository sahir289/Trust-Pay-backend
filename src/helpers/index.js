import axios from 'axios';
import config from '../config/config.js';
import { logoutSet } from '../middlewares/auth.js';
import { AuthenticationError } from '../utils/appErrors.js';
import { verifyToken } from '../utils/auth.js';
import { logger } from '../utils/logger.js';
import { BadRequestError } from '../utils/appErrors.js';
import { invalidateCompanyCacheByPrefix } from '../utils/controllerCache.js';

// ============================================
// REUSABLE UTILITIES - Extracted from PayIn/PayOut
// ============================================

/**
 * Extract client IP address from request
 * Handles x-forwarded-for header, localhost fallback, and IPv6 loopback
 * @param {Object} req - Express request object
 * @param {string} fallbackIp - Optional fallback IP for localhost testing
 * @returns {string} Client IP address
 */
export const extractClientIp = (req, fallbackIp = null) => {
  const TestingIp = fallbackIp || process.env.LOCAL_IP;
  
  // Handle x-forwarded-for header (may contain multiple IPs)
  let ip = req.headers?.['x-forwarded-for'];
  if (ip) {
    // Take first IP if multiple IPs are present
    ip = ip.split(',')[0]?.trim();
  }
  
  // Fallback to connection remoteAddress or req.ip
  if (!ip) {
    ip = req.connection?.remoteAddress || req.ip;
  }
  
  // Handle IPv6 localhost loopback
  if (ip === '::1' || ip === '::ffff:127.0.0.1') {
    return TestingIp;
  }
  
  return ip;
};

/**
 * Create a cache invalidator function for a specific prefix
 * @param {string} prefix - Cache key prefix (e.g., 'payin:read:', 'payout:read:')
 * @param {string} label - Optional label for logging
 * @returns {Function} Cache invalidation function
 */
export const createCacheInvalidator = (prefix, label = 'cache') => {
  return async (companyId) => {
    if (!companyId) return;
    await invalidateCompanyCacheByPrefix(companyId, prefix, `${label} cache`);
  };
};

// ============================================
// EXISTING HELPER FUNCTIONS
// ============================================

// Function to calculate balances based on role
export const calculateBalances = (
  calc,
  prevCalc,
  isMerchant,
  isReverse,
  amount = 0,
) => {
  const baseCalculation =
    calc.total_payin_amount -
    calc.total_payout_amount -
    (calc.total_payin_commission -
      calc.total_payout_commission +
      calc.total_reverse_payout_commission) -
    calc.total_chargeback_amount +
    calc.total_reverse_payout_amount;
  return {
    currentBalance: isMerchant
      ? isReverse
        ? baseCalculation - calc.total_settlement_amount
        : baseCalculation + calc.total_settlement_amount
      : isReverse
        ? baseCalculation + calc.total_settlement_amount
        : baseCalculation - calc.total_settlement_amount,

    netBalance:
      prevCalc.net_balance +
      (isMerchant
        ? isReverse
          ? +amount - calc.total_settlement_amount
          : -amount + calc.total_settlement_amount
        : isReverse
          ? +amount + calc.total_settlement_amount
          : -amount - calc.total_settlement_amount),
  };
};

export const calculateCommission = (amount, percentage) => {
  const numAmount = Number(amount);
  const percent = Number(percentage);
  return (numAmount * percent) / 100;
};

export const calculateTwoNumbers = (data1, data, operator) => {
  const numAmount = Number(data1);
  const numAmount1 = Number(data);
  if (isNaN(numAmount)) {
    throw new BadRequestError('Invalid first amount');
  }
  if (isNaN(numAmount1)) {
    throw new BadRequestError('Invalid second amount');
  }
  if (operator === '+') {
    return numAmount + numAmount1;
  } else if (operator === '-') {
    return numAmount - numAmount1;
  } else if (operator === '/') {
    return numAmount / numAmount1;
  } else {
    throw new BadRequestError('Invalid operator. Use "+" or "-"');
  }
};

export const calculateDuration = (createdAt) => {
  const durMs = new Date() - new Date(createdAt);
  const durSeconds = Math.floor((durMs / 1000) % 60)
    .toString()
    .padStart(2, '0');
  const durMinutes = Math.floor((durMs / (1000 * 60)) % 60)
    .toString()
    .padStart(2, '0');
  const durHours = Math.floor((durMs / (1000 * 60 * 60)) % 24)
    .toString()
    .padStart(2, '0');
  const duration = `${durHours}:${durMinutes}:${durSeconds}`;
  return duration;
};

export const getTelegramFilePath = async (fileId) => {
  try {
    if (!fileId) {
      logger.error('No telegram photo file id found!');
      return;
    }

    if (!config.telegramOcrBotToken) {
      logger.error('Telegram Bot Token not foun!');
      return;
    }

    const url = `https://api.telegram.org/bot${config.telegramOcrBotToken}/getFile?file_id=${fileId}`;
    const res = await axios.get(url);
    return res.data.result.file_path;
  } catch (error) {
    logger.error('Error while fetching telegram file path', error.message);
    console.error('Error while fetching telegram file path', error.message);
    throw error;
  }
};

export const getTelegramImageBase64 = async (filePath) => {
  try {
    if (!filePath) {
      logger.error('No telegram photo file path found!');
      return;
    }

    if (!config.telegramOcrBotToken) {
      logger.error('Telegram Bot Token not foun!');
      return;
    }
    const url = `https://api.telegram.org/file/bot${config.telegramOcrBotToken}/${filePath}`;
    const res = await axios.get(url, {
      responseType: 'arraybuffer',
    });

    return globalThis.Buffer.from(res.data, 'binary').toString('base64');
  } catch (error) {
    logger.error('Error while fetching telegram file path', error.message);
    console.error('Error while fetching telegram file path', error.message);
    throw error;
  }
};

export const getImageContentFromOCr = async (image) => {
  try {
    if (!image) {
      logger.log('No image provided for OCR!');
      return;
    }

    const res = await axios.post(`${config.ocr.url}`, {
      image,
    });

    if (res.data.status === 'failure') {
      logger.log('Unable to get content from image with ocr', res.data);
      return;
    }

    const data = res.data?.data || {};

    return {
      amount: data.amount?.replace(',', ''),
      utr: data.transaction_id,
      bankName: data.bank_name,
      timeStamp: data.timestamp,
    };
  } catch (error) {
    logger.error('Error while fetching content from image', error.message);
    console.error('Error while fetching content from image', error);
    throw error;
  }
};

// Helper function to convert a readable stream to a buffer
export const streamToBase64 = (readableStream) => {
  try {
    return new Promise((resolve, reject) => {
      const chunks = [];
      readableStream.on('data', (chunk) => chunks.push(chunk));
      readableStream.on('end', () => {
        const buffer = globalThis.Buffer.concat(chunks);
        const base64 = buffer.toString('base64');
        resolve(base64);
      });
      readableStream.on('error', reject);
    });
  } catch (error) {
    logger.error('Error while converting stream to base64', error.message);
    console.error('Error while converting stream to base64', error);
    throw error;
  }
};

export async function streamToBuffer(stream) {
  try {
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const buffer = globalThis.Buffer.concat(chunks);
    return buffer;
  } catch (error) {
    logger.error('Error while converting stream to buffer', error.message);
    console.error('Error while converting stream to buffer', error);
    throw error;
  }
}

// export const filterResponse = async (data, key) => {
//     if (typeof data === 'object' && data !== null && key in data) {
//         logger.log({[key]: data[key]},"datakey1")

//       return { [key]: data[key] };
//     }
//     return {};
//   }

export const filterResponse = (data, keys) => {
  try {
    if (Array.isArray(data)) {
      logger.log('Data is an array');

      return data.map((item) => {
        const filteredItem = {};
        keys.forEach((key) => {
          if (Object.prototype.hasOwnProperty.call(item, key)) {
            filteredItem[key] = item[key];
          } else {
            logger.error(item, key, 'Key not found in object');
          }
        });
        return filteredItem;
      });
    } else if (typeof data === 'object' && data !== null) {
      logger.log('Data is an object');

      const filteredItem = {};
      keys.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          filteredItem[key] = data[key];
        } else {
          logger.warn('Key not found in object');
        }
      });
      return filteredItem;
    } else {
      logger.error('Data is neither an array nor an object');
      return null;
    }
  } catch (error) {
    logger.error('Error while filtering response', error.message);
    console.error('Error while filtering response', error);
    throw error;
  }
};

export const decodeAuthToken = (token) => {
  if (!token) {
    return {};
  }

  if (logoutSet.has(token)) {
    throw new AuthenticationError('Token expired or User logged out.');
  }

  return verifyToken(token);
};
