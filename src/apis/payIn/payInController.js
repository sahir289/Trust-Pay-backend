import config from '../../config/config.js';
import { BadRequestError, ValidationError } from '../../utils/appErrors.js';
import {
  sendSuccess,
  sendNewSuccess,
  sendError,
} from '../../utils/responseHandlers.js';
import {
  ASSIGN_PAYIN_SCHEMA,
  PROCESS_PAYIN_IMAGE,
  VALIDATE_ASSIGNED_BANT_TO_PAY,
  VALIDATE_CHECK_PAY_IN_STATUS,
  VALIDATE_CHECK_UTR,
  VALIDATE_DISPUTE_DUPLICATE_TRANSACTION,
  VALIDATE_EXPIRE_PAY_IN_URL,
  VALIDATE_PAY_IN_INTENT_GENERATE_ORDER,
  VALIDATE_PAYIN_SCHEMA,
  VALIDATE_PROCESS_PAYIN,
  VALIDATE_RESET_DEPOSIT,
  VALIDATE_UPDATE_DEPOSIT_SERVICE_STATUS,
  VALIDATE_UPDATE_PAYIN_SCHEMA,
  VALIDATE_UPDATE_PAYMENT_NOTIFICATION_STATUS,
} from '../../schemas/payInSchema.js';
import {
  assignedBankToPayInUrlService,
  checkPayInStatusService,
  disputeDuplicateTransactionService,
  expirePayInUrlService,
  generatePayInUrlByHashService,
  generatePayInUrlService,
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
  updateUtrPayinService,
  checkPendingPayinStatusService,
  updatePayInService,
  getPayinsSummaryService,
} from './payInService.js';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { streamToBase64 } from '../../helpers/index.js';
import { s3 } from '../../helpers/Aws.js';
import { createHash } from '../../utils/hashUtils.js';
import { logger } from '../../utils/logger.js';
import { getRolesById } from '../roles/rolesDao.js';
import { Role, Status } from '../../constants/index.js';
import { verifyRazorPaySignature } from '../../razorpay/razorpay.js';
// import { generateCacheKey } from '../../utils/redishashkey.js';
import {
  // normalizeQueryForCache,
  // readJsonCache,
  // shouldServeCachedResponse,
  // writeJsonCache,
  invalidateCompanyCacheByPrefix,
} from '../../utils/controllerCache.js';
import { publishPayInProcess } from '../../rabbitmq/producer.js';
// import { notifyAdminsAndUsers } from '../../utils/notifyUsers.js';

const TestingIp = process.env.LOCAL_IP;
// const { controllerCacheTtls } = config;

const invalidatePayinCache = async (companyId) =>
  invalidateCompanyCacheByPrefix(companyId, 'payin:read:', 'PayIn cache');

//  To Generate Url
export const generateHashForPayIn = async (req, res) => {
  const updateRes = await generatePayInUrlByHashService(req); //-- sending res to resolve

  if (updateRes.status === 400 || updateRes.status === 404) {
    return sendError(res, updateRes.message, updateRes.status);
  } else {
    return sendSuccess(res, updateRes, 'PayIn hash generated successfully');
  }
};

export const generatePayInUrl = async (req, res) => {
  const payload = req.query;
  const x_api_key = req.headers['x-api-key'];
  let userIp =
    req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip;

  // Handle localhost IP for testing
  userIp = userIp === '::1' ? TestingIp : userIp;
  const { code, key, roleToken = null } = payload;
  let message;

  const joiValidation = ASSIGN_PAYIN_SCHEMA.validate(payload);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  const apiKey = key ? key : x_api_key;
  if (!apiKey) {
    return sendError(res, 'Enter valid Api key', 404);
  }

  const generatedHash = createHash(`${code}`);
  // // Decode the provided hash before comparison
  // const decodedHashCode = hash_code ? decodeURIComponent(hash_code) : null;

  // // Compare the provided hash with the generated hash
  // if (
  //   decodedHashCode &&
  //   !compareHash(`${code}:${merchant.config.keys.public}`, decodedHashCode)
  // ) {
  //   // throw new BadRequestError('Hash code does not match');
  //   // return res.status(400).json({
  //   //   error: {
  //   //     status: 400,
  //   //     message: 'Hash code does not match',
  //   //     additionalInfo: {},
  //   //     level: 'info',
  //   //     timestamp: new Date().toISOString(),
  //   //   },
  //   // });
  //   return sendError(res, 'Hash code does not match', 400);
  // }

  let role = null;
  if (roleToken && roleToken !== null) {
    const roleData = await getRolesById(roleToken);
    role = roleData.role;
  }

  const result = await generatePayInUrlService(
    {
      ...payload,
      api_key: apiKey,
    },
    role,
    userIp,
  );

  // Build query string for the URL
  const queryStr = `?order=${result?.merchant_order_id}`;

  const baseRes = {
    payinId: result?.id,
    merchantOrderId: result?.merchant_order_id,
    status: result?.status,
  };

  let updateRes;

  if (result.merchant?.h2h) {
    updateRes = {
      ...baseRes,
      bank: result?.bank,
      type: result?.type,
      amount: result?.amount,
    };
    message = 'PayIn is generated successfully';
  } else {
    updateRes = {
      ...baseRes,
      expirationDate: result?.expiration_date,
      payInUrl: `${config.reactPaymentOrigin}/transaction/${generatedHash}${queryStr}`,
      isAdmin: role === Role.ADMIN,
    };
    message = 'PayIn is generated & url is sent successfully';
  }

  if (result.status === 400 || result.status === 404) {
    return sendError(res, result.message, result.status);
  } else {
    return sendNewSuccess(res, updateRes, message);
  }
};

/**
 * @type import('express').RequestHandler
 */
export const validatePayInUrl = async (req, res) => {
  const { merchantOrderId } = req.params;
  const oneTimeUsed = req.query.isReload || false; // default to false if not provided
  const joiValidation = VALIDATE_PAYIN_SCHEMA.validate(req.params);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  const user_location = req.user_location;
  // req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
  const result = await verifyPayinsService(
    merchantOrderId,
    user_location,
    oneTimeUsed,
  );
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
  const { roleToken, amount, type } = req.body;
  const result = await assignedBankToPayInUrlService(
    req.params.merchantOrderId,
    amount,
    type,
    roleToken,
  );
  result.merchantOrderId = req.params.merchantOrderId;
  result.amount = amount;
  result.type = type;
  await invalidatePayinCache(req.user?.company_id);
  // sendNewSuccess(res, result, 'Bank account is assigned');
  return sendSuccess(res, result, 'Bank account is assigned');
};

export const expirePayInUrl = async (req, res) => {
  const joiValidation = VALIDATE_EXPIRE_PAY_IN_URL.validate(req.params);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  await expirePayInUrlService(req.params.payInId);
  await invalidatePayinCache(req.user?.company_id);
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
  );

  if (data.status === 400 || data.status === 404) {
    return sendError(res, data.message, data.status);
  } else {
    return sendNewSuccess(res, data, 'PayIn status fetched successfully');
  }
};

export const payInIntentGenerateOrder = async (req, res) => {
  const { merchantOrderId } = req.params;
  // const { company_id } = req.user;
  const { amount, Razorpay, cashfree, zentechind, nmplPay, silkPay, orvixPay, orvixPay1, runsafe, payeasy } = req.body;
  const payload = { merchantOrderId, amount, Razorpay, cashfree, zentechind };
  const joiValidation = VALIDATE_PAY_IN_INTENT_GENERATE_ORDER.validate(payload);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  let provider = [];

  if (Razorpay) provider.push('Razorpay');
  if (cashfree) provider.push('Cashfree');
  if (zentechind) provider.push('ZenTechInd');
  if (nmplPay) provider.push('NMPLPay');
  if (runsafe) provider.push('runsafe');
  if (silkPay) provider.push('silkPay');
  if (orvixPay) provider.push('orvixPay');
  if (orvixPay1) provider.push('orvixPay1');
  if (payeasy) provider.push('Payeasy');

  const data = await payInIntentGenerateOrderService(
    merchantOrderId,
    // company_id,
    amount,
    provider[0],
  );
  let message;

  if (provider.length > 0) {
    message = `${provider} order generated successfully`;
  } else {
    message = 'No provider selected';
  }

  return sendSuccess(res, data, message);
};

export const verifyPayinsrazorpay = async (req, res) => {
  const { razorpay_payment_id, razorpay_order_id, razorpay_signature } =
    req.body;

  const result = await verifyRazorPaySignature(
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  );
  return sendSuccess(res, result, 'Transaction verified successfully');
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
  const updateRes = await updateDepositStatusService(
    merchantOrderId,
    nick_name,
    req.user.company_id,
    req.user.user_id,
  );
  await invalidatePayinCache(req.user.company_id);
  sendSuccess(res, updateRes, 'PayIn data updated successfully');
};

export const resetDeposit = async (req, res) => {
  const { merchant_order_id } = req.body;
  const { company_id, user_id } = req.user;
  const joiValidation = VALIDATE_RESET_DEPOSIT.validate(req.body);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  const data = await resetDepositService(
    merchant_order_id,
    company_id,
    user_id,
  );
  await invalidatePayinCache(company_id);
  sendSuccess(res, data, `${merchant_order_id} reset successful`);
};

// export const getPayins = async (req, res) => {
//   const { company_id, role, user_id, designation } = req.user;
//   const { page, limit, sortBy, sortOrder, status, ...rest } = req.query;
//   const filters = {
//     sortBy,
//     sortOrder,
//     status,
//     ...rest,
//   };
//   const data = await getPayinsService(
//     company_id,
//     page,
//     limit,
//     filters,
//     role,
//     user_id,
//     designation,
//   );
//   return sendSuccess(res, data, 'PayIns fetched successfully');
// };

export const getPayinsBySearch = async (req, res) => {
  const { company_id, role, user_id, designation } = req.user;
  const { search, page = 1, limit = 10, updatedPayin } = req.query;

  // commented code for caching based on search query and other params, can be enabled when needed. Currently disabled to avoid cache serving stale data during development and testing
  // const normalizedQuery = normalizeQueryForCache(req.query);
  // const cacheKey = `payin:read:${company_id}:search:${generateCacheKey(
  //   {
  //     company_id,
  //     role,
  //     user_id,
  //     designation,
  //     search,
  //     page,
  //     limit,
  //     updatedPayin,
  //     query: normalizedQuery,
  //   },
  //   'payin-search',
  // )}`;

  // const cached = await readJsonCache(cacheKey, 'PayIn search cache');
  // if (shouldServeCachedResponse(cached, req.query)) {
  //   return sendSuccess(res, cached, 'Payins fetched successfully');
  // }
  // if (!search) {
  //   throw new BadRequestError('search is required');
  // }
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
    updatedPayin,
  );

  // await writeJsonCache(cacheKey, data, controllerCacheTtls.payin.search);

  return sendSuccess(res, data, 'Payins fetched successfully');
};

export const getPayinsSummary = async (req, res) => {
  const { company_id } = req.user;
  // const cacheKey = `payin:read:${company_id}:summary`;

  // const cached = await readJsonCache(cacheKey, 'PayIn summary cache');
  // if (shouldServeCachedResponse(cached, req.query)) {
  //   return sendSuccess(res, cached, 'Payins fetched successfully');
  // }

  const data = await getPayinsSummaryService({
    company_id,
  });

  // await writeJsonCache(cacheKey, data, controllerCacheTtls.payin.summary);

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
  await publishPayInProcess({
    payload,
    isH2H: false,
  });
  const data = {
    queued: true,
    merchantOrderId: payload.merchantOrderId,
    mode: 'standard',
    status: Status.PROCESSING,
  };

  sendSuccess(res, data, 'PayIn request queued successfully', 202);
};
export const processPayInH2H = async (req, res) => {
  const payload = {
    ...req.body,
    ...req.params,
  };
  const joiValidation = VALIDATE_PROCESS_PAYIN.validate(payload);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  await publishPayInProcess({
    payload,
    isH2H: true,
  });

  const data = {
    queued: true,
    merchantOrderId: payload.merchantOrderId,
    mode: 'h2h',
    status: Status.PROCESSING,
  };

  sendSuccess(res, data, 'PayIn request queued successfully', 202);
};
export const processPayInIMGUTR = async (req, res) => {
  const payload = {
    ...req.body,
    ...req.params,
  };
  const joiValidation = VALIDATE_PROCESS_PAYIN.validate(payload);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  const data = await processPayInService(payload, payload.code, false, true);
  await invalidatePayinCache(req.user?.company_id);
  sendSuccess(res, data, 'PayIn updated successfully');
};

export const telegramOCR = async (req, res) => {
  sendSuccess(res, {}, 'API Called Successfully!');
  const message = req.body.message;

  if (!message || typeof message !== 'object') {
    logger.error('No Telegram Message found!', message);
    return;
  }

  await telegramResponseService(message);
};

export const processPayInByImage = async (req, res) => {
  const payload = {
    ...req.body,
    ...req.params,
  };
  //added validation for fixinf db error
  const joiValidation = PROCESS_PAYIN_IMAGE.validate({
    ...req.body,
    file: { key: req.file?.key },
  }); //proper validation
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

  const data = await processPayInByImageService({
    ...payload,
    base64Image,
    fileKey: req.file.key,
  });

  await invalidatePayinCache(req.user?.company_id);

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

  const data = await disputeDuplicateTransactionService(
    payload,
    req.user.company_id,
    req.user.user_id,
  );
  await invalidatePayinCache(req.user.company_id);
  sendSuccess(res, data, 'PayIn Updated successfully');
};

export const updateUtrPayins = async (req, res) => {
  const { id } = req.params;
  const { utr } = req.body;
  const { user_id, user_name } = req.user;
  const data = await updateUtrPayinService(id, user_id, utr);
  await invalidatePayinCache(req.user.company_id);
  sendSuccess(
    res,
    { id: data.id, updated_by: user_name },
    'PayIn Updated successfully',
  );
};

export const checkPendingPayinStatus = async (req, res) => {
  const { user_name, user_id, company_id } = req.user;
  const data = await checkPendingPayinStatusService(
    user_id,
    company_id,
    user_name,
  );
  await invalidatePayinCache(company_id);
  sendSuccess(res, data, 'PayIn Status Checked Successfully');
};

export const telegramCheckUTR = async (req, res) => {
  const { utr, merchantOrderId } = req.body;
  const joiValidation = VALIDATE_CHECK_UTR.validate(req.body);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  const result = await telegramCheckUTRService(
    utr,
    merchantOrderId,
    req.user.company_id,
    req.user.user_id,
    req.user.designation,
  );
  sendSuccess(
    res,
    result,
    result?.message || `Order id ${result.merchantOrderId} confirmed.`,
  );
};

export const updatePayIn = async (req, res) => {
  const payload = {
    ...req.body,
  };
  const { merchant_order_id } = req.params;
  const { user_id, company_id } = req.user;
  const joiValidation = VALIDATE_UPDATE_PAYIN_SCHEMA.validate({
    ...req.body,
    merchant_order_id,
  });
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  const data = await updatePayInService(
    payload,
    merchant_order_id,
    user_id,
    company_id,
  );
  await invalidatePayinCache(company_id);
  sendSuccess(res, data, 'PayIn Updated successfully');
};
