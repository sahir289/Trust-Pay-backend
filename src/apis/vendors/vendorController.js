import { sendSuccess } from '../../utils/responseHandlers.js';
import {
  createVendorService,
  deleteVendorService,
  getVendorsCodeService,
  getVendorsService,
  updateVendorService,
  getVendorsBySearchService,
  getBankResponseAccessByIDService,
  getVendorsByCodeService,
  linkVendorService,
  unlinkVendorService,
  transferVendorService,
} from './vendorService.js';
import {
  VALIDATE_VENDOR_BY_ID,
  VALIDATE_UPDATE_VENDOR_STATUS,
  VALIDATE_VENDOR_SCHEMA,
} from '../../schemas/vendorSchema.js';
import { ValidationError, BadRequestError } from '../../utils/appErrors.js';
import { logger } from '../../utils/logger.js';
import { generateCacheKey } from '../../utils/redishashkey.js';
import {
  normalizeQueryForCache,
  readJsonCache,
  writeJsonCache,
  invalidateCompanyCacheByPrefix,
} from '../../utils/controllerCache.js';
import config from '../../config/config.js';
// import { BadRequestError } from '../../utils/appErrors.js';

const invalidateVendorsCache = async (companyId) =>
  invalidateCompanyCacheByPrefix(companyId, 'vendors:read:', 'Vendors cache');
const { controllerCacheTtls } = config;

const createVendor = async (req, res) => {
  const { error } = VALIDATE_VENDOR_SCHEMA.validate(req.body);
  if (error) {
    throw new ValidationError(error);
  }
  let payload = req.body;
  const { company_id, user_id } = req.user;
  payload.company_id = company_id;
  payload.created_by = user_id;
  payload.updated_by = user_id;
  // Call the service to create the Vendor
  const vendor = await createVendorService(payload);
  await invalidateVendorsCache(company_id);
  // Log success message
  // Send a success response to the client
  return sendSuccess(res, { id: vendor.id }, 'Vendor created successfully');
};

const getVendors = async (req, res) => {
  const { company_id, role, user_id, designation } = req.user;
  const { page, limit } = req.query;
  const cacheKey = `vendors:read:${company_id}:list:${generateCacheKey(
    {
      company_id,
      role,
      user_id,
      designation,
      page,
      limit,
      query: normalizeQueryForCache(req.query),
    },
    'vendors-list',
  )}`;

  const cached = await readJsonCache(cacheKey, 'Vendors list cache');
  if (cached) {
    return sendSuccess(res, cached, 'Vendors fetched successfully');
  }

  const data = await getVendorsService(
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

  await writeJsonCache(cacheKey, data, controllerCacheTtls.vendors.list);

  return sendSuccess(res, data, 'Vendors fetched successfully');
};

const getVendorsBySearch = async (req, res) => {
  const { company_id, role, user_id, designation } = req.user;
  const { page, limit } = req.query;
  const cacheKey = `vendors:read:${company_id}:search:${generateCacheKey(
    {
      company_id,
      role,
      user_id,
      designation,
      page,
      limit,
      query: normalizeQueryForCache(req.query),
    },
    'vendors-search',
  )}`;

  const cached = await readJsonCache(cacheKey, 'Vendors search cache');
  if (cached) {
    return sendSuccess(res, cached, 'Vendors fetched successfully');
  }

  const data = await getVendorsBySearchService(
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

  await writeJsonCache(cacheKey, data, controllerCacheTtls.vendors.search);

  return sendSuccess(res, data, 'Vendors fetched successfully');
};

const getVendorCodes = async (req, res) => {
  const { company_id, user_id, role, designation } = req.user;
  const {
    includeSubVendors,
    includeOnlyVendors,
    excludeDisabledVendor,
    includeSeperateSubVendors,
    includeVendorAdmin,
    isEnabled,
  } = req.query;
  const filters = { company_id };
  const cacheKey = `vendors:read:${company_id}:codes:${generateCacheKey(
    {
      company_id,
      user_id,
      role,
      designation,
      includeSubVendors,
      includeOnlyVendors,
      excludeDisabledVendor,
      includeSeperateSubVendors,
      includeVendorAdmin,
      isEnabled,
    },
    'vendors-codes',
  )}`;

  const cached = await readJsonCache(cacheKey, 'Vendors codes cache');
  if (cached) {
    return sendSuccess(res, cached, 'Vendors fetched successfully');
  }

  const data = await getVendorsCodeService(
    filters,
    role,
    designation,
    user_id,
    includeSubVendors,
    includeOnlyVendors,
    excludeDisabledVendor,
    includeSeperateSubVendors,
    includeVendorAdmin,
    isEnabled,
  );
  await writeJsonCache(cacheKey, data, controllerCacheTtls.vendors.codes);
  // Log success message
  // Send success response
  return sendSuccess(res, data, 'Vendors fetched successfully');
};

const getVendorById = async (req, res) => {
  const { error } = VALIDATE_VENDOR_BY_ID.validate(req.params);
  if (error) {
    throw new ValidationError(error);
  }
  const { role, designation, user_id } = req.user;
  if (!req.params) {
    throw new BadRequestError('id required in request');
  }
  const { id } = req.params;
  const { company_id } = req.user;
  const cacheKey = `vendors:read:${company_id}:byid:${id}:${role}:${designation}:${user_id}`;

  const cached = await readJsonCache(cacheKey, 'Vendors by-id cache');
  if (cached) {
    return sendSuccess(res, cached, 'Vendor fetched successfully');
  }

  // Fetch vendor data from the service
  const data = await getVendorsService(
    { id, company_id },
    role,
    null,
    null,
    designation,
    user_id,
  );
  await writeJsonCache(cacheKey, data, controllerCacheTtls.vendors.byId);
  // Log success message
  // Send success response
  return sendSuccess(res, data, 'Vendor fetched successfully');
};

const getBankResponseAccessByID = async (req, res) => {
  const { error } = VALIDATE_VENDOR_BY_ID.validate(req.params);
  if (error) {
    throw new ValidationError(error);
  }
  if (!req.params) {
    throw new BadRequestError('id required in request');
  }
  const { id } = req.params;
  const { designation } = req.user;
  const data = await getBankResponseAccessByIDService(id, designation);
  return sendSuccess(res, data, 'Bank response access fetched successfully');
};

const updateVendor = async (req, res) => {
  if (!req.params) {
    throw new BadRequestError('id required in request');
  }
  let payload = req.body;
  const { error: bodyError } = VALIDATE_UPDATE_VENDOR_STATUS.validate(payload);
  if (bodyError) {
    throw new ValidationError(bodyError);
  }
  const { id } = req.params;
  const { company_id, user_id, user_name } = req.user;
  payload.updated_by = user_id;
  const ids = { id, company_id };
  // Call the service to update the Vendor
  const vendor = await updateVendorService(ids, payload);
  await invalidateVendorsCache(company_id);
  // Log success message
  // Send a success response to the client
  return sendSuccess(
    res,
    { id: vendor.id, updated_by: user_name },
    'Vendor updated successfully',
  );
};

const deleteVendor = async (req, res) => {
  if (!req.params) {
    throw new BadRequestError('id required in request');
  }
  const { user_id } = req.params; // Keep as user_id to match current route
  // Call the service to delete the Vendor
  const { company_id, user_id: currentUserId, user_name } = req.user;
  const updated_by = currentUserId;
  const ids = { user_id: user_id, company_id }; // Convert to match merchant pattern
  const vendor = await deleteVendorService(ids, updated_by);
  await invalidateVendorsCache(company_id);
  // Log success message

  // Send a success response to the client
  return sendSuccess(
    res,
    { id: vendor.id, deleted_by: user_name },
    'Vendor deleted successfully',
  );
};

const getVendorByCode = async (req, res) => {
  const { code } = req.query;
  const { company_id } = req.user;
  const cacheKey = `vendors:read:${company_id}:bycode:${code}`;

  const cached = await readJsonCache(cacheKey, 'Vendors by-code cache');
  if (cached) {
    logger.log('get Vendors successfully (cache hit)');
    return sendSuccess(res, cached, 'Vendors fetched successfully');
  }

  const data = await getVendorsByCodeService(code);
  await writeJsonCache(cacheKey, data, controllerCacheTtls.vendors.byCode);
  logger.log('get Vendors successfully');
  return sendSuccess(res, data, 'Vendors fetched successfully');
};

const linkVendor = async (req, res) => {
  const { vendorUserId, subVendorUserId, mediator_payin_commission, mediator_payout_commission } = req.body;
  const { user_id } = req.user;
  if (!vendorUserId || !subVendorUserId) {
    throw new BadRequestError('vendorUserId and subVendorUserId are required');
  }
  const result = await linkVendorService(vendorUserId, subVendorUserId, user_id, mediator_payin_commission, mediator_payout_commission);
  await invalidateVendorsCache(req.user.company_id);
  return sendSuccess(res, result, 'Vendor linked successfully');
};

const unlinkVendor = async (req, res) => {
  const { vendorUserId, subVendorUserId } = req.body;
  const { user_id } = req.user;
  if (!vendorUserId || !subVendorUserId) {
    throw new BadRequestError('vendorUserId and subVendorUserId are required');
  }
  const result = await unlinkVendorService(vendorUserId, subVendorUserId, user_id);
  await invalidateVendorsCache(req.user.company_id);
  return sendSuccess(res, result, 'Vendor unlinked successfully');
};

const transferVendor = async (req, res) => {
  const { subVendorUserId, newVendorUserId, currentVendorUserId } = req.body;
  const { user_id } = req.user;
  if (!subVendorUserId || !newVendorUserId || !currentVendorUserId) {
    throw new BadRequestError('subVendorUserId, newVendorUserId, and currentVendorUserId are required');
  }
  const result = await transferVendorService(subVendorUserId, newVendorUserId, currentVendorUserId, user_id);
  await invalidateVendorsCache(req.user.company_id);
  return sendSuccess(res, result, 'Vendor transferred successfully');
};

export {
  createVendor,
  getVendorsBySearch,
  getVendors,
  getVendorCodes,
  getVendorById,
  getBankResponseAccessByID,
  updateVendor,
  deleteVendor,
  getVendorByCode,
  linkVendor,
  unlinkVendor,
  transferVendor,
};
