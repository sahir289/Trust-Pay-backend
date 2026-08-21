import axios from 'axios';
import crypto from 'crypto';
import { sendNewSuccess } from '../utils/responseHandlers.js';
import { logger } from '../utils/logger.js';
import config from '../config/config.js';
import { BadRequestError, NotFoundError } from '../utils/appErrors.js';
import { getCompanyByIDDao } from '../apis/company/companyDao.js';
import { getBankByIdDao } from '../apis/bankAccounts/bankaccountDao.js';
import { getVendorsDao } from '../apis/vendors/vendorDao.js';
import { Method } from '../constants/index.js';
import { generateSignature } from '../utils/signaturegenrate.js';

const RAPIDBEETAS_META_BY_PROVIDER = {
  rapidPay: {
    configKey: 'RAPID_PAY',
    providerName: 'RapidPay',
  },
  beetas: {
    configKey: 'BEETAS',
    providerName: 'Beetas',
  },
};

const RAPIDBEETAS_PATHS = {
  createPayin: '/v2/payIn/create-payin',
  checkPayinStatus: '/v2/payIn/check-payin-status',
  createPayout: '/v2/payOut/create-payout',
  walletBalance: '/v2/payOut/wallet-balance',
  checkPayoutStatus: '/v2/payOut/check-payout-status',
};

const RAPIDBEETAS_META_BY_METHOD = {
  [Method.RAPIDPAY]: {
    configKey: 'RAPID_PAY',
    providerKey: 'rapidPay',
    providerName: 'RapidPay',
  },
  [Method.BEETAS]: {
    configKey: 'BEETAS',
    providerKey: 'beetas',
    providerName: 'Beetas',
  },
};

const safeEqualHex = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
};

const buildProviderUrl = (baseUrl, path) => {
  const normalizedBase = String(baseUrl || '').replace(/\/+$/, '');
  const normalizedPath = String(path || '').startsWith('/')
    ? path
    : `/${String(path || '')}`;
  return `${normalizedBase}${normalizedPath}`;
};

const getRuntimeConfigByProvider = (companyConfig, providerKey) => {
  const meta = RAPIDBEETAS_META_BY_PROVIDER[providerKey];
  if (!meta) {
    throw new BadRequestError(`Unsupported provider key: ${providerKey}`);
  }

  const runtimeConfig = companyConfig?.[meta.configKey];
  if (!runtimeConfig) {
    throw new BadRequestError(`${meta.providerName} configuration is missing for the company`);
  }

  const xAuthCode = runtimeConfig?.xAuthCode;
  const privateKey = runtimeConfig?.privateKey;
  const defaultBankId = runtimeConfig?.defaultBankId;

  return {
    providerName: meta.providerName,
    configKey: meta.configKey,
    xAuthCode,
    privateKey,
    defaultBankId,
  };
};

const buildSignedHeaders = (privateKey, payloadString) => {
  const timestamp = Date.now().toString();
  const signature = generateSignature(privateKey, timestamp, payloadString || '');

  return {
    'x-timestamp': timestamp,
    'x-signature': signature,
  };
};

export const resolveRapidBeetasProviderFromAuthCode = (companyConfig, authCode) => {
  if (!authCode) return null;

  const rapidAuthCode = companyConfig?.RAPID_PAY?.xAuthCode;
  if (rapidAuthCode && String(rapidAuthCode) === String(authCode)) {
    return 'rapidPay';
  }

  const beetasAuthCode = companyConfig?.BEETAS?.xAuthCode;
  if (beetasAuthCode && String(beetasAuthCode) === String(authCode)) {
    return 'beetas';
  }

  return null;
};

const resolveRapidBeetasProviderFromMethod = (method) => {
  const meta = RAPIDBEETAS_META_BY_METHOD[method];
  return meta?.providerKey || null;
};

const getHeaderValue = (headers, headerName) => {
  if (!headers || !headerName) return undefined;
  const target = String(headerName).toLowerCase();
  const matchedKey = Object.keys(headers).find((key) => String(key).toLowerCase() === target);
  return matchedKey ? headers[matchedKey] : undefined;
};

export const verifyRapidBeetasCallbackByAuthCode = ({
  companyConfig,
  headers,
  rawBody,
  methodHint,
}) => {
  const authCode =
    getHeaderValue(headers, 'x-auth-code') ||
    getHeaderValue(headers, 'x-webhook-auth-code');

  const providerKey =
    resolveRapidBeetasProviderFromAuthCode(companyConfig, authCode) ||
    resolveRapidBeetasProviderFromMethod(methodHint);

  if (!providerKey) {
    logger.warn('Rapid/Beetas callback signature not matched', {
      reason: 'Unable to resolve provider from headers or method',
      hasAuthCode: Boolean(authCode),
      methodHint,
    });
    return {
      valid: false,
      message: 'Unable to resolve provider from headers or method',
    };
  }

  const runtimeConfig = getRuntimeConfigByProvider(companyConfig, providerKey);
  const incomingSignature =
    getHeaderValue(headers, 'x-signature') ||
    getHeaderValue(headers, 'x-webhook-signature');
  const incomingTimestamp =
    getHeaderValue(headers, 'x-timestamp') ||
    getHeaderValue(headers, 'x-webhook-timestamp');

  if (!runtimeConfig?.privateKey) {
    logger.warn('Rapid/Beetas callback signature not matched', {
      providerKey,
      reason: `${runtimeConfig.providerName} privateKey is missing`,
    });
    return { valid: false, message: `${runtimeConfig.providerName} privateKey is missing`, providerKey };
  }

  if (!incomingSignature || !incomingTimestamp) {
    logger.warn('Rapid/Beetas callback signature not matched', {
      providerKey,
      reason: 'Missing signature/timestamp headers',
    });
    return {
      valid: false,
      message: 'Missing signature/timestamp headers',
      providerKey,
    };
  }

  const expectedSignature = generateSignature(
    runtimeConfig.privateKey,
    String(incomingTimestamp),
    rawBody || '',
  );

  if (!safeEqualHex(String(incomingSignature), expectedSignature)) {
    logger.warn('Rapid/Beetas callback signature not matched', {
      providerKey,
      reason: 'Invalid callback signature',
    });
    return { valid: false, message: 'Invalid callback signature', providerKey };
  }

  logger.info('Rapid/Beetas callback signature matched', {
    providerKey,
  });

  return { valid: true, providerKey };
};

export const createRapidBeetasPayinTransaction = async (providerKey, deposit, amount) => {
  try {
    const providerConfig = config[providerKey];
    if (!providerConfig) {
      throw new BadRequestError(`Provider config not found for ${providerKey}`);
    }

    const baseUrl = providerConfig.baseUrl;
    if (!baseUrl) {
      throw new BadRequestError(`Base URL is missing for ${providerKey}`);
    }
    const endpoint = buildProviderUrl(baseUrl, RAPIDBEETAS_PATHS.createPayin);

    const [company] = await getCompanyByIDDao({ id: deposit.company_id });
    if (!company) {
      throw new NotFoundError('Company not found');
    }

    const runtimeConfig = getRuntimeConfigByProvider(company.config, providerKey);
    if (!runtimeConfig?.xAuthCode || !runtimeConfig?.privateKey) {
      throw new BadRequestError(`${runtimeConfig.providerName} xAuthCode/privateKey is missing`);
    }

    const requestBody = {
      userId: deposit.user,
      amount: Number(amount ?? deposit.amount),
      merchantOrderId: deposit.merchant_order_id,
      returnUrl: deposit.config?.urls?.return,
    };

    const payloadString = JSON.stringify(requestBody);
    const headers = {
      ...buildSignedHeaders(runtimeConfig.privateKey, payloadString),
      'x-auth-code': runtimeConfig.xAuthCode,
      'Content-Type': 'application/json',
    };

    const response = await axios.post(endpoint, requestBody, {
      headers,
      timeout: 30000,
    });

    const payInUrl = response?.data?.data?.payInUrl;
    if (!payInUrl) {
      throw new BadRequestError('PayIn URL not found in response');
    }

    logger.info(`${runtimeConfig.providerName} payin created successfully`, {
      depositId: deposit.id,
      merchantOrderId: deposit.merchant_order_id,
      responseData: response?.data,
    });

    return { url: payInUrl };
  } catch (error) {
    const errorMessage =
      error?.response?.data?.error?.message ||
      error?.response?.data?.message ||
      error?.message ||
      'PayIn creation failed';

    logger.error(`${providerKey} payin error`, {
      message: errorMessage,
      response: error?.response?.data,
    });

    throw new BadRequestError(errorMessage);
  }
};

export const getRapidBeetasWalletBalance = async (req, res) => {
  try {
    const company_id = req.user?.company_id;
    const providerKey = req.query?.key;

    if (!providerKey || !RAPIDBEETAS_META_BY_PROVIDER[providerKey]) {
      throw new BadRequestError('Unsupported provider key for wallet balance');
    }

    const [company] = await getCompanyByIDDao({ id: company_id });
    if (!company) {
      throw new NotFoundError('Company not found for the user');
    }

    const runtimeConfig = getRuntimeConfigByProvider(company.config, providerKey);
    const providerConfig = config[providerKey];
    const baseUrl = providerConfig?.baseUrl;
    const url = buildProviderUrl(baseUrl, RAPIDBEETAS_PATHS.walletBalance);

    if (!baseUrl) {
      throw new BadRequestError(`Base URL is missing for ${providerKey}`);
    }

    const payloadString = '';

    const headers = {
      ...buildSignedHeaders(runtimeConfig.privateKey, payloadString),
      'x-auth-code': runtimeConfig.xAuthCode,
      'Content-Type': 'application/json',
    };

    const response = await axios.get(url, {
      headers,
      timeout: 30000,
    });

    const data = response?.data?.data;
    const successMsg = response?.data?.message || 'Wallet balance fetched successfully';
    return sendNewSuccess(res, data, successMsg);
  } catch (error) {
    logger.error('Rapid/Beetas wallet balance error', {
      message: error.message,
      response: error?.response?.data,
    });
    throw error;
  }
};

export const createRapidBeetasPayout = async (
  result,
  payload,
  vendor_id,
  bankId,
  providerKey,
  runtimeConfig,
) => {
  try {
    const providerConfig = config[providerKey];
    const baseUrl = providerConfig?.baseUrl;
    const url = buildProviderUrl(baseUrl, RAPIDBEETAS_PATHS.createPayout);

    if (!baseUrl) {
      throw new BadRequestError(`Base URL is missing for ${providerKey}`);
    }

    if (!runtimeConfig?.xAuthCode || !runtimeConfig?.privateKey) {
      throw new BadRequestError(`${runtimeConfig?.providerName || providerKey} xAuthCode/privateKey is missing`);
    }

    const requestBody = {
      user: payload?.user,
      amount: payload?.amount,
      accountNumber: payload?.user_bank_details?.account_no,
      accountHolderName: payload?.user_bank_details?.account_holder_name,
      ifscCode: payload?.user_bank_details?.ifsc_code,
      bankName: payload?.user_bank_details?.bank_name,
      merchantOrderId: payload?.merchant_order_id,
    };

    const payloadString = JSON.stringify(requestBody);
    const headers = {
      ...buildSignedHeaders(runtimeConfig.privateKey, payloadString),
      'x-auth-code': runtimeConfig.xAuthCode,
      'Content-Type': 'application/json',
    };

    const response = await axios.post(url, requestBody, {
      headers,
      timeout: 30000,
    });

    logger.info(`${runtimeConfig.providerName} payout initiated successfully`, {
      merchantOrderId: payload?.merchant_order_id,
      responseData: response?.data,
    });

    result.status = 'PENDING';
    result.bank_acc_id = bankId;
    result.vendor_id = vendor_id;
    return result;
  } catch (error) {
    const errorMessage =
      error?.response?.data?.error?.message ||
      error?.response?.data?.message ||
      error?.message ||
      'Payout failed';

    logger.error(`${providerKey} payout error`, {
      message: errorMessage,
      response: error?.response?.data,
    });

    throw new BadRequestError(errorMessage);
  }
};

export const processRapidBeetasPayout = async (
  method,
  payload,
  ids,
  singleWithdrawData,
  conn,
  context = {},
) => {
  try {
    const meta = RAPIDBEETAS_META_BY_METHOD[method];
    if (!meta) {
      throw new BadRequestError(`Unsupported payout method: ${method}`);
    }

    let company = context?.company;
    if (!company) {
      [company] = await getCompanyByIDDao({ id: ids.company_id }, conn);
    }
    if (!company) {
      throw new NotFoundError('Company not found');
    }

    const runtimeConfig = getRuntimeConfigByProvider(company.config, meta.providerKey);
    const bankId = context?.bankId || runtimeConfig?.defaultBankId;
    if (!bankId) {
      throw new NotFoundError(`Default bank ID not found for ${meta.providerName}`);
    }

    let bankData = context?.bankData;
    if (!bankData) {
      const bankDataArr = await getBankByIdDao({ id: bankId }, conn);
      bankData = bankDataArr?.[0];
    }
    if (!bankData) {
      throw new NotFoundError(`Bank not found for ${meta.providerName} payout`);
    }

    let vendor = context?.vendor;
    if (!vendor) {
      [vendor] = await getVendorsDao({ user_id: bankData.user_id });
    }
    if (!vendor) {
      throw new NotFoundError(`Vendor not found for ${meta.providerName} payout`);
    }

    const updatedPayload = await createRapidBeetasPayout(
      payload,
      singleWithdrawData,
      vendor.id,
      bankId,
      meta.providerKey,
      runtimeConfig,
    );

    return {
      status: updatedPayload?.status,
      vendor_id: updatedPayload?.vendor_id,
      bank_acc_id: updatedPayload?.bank_acc_id,
    };
  } catch (error) {
    logger.error('Error in processRapidBeetasPayout', {
      method,
      payoutId: ids?.id,
      companyId: ids?.company_id,
      message: error.message,
    });
    throw error;
  }
};
