import { BadRequestError, ValidationError } from '../../utils/appErrors.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import {
  createUserService,
  getUserByIdService,
  getUsersByUserNameService,
  getUsersService,
  userUpdateService,
  getUsersBySearchService,
  sendMailService,
  updateUser2FAService,
  resetUser2FAService,
} from './userService.js';
import { CREATE_USER_SCHEMA } from '../../schemas/userSchema.js';
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

const getUsers = async (req, res) => {
  // const reqBody = req.body;
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
  let payload = req.body;
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
  const { isTwoFactorRequired } = req.body;
  const { company_id } = req.user;

  if (typeof isTwoFactorRequired !== 'boolean') {
    throw new BadRequestError('isTwoFactorRequired must be a boolean');
  }

  await updateUser2FAService(id, isTwoFactorRequired);
  await invalidateUsersCache(company_id);

  return sendSuccess(res, { id, isTwoFactorRequired }, 'User 2FA requirement updated successfully');
};

const resetUser2FA = async (req, res) => {
  const { id } = req.params;
  const { user_id: adminId, user_name: adminUsername, company_id } = req.user;

  await resetUser2FAService(id, adminId, adminUsername);
  await invalidateUsersCache(company_id);

  return sendSuccess(res, {}, '2FA has been reset. User must re-enroll on next login.');
};

export {
  getUsers,
  getUsersBySearch,
  getUserById,
  getUsersByUserName,
  createUser,
  updateUser,
  sendMail,
  toggleUser2FA,
  resetUser2FA,
};
