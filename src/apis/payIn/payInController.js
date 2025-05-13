import config from '../../config/config.js';
import { BadRequestError, ValidationError } from '../../utils/appErrors.js';
import { sendError, sendSuccess,sendNewSuccess } from '../../utils/responseHandlers.js';
import {
  ASSIGN_PAYIN_SCHEMA,
  PROCESS_PAYIN_IMAGE,
  VALIDATE_ASSIGNED_BANT_TO_PAY,
  VALIDATE_CHECK_PAY_IN_STATUS,
  // VALIDATE_CHECK_PAY_IN_STATUS,
  VALIDATE_CHECK_UTR,
  VALIDATE_DISPUTE_DUPLICATE_TRANSACTION,
  VALIDATE_EXPIRE_PAY_IN_URL,
  VALIDATE_PAY_IN_INTENT_GENERATE_ORDER,
  VALIDATE_PAYIN_SCHEMA,
  VALIDATE_PROCESS_PAYIN,
  VALIDATE_RESET_DEPOSIT,
  VALIDATE_UPDATE_DEPOSIT_SERVICE_STATUS,
  VALIDATE_UPDATE_PAYMENT_NOTIFICATION_STATUS,
} from '../../schemas/payInSchema.js';
import {
  assignedBankToPayInUrlService,
  checkPayInStatusService,
  disputeDuplicateTransactionService,
  expirePayInUrlService,
  generatePayInUrlByHashService,
  generatePayInUrlService,
  getPayinsService,
  payInIntentGenerateOrderService,
  processPayInByImageService,
  processPayInService,
  resetDepositService,
  telegramCheckUTRService,
  telegramResponseService,
  updateDepositStatusService,
  updatePaymentNotificationStatusService,
  getPayinsBySearchService,
  verifyPayinsService,
  generateUpiUrlService,
} from './payInService.js';
import { transactionWrapper } from '../../utils/db.js';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { decodeAuthToken, streamToBase64 } from '../../helpers/index.js';
import { s3 } from '../../helpers/Aws.js';
import { AUTH_HEADER_KEY } from '../../utils/constants.js';
import {
  getMerchantByCodeAndApiKey,
  getMerchantsDao,
} from '../merchants/merchantDao.js';
import { createHash, compareHash } from '../../utils/hashUtils.js';
import { logger } from '../../utils/logger.js';
import { getMerchantBankDao } from '../bankAccounts/bankaccountDao.js';

//  To Generate Url
export const generateHashForPayIn = async (req, res) => {
  const updateRes = await generatePayInUrlByHashService(req,res);     //-- sending res to resolve

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

  const apiKey = key ? key : x_api_key;
  if (!apiKey) {
    // throw new BadRequestError('Enter valid Api key');
    return res.status(400).json({
      error: {
        status: 404,
        message: 'Enter valid Api key',
        additionalInfo: {},
        level: 'info',
        timestamp: new Date().toISOString(),
      },
    });
  }

  // Fetch the merchant using the code and API public key
  const merchant = await getMerchantByCodeAndApiKey(code, apiKey);
  if (!merchant) {
    // throw new BadRequestError('Invalid merchant code or API key');
    return res.status(400).json({
      error: {
        status: 400,
        message: 'Invalid merchant code or API key',
        additionalInfo: {},
        level: 'info',
        timestamp: new Date().toISOString(),
      },
    });
  }

  // bank is not enabled or no method is enabled for payment - no payment link generates
  const merchantArr = await getMerchantsDao({ code });
  const bankAssigned = await getMerchantBankDao({
    config_merchants_contains: merchantArr[0].id,
  });
  if (bankAssigned.length <= 0) {
    // throw new InternalServerError('No Bank Assigned to Merchant');
    return res.status(400).json({
      error: {
        status: 404,
        message: 'Bank Account has not been linked with Merchant',
        additionalInfo: {},
        level: 'info',
        timestamp: new Date().toISOString(),
      },
    });
  }
  //loop over each and cehck

  const allBanksDisabled = bankAssigned.every(bank => bank.is_enabled === false);
  if (allBanksDisabled) {
    // throw new InternalServerError(
    //   'Bank assigned to this merchant is not enabled!',
    // );
    // error handling
    return res.status(400).json({
      error: {
        status: 404,
        message: 'Bank Account has not been linked with Merchant',
        additionalInfo: {},
        level: 'info',
        timestamp: new Date().toISOString(),
      },
    });
  }
  const allPaymentOptionsDisabled = bankAssigned.every(bank => {
    if (!bank.is_enabled) return true; 
    const config = bank.config || {};
    const isPhonepay = config.is_phonepay || false; 
    return isPhonepay === false && bank.is_qr === false && bank.is_bank === false;
  });
  
  if (allPaymentOptionsDisabled) {
    return res.status(400).json({
      error: {
        status: 404,
        message: 'Bank Account has not been linked with Merchant',
        additionalInfo: {},
        level: 'info',
        timestamp: new Date().toISOString(),
      },
    });
  }

  // Create a deterministic hash
  const generatedHash = createHash(`${code}`);
  // Decode the provided hash before comparison
  const decodedHashCode = hash_code ? decodeURIComponent(hash_code) : null;

  // Compare the provided hash with the generated hash
  if (
    decodedHashCode &&
    !compareHash(`${code}:${merchant.config.keys.private}`, decodedHashCode)
  ) {
    // throw new BadRequestError('Hash code does not match');
    return res.status(400).json({
      error: {
        status: 400,
        message: 'Hash code does not match',
        additionalInfo: {},
        level: 'info',
        timestamp: new Date().toISOString(),
      },
    });
  }

  const token = req.headers[AUTH_HEADER_KEY];
  const tokenData = decodeAuthToken(token);
  const result = await generatePayInUrlService(
    {
      ...payload,
      x_api_key: x_api_key ? x_api_key : key,
    },
    tokenData.user_id,
    res,
  );

  // create some kind of hash to secure the next public API flow
  const queryStr =
    payload.isTest && (payload.isTest === 'true' || payload.isTest === true)
      ? `?t=true&order=${result.merchant_order_id}`
      : `?order=${result.merchant_order_id}`;
  const updateRes = {
    expirationDate: result.expiration_date,
    payInUrl: `${config.reactPaymentOrigin}/transaction/${generatedHash}${queryStr}`, // Use env
    payinId: result.id,
    merchantOrderId: result.merchant_order_id,
    status: result.status
  };

  // return sendSuccess(
  //   res,
  //   updateRes,
  //   'PayIn is generated & url is sent successfully',
  // );
  return sendNewSuccess(res, updateRes, 'PayIn is generated & url is sent successfully');
  // return res.status(200).json({
  //   message: 'PayIn is generated & url is sent successfully',
  //   statusCode: 200,
  //   data: updateRes,
  // });
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

  const result = await verifyPayinsService(merchantOrderId, user_location);
  result.merchant_order_id = merchantOrderId;
  return sendSuccess(res, result, 'Payment Url is correct');
};

export const generateUpiUrl = async (req, res) => {

  const payload = req.body;

  // const joiValidation = VALIDATE_PAYIN_SCHEMA.validate(req.params);
  // if (joiValidation.error) {
  //   throw new ValidationError(joiValidation.error);
  // }

  const result = await generateUpiUrlService(payload);

  return sendSuccess(res, result, 'UPI Url is generated successfully');
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
  result.merchantOrderId = req.params.merchantOrderId;
  result.amount = req.body.amount;
  result.type = req.body.type;
    // sendNewSuccess(res, result, 'Bank account is assigned');
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
    req.body.payinId,
    req.body.merchantCode,
    req.body.merchantOrderId,
    api_key,
    res
  );
  return sendNewSuccess(res, data, 'PayIn status fetched successfully');
  // return res.status(200).json({
  //   message: 'PayIn status fetched successfully',
  //   statusCode: 200,
  //   data,
  // });
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
  sendSuccess(res, data, 'Merchant Notified successfully');
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
    sendError(res, { error: data.error }, data.error, data.status || 400);  //-- send error status along with error messge
  } else {
    sendSuccess(res, data, 'PayIn reset successful');
  }
};
export const getPayins = async (req, res) => {
  const { company_id, role, user_id, designation } = req.user;
  const { page, limit, sortBy, sortOrder, status, ...rest } = req.query;
  const filters = {
    sortBy,
    sortOrder,
    status,
    ...rest,
  };
  const data = await getPayinsService(
    company_id,
    page,
    limit,
    filters,
    role,
    user_id,
    designation,
  );
  return sendSuccess(res, data, 'PayIns fetched successfully');
};

export const getPayinsBySearch = async (req, res) => {
  const { company_id, role, user_id, designation } = req.user;
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
    user_id,
    designation,
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
  //added check for manually utr for uplaoded screenshot
  const data = await transactionWrapper(processPayInService)(
    payload,
    payload.code,
    false,
    true,
  );
  // sendNewSuccess(res, data, 'PayIn processed successfully');
  sendSuccess(res, data, 'PayIn processed successfully');
};

export const telegramOCR = async (req, res) => {
  sendSuccess(res,{}, 'API Called Successfully!');
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
  //added validation for fixinf db error
  const joiValidation = PROCESS_PAYIN_IMAGE.validate( {...req.body,
    file: { key: req.file?.key }});  //proper validation
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  if (!req.file) {
    throw new BadRequestError('Image File not found!');
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

  return sendSuccess(res, data, 'PayIn processed successfully');
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
  sendSuccess(res, data, 'PayIn Updated successfully');
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
  sendSuccess(res, result, 'telegramCheckUTR Successfully');
};
