/* eslint-disable no-unused-vars */
import { sendSuccess } from '../../utils/responseHandlers.js';
import {
  createMerchantService,
  deleteMerchantService,
  getMerchantByIdService,
  getMerchantsByCodeService,
  getMerchantsBySearchService,
  getMerchantsService,
  getMerchantsServiceCode,
  updateMerchantService,
  migrateMerchantService
} from './merchantService.js';
import {
  VALIDATE_UPDATE_MERCHANT_STATUS,
  VALIDATE_MERCHANT_SCHEMA,
} from '../../schemas/merchantSchema.js';
import { BadRequestError, ValidationError } from '../../utils/appErrors.js';
import { createHashApiKey } from '../../utils/cryptoAlgorithm.js';
import { logger } from '../../utils/logger.js';
import { generateCacheKey } from '../../utils/redishashkey.js';
import {
  normalizeQueryForCache,
  readJsonCache,
  shouldServeCachedResponse,
  writeJsonCache,
  invalidateCompanyCacheByPrefix,
} from '../../utils/controllerCache.js';
import config from '../../config/config.js';

const invalidateMerchantsCache = async (companyId) =>
  invalidateCompanyCacheByPrefix(
    companyId,
    'merchants:read:',
    'Merchants cache',
  );
const { controllerCacheTtls } = config;

const createMerchant = async (req, res) => {
  const { body: payload, user } = req;
  const { company_id, user_id, role } = user;
  const { secretKey, publicKey } = createHashApiKey();

  // transform payload in a single, immutable operation
  let merchantData = {
    ...payload,
    config: {
      ...payload.config,
      allow_clickrr: false,
      clickrr_auto_approval_limit: 0,
      allow_tatapay: false,
      allow_payassist: false,
      is_h2h: payload.config?.is_h2h || false,
      urls: {
        payin_notify: payload.payin_notify,
        payout_notify: payload.payout_notify,
        return: payload.return_url,
        site: payload.site,
      },
      keys: {
        private: secretKey,
        public: publicKey,
      },
    },
  };

  // *** removed unnecessary fields using object destructuring as it is not needed in the service ***
  const { payin_notify, payout_notify, return_url, site, ...cleanedPayload } =
    merchantData;

  const validation = VALIDATE_MERCHANT_SCHEMA.validate(cleanedPayload);
  if (validation.error) {
    throw new ValidationError(validation.error);
  }
  const finalPayload = {
    ...cleanedPayload,
    company_id,
    created_by: user_id,
    updated_by: user_id,
  };
  await createMerchantService(finalPayload, role);
  await invalidateMerchantsCache(company_id);

  return sendSuccess(res, null, 'Merchant created successfully');
};

const getMerchants = async (req, res) => {
  const { company_id, role, designation, user_id } = req.user;
  const { page, limit } = req.query;
  const cacheKey = `merchants:read:${company_id}:list:${generateCacheKey(
    {
      company_id,
      role,
      designation,
      user_id,
      page,
      limit,
      query: normalizeQueryForCache(req.query),
    },
    'merchants-list',
  )}`;

  const cached = await readJsonCache(cacheKey, 'Merchants list cache');
  if (shouldServeCachedResponse(cached, req.query)) {
    logger.log('get Merchants successfully (cache hit)');
    return sendSuccess(res, cached, 'Merchants fetched successfully');
  }

  const data = await getMerchantsService(
    {
      company_id,
      ...req.query,
    },
    role,
    page,
    limit,
    designation,
    user_id,
  );
  await writeJsonCache(cacheKey, data, controllerCacheTtls.merchants.list);
  logger.log('get Merchants successfully');
  return sendSuccess(res, data, 'Merchants fetched successfully');
};

const getMerchantByCode = async (req, res) => {
  const { code } = req.query;
  const { company_id } = req.user;
  const cacheKey = `merchants:read:${company_id}:bycode:${code}`;

  const cached = await readJsonCache(cacheKey, 'Merchants by-code cache');
  if (shouldServeCachedResponse(cached, req.query)) {
    logger.log('get Merchants successfully (cache hit)');
    return sendSuccess(res, cached, 'Merchants fetched successfully');
  }

  const data = await getMerchantsByCodeService(code);
  await writeJsonCache(cacheKey, data, controllerCacheTtls.merchants.byCode);
  logger.log('get Merchants successfully');
  return sendSuccess(res, data, 'Merchants fetched successfully');
};

const getMerchantsBySearch = async (req, res) => {
  const { company_id, role, designation, user_id } = req.user;
  const { search, page = 1, limit = 10 } = req.query;
  const cacheKey = `merchants:read:${company_id}:search:${generateCacheKey(
    {
      company_id,
      role,
      designation,
      user_id,
      search,
      page,
      limit,
      query: normalizeQueryForCache(req.query),
    },
    'merchants-search',
  )}`;

  const cached = await readJsonCache(cacheKey, 'Merchants search cache');
  if (shouldServeCachedResponse(cached, req.query)) {
    logger.log('get Merchants successfully (cache hit)');
    return sendSuccess(res, cached, 'Merchants fetched successfully');
  }

  // if (!search) {
  //   throw new BadRequestError('search is required');
  // }
  const data = await getMerchantsBySearchService(
    {
      company_id,
      search,
      page,
      limit,
      ...req.query,
    },
    role,
    designation,
    user_id,
  );
  await writeJsonCache(cacheKey, data, controllerCacheTtls.merchants.search);
  logger.log('get Merchants successfully');
  return sendSuccess(res, data, 'Merchants fetched successfully');
};

const getMerchantCodes = async (req, res) => {
  const { company_id, role, user_id, designation } = req.user;
  const { includeSubMerchants, includeOnlyMerchants, excludeDisabledMerchant, allow_intent } = req.query;
  const filters = { company_id };
  const cacheKey = `merchants:read:${company_id}:codes:${generateCacheKey(
    {
      company_id,
      role,
      user_id,
      designation,
      includeSubMerchants,
      includeOnlyMerchants,
      excludeDisabledMerchant,
      allow_intent,
    },
    'merchants-codes',
  )}`;

  const cached = await readJsonCache(cacheKey, 'Merchants codes cache');
  if (shouldServeCachedResponse(cached, req.query)) {
    logger.log('get Merchants successfully (cache hit)');
    return sendSuccess(res, cached, 'Merchants fetched successfully');
  }

  const data = await getMerchantsServiceCode(
    filters,
    role,
    designation,
    user_id,
    includeSubMerchants,
    includeOnlyMerchants,
    excludeDisabledMerchant,
    allow_intent
  );
  await writeJsonCache(cacheKey, data, controllerCacheTtls.merchants.codes);
  logger.log('get Merchants successfully');
  return sendSuccess(res, data, 'Merchants fetched successfully');
};

const getMerchantsById = async (req, res) => {
  const { role } = req.user;
  if (!req.params) {
    throw new BadRequestError('id required in request');
  }
  const { id } = req.params;
  const { company_id } = req.user;
  const cacheKey = `merchants:read:${company_id}:byid:${id}:${role}`;

  const cached = await readJsonCache(cacheKey, 'Merchants by-id cache');
  if (shouldServeCachedResponse(cached, req.query)) {
    return sendSuccess(res, cached, 'Merchant fetched successfully');
  }

  // Fetch merchants data from the service
  const data = await getMerchantByIdService({ id, company_id }, role, true);
  await writeJsonCache(cacheKey, data, controllerCacheTtls.merchants.byId);
  // Send success response
  return sendSuccess(res, data, 'Merchant fetched successfully');
};

const updateMerchant = async (req, res) => {
  if (!req.params) {
    throw new BadRequestError('id required in request');
  }
  let payload = req.body;
  const { error: bodyError } =
    VALIDATE_UPDATE_MERCHANT_STATUS.validate(payload);
  if (bodyError) {
    throw new ValidationError(bodyError);
  }
  if (payload.config.clickrr_auto_approval_limit > 0 && payload.config.clickrr_auto_approval_limit < 500) {
    throw new BadRequestError(
      'clickrr auto approval limit cannot be less than 500',
    );  
  }
  const { id } = req.params;
  const { company_id, user_id, role, user_name } = req.user;
  payload.updated_by = user_id;
  const ids = { id, company_id };
  // Call the service to update the Merchant
  const merchant = await updateMerchantService(
    ids,
    payload,
    role,
  );
  await invalidateMerchantsCache(company_id);
  // Log success message
  // Send a success response to the client
  return sendSuccess(
    res,
    { id: merchant.id, updated_by: user_name },
    'Merchant updated successfully',
  );
};
const migrateMerchant = async (req, res) => {
  const {
    source_merchant_id,
    target_merchant_id,
  } = req.body;

  const { company_id, user_id, role, user_name } = req.user;
  const merchant = await migrateMerchantService(
    {
      source_merchant_id,
      target_merchant_id,
      updated_by: user_id,
    },
  );
  await invalidateMerchantsCache(company_id);
  return sendSuccess(
    res,
    { updated_by: user_name },
    'Merchant credentials migrated successfully',
  );
};
const deleteMerchant = async (req, res) => {
  const { role } = req.user;
  if (!req.params) {
    throw new BadRequestError('id required in request');
  }
  const { id } = req.params; // Assuming the Merchant ID is passed as a parameter
  // Call the service to delete the Merchant
  const { company_id, user_id, user_name } = req.user;
  const updated_by = user_id;
  const ids = { id, company_id };
  const merchant = await deleteMerchantService(ids, updated_by, role);
  await invalidateMerchantsCache(company_id);
  // Log success message

  // Send a success response to the client
  return sendSuccess(
    res,
    { id: merchant.id, deleted_by: user_name },
    'Merchant deleted successfully',
  );
};

export {
  createMerchant,
  getMerchants,
  getMerchantsBySearch,
  updateMerchant,
  deleteMerchant,
  getMerchantsById,
  getMerchantCodes,
  getMerchantByCode,
  migrateMerchant
};
