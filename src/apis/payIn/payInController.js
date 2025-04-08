import config from '../../config/config.js';
import { BadRequestError, ValidationError } from '../../utils/appErrors.js';
import { sendError, sendSuccess } from '../../utils/responseHandlers.js';
import { updatePayInUrlDao } from './payInDao.js';
import {
  ASSIGN_PAYIN_SCHEMA,
  VALIDATE_ASSIGNED_BANT_TO_PAY,
  VALIDATE_CHECK_PAY_IN_STATUS,
  // VALIDATE_CHECK_PAY_IN_STATUS,
  VALIDATE_CHECK_UTR,
  VALIDATE_DISPUTE_DUPLICATE_TRANSACTION,
  VALIDATE_EXPIRE_PAY_IN_URL,
  VALIDATE_PAY_IN_INTENT_GENERATE_ORDER,
  VALIDATE_PAYIN_SCHEMA,
  VALIDATE_PROCESS_PAYIN,
  VALIDATE_PROCESS_PAYIN_BY_IMAGE,
  VALIDATE_RESET_DEPOSIT,
  VALIDATE_UPDATE_DEPOSIT_SERVICE_STATUS,
  VALIDATE_UPDATE_PAYMENT_NOTIFICATION_STATUS,
} from '../../schemas/payInSchema.js';
import {
  assignedBankToPayInUrlService,
  checkPayInStatusService,
  disputeDuplicateTransactionService,
  expirePayInUrlService,
  generatePayInUrlService,
  getPayinsService,
  getPayInUrlService,
  payInIntentGenerateOrderService,
  processPayInByImageService,
  processPayInService,
  resetDepositService,
  telegramCheckUTRService,
  telegramResponseService,
  updateDepositStatusService,
  updatePaymentNotificationStatusService,
  getPayinsBySearchService,
} from './payInService.js';
import { transactionWrapper } from '../../utils/db.js';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { decodeAuthToken, streamToBase64 } from '../../helpers/index.js';
import { s3 } from '../../helpers/Aws.js';
import { stringifyJSON } from '../../utils/index.js';
import { AUTH_HEADER_KEY } from '../../utils/constants.js';
import { getMerchantByCodeAndApiKey } from '../merchants/merchantDao.js';
import { createHash, compareHash } from '../../utils/hashUtils.js';
import { logger } from '../../utils/logger.js';

//  To Generate Url
export const generateHashForPayIn = async (req, res) => {
  const { user_id, code, ot, key, amount } = req.query;

  if (!user_id || !code || !ot) {
    throw new BadRequestError('Missing required query parameters: user_id, code, or ot');
  }
  const x_api_key = req.headers['x-api-key'];

  let query = `user_id=${user_id}&code=${code}&ot=${ot}&key=${key}`;
  if (amount) {
    query += `&amount=${amount}`;
  }

  // Create a deterministic hash
  const hash = createHash(`${code}:${x_api_key}`);

  // Encode the hash to make it URL-safe
  const encodedHash = encodeURIComponent(hash);

  const updateRes = {
    payInUrl: `${config.reactPaymentOrigin}/transaction/${encodedHash}?${query}`,
  };

  return sendSuccess(res, updateRes, 'PayIn hash generated successfully');
};

export const generatePayInUrl = async (req, res) => {
  const payload = req.query;
  const joiValidation = ASSIGN_PAYIN_SCHEMA.validate(payload);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  const x_api_key = req.headers['x-api-key'];
  const { code, key, hash_code } = payload;

  // Fetch the merchant using the code and API public key
  const merchant = await getMerchantByCodeAndApiKey(code, key);
  if (!merchant) {
    throw new BadRequestError('Invalid merchant code or API key');
  }

  // Create a deterministic hash
  const generatedHash = createHash(`${code}`);
  // Decode the provided hash before comparison
  const decodedHashCode = hash_code ? decodeURIComponent(hash_code) : null;

  // Compare the provided hash with the generated hash
  if (decodedHashCode && !compareHash(`${code}:${merchant.config.keys.private}`, decodedHashCode)) {
    throw new BadRequestError('Hash code does not match');
  }

  const token = req.headers[AUTH_HEADER_KEY];
  const tokenData = decodeAuthToken(token);
  const result = await generatePayInUrlService(
    {
      ...payload,
      x_api_key: x_api_key ? x_api_key : key,
    },
    tokenData.user_id,
  );

  // create some kind of hash to secure the next public API flow
  const queryStr =
    payload.isTest && (payload.isTest === 'true' || payload.isTest === true)
      ? `?t=true&order=${result.merchant_order_id}`
      : `?order=${result.merchant_order_id}`;
  const updateRes = {
    expirationDate: result.expiration_date,
    merchantOrderId: result.merchant_order_id,
    payInUrl: `${config.reactPaymentOrigin}/transaction/${generatedHash}${queryStr}`, // Use env
    payinId: result.id,
  };

  return sendSuccess(
    res,
    updateRes,
    'PayIn is generated & url is sent successfully',
  );
};

/**
 * @type import('express').RequestHandler
 */
export const validatePayInUrl = async (req, res) => {
  const { merchantOrderId } = req.params;
  const joiValidation = VALIDATE_PAYIN_SCHEMA.validate(req.params);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  const user_location =
    req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
  const payIn = await getPayInUrlService(merchantOrderId);

  if (!payIn) {
    throw new BadRequestError('Invalid merchant order id');
  }

  if (payIn.one_time_used === true) {
    throw new BadRequestError('This payin url is already used');
  }

  const updatedConfig = stringifyJSON({
    ...payIn.config,
    user: user_location,
  });
  await updatePayInUrlDao(payIn.id, { config: updatedConfig, one_time_used: true });
  const result = {
    code: payIn.upi_short_code,
    return_url: config.return_url,
    notify_url: config.notify_url,
    expiryTime: payIn.expiration_date,
    amount: payIn.amount,
    one_time_used: payIn.one_time_used,
    status: payIn.status,
  };

  return sendSuccess(res, result, 'Payment Url is correct');
};

export const assignedBankToPayInUrl = async (req, res) => {
  const joiValidation = VALIDATE_ASSIGNED_BANT_TO_PAY.validate({
    ...req.params,
    ...req.body,
  });
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  const result = await assignedBankToPayInUrlService(
    req.params.merchantOrderId,
    req.body.amount,
    req.body.type,
  );
  return sendSuccess(res, result, 'Bank account is assigned');
};

export const expirePayInUrl = async (req, res) => {
  const joiValidation = VALIDATE_EXPIRE_PAY_IN_URL.validate(req.params);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  await expirePayInUrlService(req.params.payInId);
  return sendSuccess(res, null, 'Payin expires!');
};

export const checkPayInStatus = async (req, res) => {
  const joiValidation = VALIDATE_CHECK_PAY_IN_STATUS.validate(req.body);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  const api_key = req.headers['x-api-key'];
  const data = await checkPayInStatusService(
    req.body.payInId,
    req.body.merchantCode,
    req.body.merchantOrderId,
    api_key,
  );
  sendSuccess(res, data);
};

export const payInIntentGenerateOrder = async (req, res) => {
  const { payInId } = req.params;
  const { amount, isRazorpay } = req.body;
  const payload = { payInId, amount, isRazorpay };
  const joiValidation = VALIDATE_PAY_IN_INTENT_GENERATE_ORDER.validate(payload);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  const data = await payInIntentGenerateOrderService(
    payInId,
    amount,
    isRazorpay,
  );
  sendSuccess(res, data);
};

export const updatePaymentNotificationStatus = async (req, res) => {
  const joiValidation = VALIDATE_UPDATE_PAYMENT_NOTIFICATION_STATUS.validate({
    ...req.params,
    ...req.body,
  });
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  const data = await updatePaymentNotificationStatusService(
    req.params.payInId,
    req.body.type,
    req.user.company_id,
  );
  sendSuccess(res, data);
};

export const updateDepositStatus = async (req, res) => {
  const { merchantOrderId } = req.params;
  const { nick_name } = req.body;
  const payload = {
    merchantOrderId,
    nick_name,
  };
  const joiValidation =
    VALIDATE_UPDATE_DEPOSIT_SERVICE_STATUS.validate(payload);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  const updateRes = await transactionWrapper(updateDepositStatusService)(
    merchantOrderId,
    nick_name,
    req.user.company_id,
    req.user.user_id,
  );
  sendSuccess(res, updateRes, 'PayIn data updated successfully');
};

export const resetDeposit = async (req, res) => {
  const { merchant_order_id } = req.body;
  const joiValidation = VALIDATE_RESET_DEPOSIT.validate(req.body);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  const data = await transactionWrapper(resetDepositService)(
    merchant_order_id,
    req.user.company_id,
    req.user.user_id,
  );
  if (data.error) {
    sendError(res, data);
  }
  else {
    sendSuccess(res, data, 'PayIn reset successful');
  }
};
export const getPayins = async (req, res) => {
  const { company_id, role } = req.user;
  const { page, limit, search, sortBy, sortOrder, status, ...rest } = req.query;
  const filters = {
    sortBy,
    sortOrder,
    status,
    ...rest
  };
  const data = await getPayinsService(company_id, page, limit, filters, role, search);
  return sendSuccess(res, data, 'PayIns fetched successfully');
};

export const getPayinsBySearch = async (req, res) => {
  const { company_id,role } = req.user;
  const { search, page = 1, limit = 10 } = req.query;
  if (!search) {
    throw new BadRequestError('search is required');
  }
  const data = await getPayinsBySearchService(
    {
      company_id,
      search,
      page,
      limit,
      ...req.query,
    },
    role,
  );
  console.log('get Payins successfully');
  return sendSuccess(res, data, 'Payins fetched successfully');
};

export const processPayIn = async (req, res) => {
  const payload = {
    ...req.body,
    ...req.params,
  };
  const joiValidation = VALIDATE_PROCESS_PAYIN.validate(payload);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }

  const data = await transactionWrapper(processPayInService)(payload);
  sendSuccess(res, data);
};

export const telegramOCR = async (req, res) => {
  sendSuccess(res, 'API Called Successfully!');
  const message = req.body.message;

  if (!message || typeof message !== 'object') {
    logger.error('No Telegram Message found!', message);
    return;
  }

  await transactionWrapper(telegramResponseService)(message);
};

export const processPayInByImage = async (req, res) => {
  const payload = {
    ...req.body,
    ...req.params,
  };
  const joiValidation = VALIDATE_PROCESS_PAYIN_BY_IMAGE.validate(payload);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }

  if (!req.file) {
    throw BadRequestError('Image File not found!');
  }

  const command = new GetObjectCommand({
    Bucket: config.bucketName,
    Key: req.file.key,
  });

  const { Body } = await s3.send(command);
  const base64Image = await streamToBase64(Body);

  const data = await transactionWrapper(processPayInByImageService)({
    ...payload,
    base64Image,
    fileKey: req.file.key,
  });

  sendSuccess(res, data);
};

export const disputeDuplicateTransaction = async (req, res) => {
  const payload = {
    ...req.body,
    ...req.params,
  };
  const joiValidation =
    VALIDATE_DISPUTE_DUPLICATE_TRANSACTION.validate(payload);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }

  const data = await transactionWrapper(disputeDuplicateTransactionService)(
    payload,
    req.user.company_id,
    req.user.user_id,
  );
  sendSuccess(res, data);
};

export const telegramCheckUTR = async (req, res) => {
  const { utr, merchantOrderId } = req.body;
  const joiValidation = VALIDATE_CHECK_UTR.validate(req.body);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  const result = await transactionWrapper(telegramCheckUTRService)(
    utr,
    merchantOrderId,
    req.user.company_id,
    req.user.user_id,
  );
  sendSuccess(res, result);
};
