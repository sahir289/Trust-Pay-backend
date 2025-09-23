import crypto from 'crypto';
import axios from 'axios';
import { logger } from '../utils/logger.js';
import config from '../config/config.js';

export const generateHash = (body) => {
  const salt = config.zentechind.salt;
  const collection_id = config.zentechind.collectionId;
  const { amount, order_id } = body;
  const stringToHash = `${collection_id}|${amount}|${order_id}|${salt}`;
  return crypto.createHash('sha512').update(stringToHash).digest('hex');
};

export const createZenTechIndTransaction = async (deposit, amount) => {
  try {
    const body = {
      collection_id: config.zentechind.collectionId,
      order_id: deposit.merchant_order_id,
      amount,
      user_id: deposit.user,
    };
    const hash = generateHash(body);
    console.log(hash, "hash");
    const requestBody = { ...body, hash };
    const API_URL = config.zentechind.url;
    const response = await axios.post(API_URL, requestBody, {
      headers: { 'Content-Type': 'application/json' },
    });
    return response.data;
  } catch (error) {
    logger.error(
      'Error creating ZenTechInd transaction:',
      error.response?.data || error.message,
    );
    throw error;
  }
};
