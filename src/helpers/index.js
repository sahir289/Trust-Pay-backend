import axios from 'axios';
import config from '../config/config.js';
import { logoutSet } from '../middlewares/auth.js';
import { AuthenticationError } from '../utils/appErrors.js';
import { verifyToken } from '../utils/auth.js';
import { logger } from '../utils/logger.js';

// Function to calculate balances based on role
export const calculateBalances = (calc, prevCalc, isMerchant, isReverse, amount = 0) => {
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
      : isReverse ? baseCalculation + calc.total_settlement_amount
      : baseCalculation - calc.total_settlement_amount,

    netBalance:
      prevCalc.net_balance +
      (isMerchant ? isReverse
        ? + amount - calc.total_settlement_amount
        : - amount + calc.total_settlement_amount
        : isReverse ? + amount + calc.total_settlement_amount
        : - amount - calc.total_settlement_amount) ,
  };
};

export const calculateCommission = (amount, percentage) => {
  const numAmount = Number(amount);
  return (numAmount * percentage) / 100;
};

export const calculateDuration = (createdAt) => {
  const durMs = new Date() - createdAt;
  const durSeconds = Math.floor((durMs / 1000) % 60)
    .toString()
    .padStart(2, '0');
  const durMinutes = Math.floor((durSeconds / 60) % 60)
    .toString()
    .padStart(2, '0');
  const durHours = Math.floor((durMinutes / 60) % 24)
    .toString()
    .padStart(2, '0');
  const duration = `${durHours}:${durMinutes}:${durSeconds}`;
  return duration;
};

export const getTelegramFilePath = async (fileId) => {
  if (!fileId) {
    console.log('No telegram photo file id found!');
    return;
  }

  if (!config.telegramOcrBotToken) {
    console.log('Telegram Bot Token not foun!');
    return;
  }

  const url = `https://api.telegram.org/bot${config.telegramOcrBotToken}/getFile?file_id=${fileId}`;
  const res = await axios.get(url);
  return res.data.result.file_path;
};

export const getTelegramImageBase64 = async (filePath) => {
  if (!filePath) {
    console.log('No telegram photo file path found!');
    return;
  }

  if (!config.telegramOcrBotToken) {
    console.log('Telegram Bot Token not foun!');
    return;
  }
  const url = `https://api.telegram.org/file/bot${config.telegramOcrBotToken}/${filePath}`;
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
  });

  return globalThis.Buffer.from(res.data, 'binary').toString('base64');
};

export const getImageContentFromOCr = async (image) => {
  if (!image) {
    console.log('No image provided for OCR!');
    return;
  }

  const res = await axios.post('http://34.228.18.32:8000/ocr', {
    image,
  });

  if (res.data.status === 'failure') {
    console.log('Unable to get content from image with ocr', res.data);
    return;
  }

  const data = res.data?.data || {};

  return {
    amount: data.amount?.replace(',', ''),
    utr: data.transaction_id,
    bankName: data.bank_name,
    timeStamp: data.timestamp,
  };
};

// Helper function to convert a readable stream to a buffer
export const streamToBase64 = (readableStream) => {
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
};

// export const filterResponse = async (data, key) => {
//     console.log(data, key,"datakey")
//     if (typeof data === 'object' && data !== null && key in data) {
//         console.log({[key]: data[key]},"datakey1")

//       return { [key]: data[key] };
//     }
//     return {};
//   }

export const filterResponse = (data, keys) => {
  logger.log(data, keys, 'Initial check');

  if (Array.isArray(data)) {
    logger.log(data, keys, "Data is an array");

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
    logger.error(data, keys, 'Data is an object');

    const filteredItem = {};
    keys.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        filteredItem[key] = data[key];
      } else {
        logger.error(data, key, 'Key not found in object');
      }
    });
    return filteredItem;
  } else {
    logger.error(data, keys, 'Data is neither an array nor an object');
    return null;
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
