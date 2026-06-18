import crypto from 'crypto';
import axios from 'axios';
import { sendNewSuccess } from "../utils/responseHandlers.js";
import { logger } from "../utils/logger.js";
import config from "../config/config.js";
import { BadRequestError } from "../utils/appErrors.js";
const buildFreechipsExternalReference = (merchantOrderId) => {
  const raw = String(merchantOrderId || '').trim();
  if (raw && raw.length <= 20) {
    return raw;
  }
  const ts = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `FC${ts}${rand}`.slice(0, 20);
};

const encryptFreechipsPayoutData = (payload, secretKey, iv) => {
  try {
    const key = Buffer.from(secretKey, 'base64');
    const ivBuffer = Buffer.from(iv, 'utf8');

    const cipher = crypto.createCipheriv('aes-256-cbc', key, ivBuffer);
    cipher.setAutoPadding(true);

    let encrypted = cipher.update(JSON.stringify(payload), 'utf8', 'base64');
    encrypted += cipher.final('base64');

    return encrypted;
  } catch (error) {
    logger.error('Freechips payout encryption error:', error.message);
    throw new BadRequestError('Encryption failed for Freechips payout');
  }
};

export const getFreechipsWalletBalance = async (req, res) => {
  try {
    const freechipsConfig = config.freechips;
    if (!freechipsConfig) {
      throw new BadRequestError('Freechips payout configuration is missing for the company');
    }

    const {
      secretIvPayout,
      secretKeyPayout,
      secretCodePayout,
      secretVendorKeyPayout
    } = freechipsConfig;

    if (!secretIvPayout || !secretKeyPayout || !secretCodePayout || !secretVendorKeyPayout) {
      throw new BadRequestError('Freechips credentials are incomplete');
    }

    const providerConfig = config.freechips || config.FREECHIPS;
    if (!providerConfig?.baseUrl) {
      throw new BadRequestError('Freechips base URL not configured');
    }

    const url = `${providerConfig.baseUrl}/vendor/balance`;

    const payloadToEncrypt = { 
      "vendor_key": secretVendorKeyPayout 
    };

    const encryptedData = encryptFreechipsPayoutData(payloadToEncrypt, secretKeyPayout, secretIvPayout);

    const requestBody = {
      "secretCode": secretCodePayout, 
      "data": encryptedData 
    };

    // API Call
    const response = await axios.post(url, requestBody, {
      headers: { 'Content-Type': 'application/json' }, // 
      timeout: 15000
    });

    logger.info('Freechips wallet balance fetched successfully', {      
      balance: response.data?.balance // 
    });

    const successMsg = response.data?.message || "Wallet balance fetched successfully"; // 
    return sendNewSuccess(res, response.data, successMsg);

  } catch (error) {
    logger.error('Freechips Wallet Balance Error:', error.response?.data || error.message);
    throw error;
  }
};

export const createFreechipsPayout = async (result, payload, vendor_id, bankId) => {
  try {
    const freechipsConfig =  config.freechips || config.FREECHIPS;
    const url = `${freechipsConfig.baseUrl}/vendor/payouts`;
    if (!url) {
      throw new BadRequestError('FREECHIPS_PAYOUT_URL is missing in config');
    }
   const {
      secretIvPayout,
      secretKeyPayout,
      secretCodePayout,
      secretVendorKeyPayout,
      tpin
    } = freechipsConfig;
    if (!freechipsConfig) {
      throw new BadRequestError('Freechips payout configuration is missing');
    }
    const secret_key = secretKeyPayout;
    const iv = secretIvPayout;
    const secretCode = secretCodePayout;
    const vendor_key = secretVendorKeyPayout;

    if (!secret_key || !iv || !secretCode || !vendor_key || !tpin) {
      throw new BadRequestError('Freechips required credentials missing (secret_key, iv, secretCode, vendor_key, tpin)');
    }
    const externalReference = buildFreechipsExternalReference(payload?.merchant_order_id);
    // Payout Payload
    const payoutPayload = {
      transaction_type: "IMPS", 
      amount: Number(payload.amount),
      beneficiary_name: payload.user_bank_details?.account_holder_name,
      beneficiary_account_number: payload.user_bank_details?.account_no,
      beneficiary_ifsc: payload.user_bank_details?.ifsc_code,
      bank_name: payload.user_bank_details?.bank_name ,
      tpin: tpin,
      external_reference: externalReference,
      vendor_key: vendor_key
    };

    // Encrypt the payload
    const encryptedData = encryptFreechipsPayoutData(payoutPayload, secret_key, iv);
    const requestBody = {
      secretCode,
      data: encryptedData
    };

    const response = await axios.post(url, requestBody, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000
    });

    logger.info('Freechips payout initiated successfully', {
      merchant_order_id: payload.merchant_order_id,
      transaction_id: response.data?.transaction_id,
      status: response.data?.status
    });

    // Update result object
    result.status = 'PENDING';
    result.bank_acc_id = bankId;
    result.vendor_id = vendor_id;
    result.config = {
      ...result.config,
      txnid: response?.data?.transaction_id || externalReference
    };

    return result;

  } catch (error) {
    logger.error('Freechips payout error:', {
      merchant_order_id: payload?.merchant_order_id,
      error: error.response?.data || error.message
    });
    throw error;
  }
};