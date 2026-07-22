import { BadRequestError, ValidationError } from '../../utils/appErrors.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import {
  createUserService,
  getUsersNameService,
  getUserByIdService,
  getUsersByUserNameService,
  getUsersService,
  userUpdateService,
  getUsersBySearchService,
  getUsersInfoBySearchService,
  sendMailService,
  updateUser2FAService,
  toggleUser2FAExemptionService,
  resetUser2FAService,
} from './userService.js';
import { CREATE_USER_SCHEMA } from '../../schemas/userSchema.js';
import { Role } from '../../constants/index.js';
import { logger } from '../../utils/logger.js';
import { getUsersContactDao } from './userDao.js';
import { generateCacheKey } from '../../utils/redishashkey.js';
import {
  normalizeQueryForCache,
  readJsonCache,
  shouldServeCachedResponse,
  writeJsonCache,
  invalidateCompanyCacheByPrefix,
} from '../../utils/controllerCache.js';
import config from '../../config/config.js';

const invalidateUsersCache = async (companyId) =>
  invalidateCompanyCacheByPrefix(companyId, 'users:read:', 'Users cache');
const { controllerCacheTtls } = config;

// Fields that must never be set through the generic user-update endpoint.
// Each is managed exclusively by a dedicated, audited flow (password reset,
// 2FA toggle, settlement/balance services, etc.).
const IMMUTABLE_USER_UPDATE_FIELDS = new Set([
  'id',
  'password',
  'company_id',
  'balance',
  'today_balance',
  'two_factor_secret',
  'is_two_factor_enabled',
  'refresh_token',
  'created_by',
  'created_at',
  'sno',
]);

// Fields only an ADMIN/SUPER_ADMIN may change. Stripped for everyone else to
// prevent privilege escalation (e.g. a merchant promoting itself to admin via
// PUT /users/update-user/:id, which is reachable by non-admin roles).
const PRIVILEGED_USER_UPDATE_FIELDS = new Set([
  'role_id',
  'role',
  'designation_id',
  'designation',
  'is_two_factor_exempt',
]);

const sanitizeUserUpdatePayload = (body, actor) => {
  const isAdmin =
    actor?.designation === Role.ADMIN ||
    actor?.designation === Role.SUPER_ADMIN;
  const sanitized = {};
  for (const [key, value] of Object.entries(body || {})) {
    if (IMMUTABLE_USER_UPDATE_FIELDS.has(key)) continue;
    if (!isAdmin && PRIVILEGED_USER_UPDATE_FIELDS.has(key)) continue;
    sanitized[key] = value;
  }
  return sanitized;
};

const getUsers = async (req, res) => {
  const { role, company_id, user_id, designation } = req.user;
  const { page, limit } = req.query;
  const cacheKey = `users:read:${company_id}:list:${generateCacheKey(
    {
      company_id,
      role,
      user_id,
      designation,
      page,
      limit,
      query: normalizeQueryForCache(req.query),
    },
    'users-list',
  )}`;

  const cached = await readJsonCache(cacheKey, 'Users list cache');
  if (shouldServeCachedResponse(cached, req.query)) {
    return sendSuccess(res, cached, 'getUsers successfully');
  }

  const data = await getUsersService(
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

  await writeJsonCache(cacheKey, data, controllerCacheTtls.users.list);

  return sendSuccess(res, data, 'getUsers successfully');
};

const getUsersnames = async (req, res) => {
  const {company_id} = req.user;
  const cacheKey = `usersname:read:${company_id}:list:${generateCacheKey(
    {
      company_id,
      query: normalizeQueryForCache(req.query),
    },
    'usersname-list',
  )}`;

  const cached = await readJsonCache(cacheKey, 'Users-name list cache');
  if (shouldServeCachedResponse(cached, req.query)) {
    return sendSuccess(res, cached, 'getUsersName successfully');
  }

  const data = await getUsersNameService(
    {
      company_id
    },
  );

  await writeJsonCache(cacheKey, data, controllerCacheTtls.users.list);

  return sendSuccess(res, data, 'getUsersname successfully');
};

const getUsersBySearch = async (req, res) => {
  const { role, company_id, user_id, designation } = req.user;
  const { page, limit } = req.query;
  const cacheKey = `users:read:${company_id}:search:${generateCacheKey(
    {
      company_id,
      role,
      user_id,
      designation,
      page,
      limit,
      query: normalizeQueryForCache(req.query),
    },
    'users-search',
  )}`;

  const cached = await readJsonCache(cacheKey, 'Users search cache');
  if (shouldServeCachedResponse(cached, req.query)) {
    return sendSuccess(res, cached, 'getUsers successfully');
  }

  const data = await getUsersBySearchService(
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

  await writeJsonCache(cacheKey, data, controllerCacheTtls.users.search);

  return sendSuccess(res, data, 'getUsers successfully');
};

const getUsersInfoBySearch = async (req, res) => {
  const { role, company_id } = req.user;
  const { page, limit, startDate, endDate } = req.query;
  const cacheKey = `users-info:read:${company_id}:search:${generateCacheKey(
    {
      company_id,
      role,
      page,
      limit,
      startDate,
      endDate,
      query: normalizeQueryForCache(req.query),
    },
    'users-info-search',
  )}`;

  const cached = await readJsonCache(cacheKey, 'Users-info search cache');
  if (shouldServeCachedResponse(cached, req.query)) {
    return sendSuccess(res, cached, 'getUsersInfo successfully');
  }

  const data = await getUsersInfoBySearchService(
    {
      company_id,
      ...req.query,
    },
    role,
    page,
    limit,
    startDate,
    endDate,
  );

  await writeJsonCache(cacheKey, data, controllerCacheTtls.users.search);

  return sendSuccess(res, data, 'getUsers successfully');
};

const getUsersByUserName = async (req, res) => {
  const { role, company_id } = req.user;
  const { username } = req.body;
  const ids = { company_id };
  if (!username) {
    logger.error('Username is required');
    throw new BadRequestError('Username is required');
  }
  const cacheKey = `users:read:${company_id}:username:${generateCacheKey(
    { company_id, role, username },
    'users-username',
  )}`;

  const cached = await readJsonCache(cacheKey, 'Users by-username cache');
  if (shouldServeCachedResponse(cached, req.query)) {
    return sendSuccess(res, cached, 'getUsers successfully');
  }

  const data = await getUsersByUserNameService(username, ids, role);

  await writeJsonCache(cacheKey, data, controllerCacheTtls.users.byUsername);

  return sendSuccess(res, data, 'getUsers successfully');
};

const getUserById = async (req, res) => {
  const { role, role_id, designation_id, company_id } = req.user;
  const { id } = req.params;
  const ids = { role_id, designation_id, company_id, id };
  const cacheKey = `users:read:${company_id}:byid:${id}:${role}:${designation_id}:${role_id}`;

  const cached = await readJsonCache(cacheKey, 'Users by-id cache');
  if (shouldServeCachedResponse(cached, req.query)) {
    return sendSuccess(res, cached, 'getting User by id successfully');
  }

  const data = await getUserByIdService(ids, role);

  await writeJsonCache(cacheKey, data, controllerCacheTtls.users.byId);

  return sendSuccess(res, data, 'getting User by id successfully');
};

const createUser = async (req, res) => {
  const joiValidation = CREATE_USER_SCHEMA.validate(req.body);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  const { company_id, user_id, user_name } = req.user;
  let payload = req.body;
  const verifyContact = await getUsersContactDao(
    company_id,
    payload.contact_no,
  );
  if (verifyContact) {
    throw new BadRequestError('Contact number already exists');
  }
  payload.user_name = payload.user_name.trim();
  payload.is_enabled = true;
  payload.company_id = company_id;
  payload.created_by = user_id;
  payload.updated_by = user_id;
  const user = await createUserService(
    payload,
  );
  await invalidateUsersCache(company_id);
  return sendSuccess(
    res,
    { id: user.id, created_by: user_name },
    'Create user successfully',
  );
};

const updateUser = async (req, res) => {
  const { company_id, user_id, user_name } = req.user;
  const payload = sanitizeUserUpdatePayload(req.body, req.user);
  payload.updated_by = user_id;
  const id = req.params.id;
  const ids = { id, company_id };
  const user = await userUpdateService(ids, payload);
  await invalidateUsersCache(company_id);
  return sendSuccess(
    res,
    { id: user.id, updated_by: user_name },
    'Update user successfully',
  );
};

const sendMail = async (req, res) => {
  const { user_name } = req.user;
  let payload = req.body;
  await sendMailService(payload);
  return sendSuccess(
    res,
    { mail_sent_by: user_name },
    'Mail send successfully',
  );
};

const toggleUser2FA = async (req, res) => {
  const { id } = req.params;
  const { isTwoFactorEnabled } = req.body;
  const { company_id } = req.user;

  if (typeof isTwoFactorEnabled !== 'boolean') {
    throw new BadRequestError('isTwoFactorEnabled must be a boolean');
  }

  await updateUser2FAService(id, isTwoFactorEnabled);
  await invalidateUsersCache(company_id);

  return sendSuccess(res, { id, isTwoFactorEnabled }, 'User 2FA updated successfully');
};

const resetUser2FA = async (req, res) => {
  const { id } = req.params;
  const { user_id: adminId, user_name: adminUsername, company_id } = req.user;

  await resetUser2FAService(id, adminId, adminUsername);
  await invalidateUsersCache(company_id);

  return sendSuccess(res, {}, '2FA has been reset. User must re-enroll on next login.');
};

const toggleUser2FAExemption = async (req, res) => {
  const { id } = req.params;
  const { exempt } = req.body;
  const { company_id } = req.user;

  if (typeof exempt !== 'boolean') {
    throw new BadRequestError('exempt must be a boolean');
  }

  const result = await toggleUser2FAExemptionService(id, exempt);
  
  if (!result) {
    throw new BadRequestError('User not found or update failed');
  }

  // Invalidate user cache to ensure fresh data on next request
  await invalidateUsersCache(company_id);

  return sendSuccess(
    res, 
    { id: result.id, user_name: result.user_name, is_two_factor_exempt: result.is_two_factor_exempt }, 
    `User 2FA exemption ${exempt ? 'granted' : 'revoked'} successfully`
  );
};

export {
  getUsers,
  getUsersnames,
  getUsersBySearch,
  getUsersInfoBySearch,
  getUserById,
  getUsersByUserName,
  createUser,
  updateUser,
  sendMail,
  toggleUser2FA,
  toggleUser2FAExemption,
  resetUser2FA,
};
