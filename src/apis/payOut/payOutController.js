import {
  sendSuccess,
  sendNewSuccess,
  sendError,
} from '../../utils/responseHandlers.js';
import {
  createPayoutService,
  deletePayoutService,
  getPayoutsService,
  updatePayoutService,
  markPayoutPendingForUtrSlipMismatchService,
  getPayoutsBySearchService,
  checkPayOutStatusService,
  assignedPayoutService,
  createTataPayBulkPayoutService,
  createRupeeFlowBulkPayoutService,
} from './payOutService.js';
import {
  PAYOUT_DETAILS_SCHEMA,
  UPDATE_DETAILS_SCHEMA,
  VALIDATE_CHECK_PAY_OUT_STATUS,
  VALIDATE_PAYOUT_BY_ID,
  ASSIGNED_VENDOR_SCHEMA,
  TATAPAY_BULK_PAYOUT_SCHEMA,
  RUPEEFLOW_BULK_PAYOUT_SCHEMA,
} from '../../schemas/payoutSchema.js';
import { ValidationError } from '../../utils/appErrors.js';
import {
  // normalizeQueryForCache,
  // readJsonCache,
  // shouldServeCachedResponse,
  // writeJsonCache,
  invalidateCompanyCacheByPrefix,
} from '../../utils/controllerCache.js';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { streamToBase64 } from '../../helpers/index.js';
import { s3 } from '../../helpers/Aws.js';
import config from '../../config/config.js';
import { getImageContentFromOCrForPayout } from '../../helpers/index.js';
import { publishBulkPayoutCreate } from '../../rabbitmq/producer.js';
// import config from '../../config/config.js';
// import { BadRequestError } from '../../utils/appErrors.js';

// const { controllerCacheTtls } = config;
import {
  generateCacheKey,
  setCachedDataIfNotExists,
} from '../../utils/redishashkey.js';
const PAYOUT_CREATE_INFLIGHT_TTL_SEC =
  config?.controllerCacheTtls?.payout?.createInflight || 5;
const invalidatePayoutCache = async (companyId) =>
  invalidateCompanyCacheByPrefix(companyId, 'payout:read:', 'PayOut cache');

const createPayout = async (req, res) => {
  let payload = req.body;
  const fromUI = payload.fromUi || false;
  delete payload.fromUi;
  const joiValidation = PAYOUT_DETAILS_SCHEMA.validate(req.body);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  // let x_api_key = req.headers['x-api-key'];

  // if (!x_api_key) {
  //   return sendError(res, 'Enter valid Api key', 404);
  // }
  if (!payload.user_id && !payload.user) {
    throw new ValidationError('user_id is required');
  }
  payload.user = payload.user_id ? payload.user_id : payload.user;
  delete payload?.user_id;
  if (req?.user?.company_id) {
    payload.company_id = req.user.company_id;
  }
  const cacheKey = generateCacheKey(
    {
      company_id: payload.company_id ?? null,
      user: payload.user ?? null,
      code: payload.code ?? null,
      merchant_code: payload.merchant_code ?? null,
      merchant_order_id: payload.merchant_order_id ?? null,
      ifsc_code: payload.ifsc_code ?? null,
      method: payload.method ?? null,
      bank_acc_id: payload.bank_acc_id ?? null,
      reason: payload.reason ?? null,
      acc_holder_name: payload.acc_holder_name ?? null,
      acc_no: payload.acc_no ?? null,
      bank_name: payload.bank_name ?? null,
      amount: payload.amount ?? null,
      utr_id: payload.utr_id ?? null,
      notifyUrl: payload.notifyUrl ?? null,
    },
    'createPayout',
  );
  const lockAcquired = await setCachedDataIfNotExists(
    cacheKey,
    '1',
    PAYOUT_CREATE_INFLIGHT_TTL_SEC,
    'createPayout_inflight',
  );
  if (!lockAcquired) {
    return sendError(res, 'Duplicate payout request is already being processed', 429);
  }
  let result = {};
  if (req?.user) {
    const { company_id, role, user_id } = req.user;
    payload.company_id = company_id;
    payload.created_by = user_id;
    payload.updated_by = user_id;
    // payload.x_api_key = x_api_key;
    result = await createPayoutService(
      req.headers,
      payload,
      role,
      fromUI,
    );
  } else {
    payload._merchantData = req.merchant || null;
    // payload.x_api_key = x_api_key;
    result = await createPayoutService(
      req.headers,
      payload,
      null,
      fromUI,
    );
  }

  const updateRes = {
    merchantOrderId: result.merchant_order_id,
    payoutId: result.id,
    amount: result.amount,
  };

  // Send a success response to the client
  if (result.status === 400 || result.status === 404) {
    return sendError(res, result.message, result.status);
  } else {
    await invalidatePayoutCache(req.user?.company_id || payload.company_id);
    return sendNewSuccess(res, updateRes, 'Payout created successfully', 201);
  }
};

const createBulkPayout = async (req, res) => {
  if (!req.file) {
    throw new ValidationError('Excel file is required');
  }

  const payload = {
    fileKey: req.file.key,
    fileUrl: req.file.location,
    bucket: req.file.bucket,

    companyId: req.user.company_id,
    role: req.user.role,
    designation: req.user.designation,
    userId: req.user.user_id,
    fileName: req.file.originalname,
    createdBy: req.user.user_id,
    updatedBy: req.user.user_id,
  };

  await publishBulkPayoutCreate(payload);

  return sendNewSuccess(
    res,
    {},
    'Bulk payout queued successfully',
    202,
  );
};

const getPayoutsById = async (req, res) => {
  const joiValidation = VALIDATE_PAYOUT_BY_ID.validate(req.params);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  const { id } = req.params;
  const { company_id, role } = req.user;
  // const cacheKey = `payout:read:${company_id}:byid:${id}:${role}`;

  // const cached = await readJsonCache(cacheKey, 'PayOut by-id cache');
  // if (shouldServeCachedResponse(cached, req.query)) {
  //   return sendSuccess(res, cached, 'Payouts fetched successfully');
  // }

  const data = await getPayoutsService({ id, company_id }, role);

  // await writeJsonCache(cacheKey, data, controllerCacheTtls.payout.byId);
  return sendSuccess(res, data, 'Payouts fetched successfully');
};

const getPayouts = async (req, res) => {
  const { company_id, role, user_id, designation } = req.user;
  const { page, limit, sortOrder } = req.query;


  // commented code for caching based on query params, can be enabled when needed. Currently disabled to avoid cache serving stale data 
  // const normalizedQuery = normalizeQueryForCache(req.query);
  // const cacheKey = `payout:read:${company_id}:list:${generateCacheKey(
  //   {
  //     company_id,
  //     role,
  //     user_id,
  //     designation,
  //     page,
  //     limit,
  //     sortOrder,
  //     query: normalizedQuery,
  //   },
  //   'payout-list',
  // )}`;

  // const cached = await readJsonCache(cacheKey, 'PayOut list cache');
  // if (shouldServeCachedResponse(cached, req.query)) {
  //   return sendSuccess(res, cached, 'Payouts fetched successfully');
  // }

  delete req.query.limit;
  delete req.query.sortOrder;
  delete req.query.page;
  const data = await getPayoutsService(
    company_id,
    page,
    limit,
    sortOrder,
    req.query,
    role,
    user_id,
    designation,
  );

  // await writeJsonCache(cacheKey, data, controllerCacheTtls.payout.list);
  return sendSuccess(res, data, 'Payouts fetched successfully');
};

const getPayoutsBySearch = async (req, res) => {
  const { company_id, role, user_id, designation } = req.user;
  const { search, page = 1, limit = 10, isAmount } = req.query;

  // commented code for caching based on search query and other params, can be enabled when needed. Currently disabled to avoid cache serving stale data 
  // const normalizedQuery = normalizeQueryForCache(req.query);
  // const cacheKey = `payout:read:${company_id}:search:${generateCacheKey(
  //   {
  //     company_id,
  //     role,
  //     user_id,
  //     designation,
  //     search,
  //     page,
  //     limit,
  //     isAmount,
  //     query: normalizedQuery,
  //   },
  //   'payout-search',
  // )}`;

  // const cached = await readJsonCache(cacheKey, 'PayOut search cache');
  // if (shouldServeCachedResponse(cached, req.query)) {
  //   return sendSuccess(res, cached, 'Payouts fetched successfully');
  // }

  // if (!search) {
  //   throw new BadRequestError('search is required');
  // }
  const data = await getPayoutsBySearchService(
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
    isAmount,
  );

  // await writeJsonCache(cacheKey, data, controllerCacheTtls.payout.search);
  return sendSuccess(res, data, 'Payouts fetched successfully');
};

const updatePayout = async (req, res) => {
  const { company_id, role, user_id, user_name } = req.user;
  const { id } = req.params;
  const payload = req.body;
  const joiValidation = UPDATE_DETAILS_SCHEMA.validate(payload);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  if (req.file) {
    payload.config = {
      ...payload.config,
      slip: req.file.key,
    };
    const command = new GetObjectCommand({
      Bucket: config.bucketName,
      Key: req.file.key,
    });
    const { Body } = await s3.send(command);
    const base64Image = await streamToBase64(Body);
    const content = await getImageContentFromOCrForPayout(base64Image);
    const payloadUtr = payload.utr_id;
    const slipUtr = content?.utr;
    if (payloadUtr && content && payloadUtr !== slipUtr) {
      payload.updated_by = user_id;
      const ids = { id, company_id };
      const update = await markPayoutPendingForUtrSlipMismatchService(ids, {
        ...payload,
        slip_utr: content?.utr || null,
      });
      await invalidatePayoutCache(company_id);
      return sendSuccess(
        res,
        { id: update.id, updated_by: user_name },
        'Payout moved to pending due to UTR mismatch with slip',
      );
    }
  }
  payload.updated_by = user_id;
  const ids = { id, company_id };
  const update = await updatePayoutService(
    ids,
    payload,
    role,
  );
  await invalidatePayoutCache(company_id);
  return sendSuccess(
    res,
    { id: update.id, updated_by: user_name },
    'Payout updated successfully',
  );
};

const assignedPayout = async (req, res) => {
  const { user_id, user_name, company_id } = req.user;
  const { id } = req.params;
  const { payouts_ids } = req.body;
  const joiValidation = ASSIGNED_VENDOR_SCHEMA.validate(req.body);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  const updated_by = user_id;
  const ids = { id };
  const update = await assignedPayoutService(
    ids,
    payouts_ids,
    updated_by,
    company_id,
  );
  await invalidatePayoutCache(company_id);
  return sendSuccess(
    res,
    { ids: update, assigned_by: user_name },
    'Payout assigned successfully',
  );
};
const deletePayout = async (req, res) => {
  const joiValidation = VALIDATE_PAYOUT_BY_ID.validate(req.params);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  const { id } = req.params; // Assuming the Payout ID is passed as a parameter
  const { company_id, user_id, role } = req.user;
  const updated_by = user_id;
  const ids = { id, company_id };
  // Call the service to delete the Payout
  await deletePayoutService(ids, updated_by, role);
  await invalidatePayoutCache(company_id);
  // Log success message
  // Send a success response to the client
  return sendSuccess(res, {}, 'Payout deleted successfully');
};

const checkPayOutStatus = async (req, res) => {
  const joiValidation = VALIDATE_CHECK_PAY_OUT_STATUS.validate(req.body);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  const api_key = req.headers['x-api-key'];
  const data = await checkPayOutStatusService(
    req.body.payoutId,
    req.body.merchantCode,
    req.body.merchantOrderId,
    api_key,
  );
  // sendSuccess(res, data);
  if (data.status === 400 || data.status === 404) {
    return sendError(res, data.message, data.status);
  } else {
    return sendNewSuccess(res, data, 'PayOut status fetched successfully');
  }
};

const createTataPayBulkPayoutController = async (req, res) => {
  // Validate request body
  const joiValidation = TATAPAY_BULK_PAYOUT_SCHEMA.validate(req.body);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }

  const { payoutEntries, payoutIds } = req.body;
  const { company_id, user_id } = req.user;

  const result = await createTataPayBulkPayoutService({
    payoutEntries,
    payoutIds,
    company_id,
    user_id,
  });

  await invalidatePayoutCache(company_id);

  return sendSuccess(res, result.data, result.message);
};

const createRupeeFlowBulkPayoutController = async (req, res) => {
  // Validate request body
  const joiValidation = RUPEEFLOW_BULK_PAYOUT_SCHEMA.validate(req.body);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }

  const { payoutEntries, payoutIds } = req.body;
  const { company_id, user_id } = req.user;

  const result = await createRupeeFlowBulkPayoutService({
    payoutEntries,
    payoutIds,
    company_id,
    user_id,
  });

  await invalidatePayoutCache(company_id);

  return sendSuccess(res, result.data, result.message);
};

export {
  createPayout,
  createBulkPayout,
  getPayoutsBySearch,
  checkPayOutStatus,
  getPayouts,
  updatePayout,
  deletePayout,
  getPayoutsById,
  assignedPayout,
  createTataPayBulkPayoutController,
  createRupeeFlowBulkPayoutController
};
