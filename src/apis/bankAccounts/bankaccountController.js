import {
  columns,
  merchantColumns,
  Role,
  vendorColumns,
} from '../../constants/index.js';
import {
  BANK_ACCOUNT_SCHEMA,
  UPDATE_BANK_ACCOUNT_SCHEMA,
  VALIDATE_ACTIVE_INACTIVE_BANK_ACCOUNT_SCHEMA,
  VALIDATE_BANK_RESPONSE_BY_ID,
} from '../../schemas/bankAccoountSchema.js';
import { ValidationError } from '../../utils/appErrors.js';
import { sendError, sendSuccess } from '../../utils/responseHandlers.js';
import { getBankaccountDao, getMerchantBankDao } from './bankaccountDao.js';
import { generateCacheKey } from '../../utils/redishashkey.js';
import {
  normalizeQueryForCache,
  readJsonCache,
  writeJsonCache,
  invalidateCompanyCacheByPrefix,
} from '../../utils/controllerCache.js';
import config from '../../config/config.js';
import {
  getBankaccountService,
  createBankaccountService,
  updateBankaccountService,
  deleteBankaccountService,
  getBankaccountServiceNickName,
  getBankAccountBySearchService,
  activeInactiveBankAccountService,
} from './bankaccountServices.js';
const invalidateBankAccountsCache = async (companyId) =>
  invalidateCompanyCacheByPrefix(
    companyId,
    'bankaccounts:read:',
    'BankAccounts cache',
  );
const { controllerCacheTtls } = config;

const getBankaccount = async (req, res) => {
  const { company_id } = req.user;
  const { role, user_id, designation } = req.user;
  const { page, limit, bank_used_for } = req.query;
  const cacheKey = `bankaccounts:read:${company_id}:list:${generateCacheKey(
    {
      company_id,
      role,
      user_id,
      designation,
      page,
      limit,
      query: normalizeQueryForCache(req.query),
    },
    'bankaccounts-list',
  )}`;

  const cached = await readJsonCache(cacheKey, 'BankAccounts list cache');
  if (cached) {
    return sendSuccess(res, cached, 'get Banks successfully');
  }

  const filters = {
    bank_used_for,
  };
  const data = await getBankaccountService(
    filters,
    company_id,
    role,
    page,
    limit,
    user_id,
    designation,
  );

  await writeJsonCache(cacheKey, data, controllerCacheTtls.bankAccounts.list);

  return sendSuccess(res, data, 'get Banks successfully');
};

const getBankAccountBySearch = async (req, res) => {
  const { company_id } = req.user;
  const { role, user_id, designation } = req.user;
  const { page, limit, bank_used_for, search ,active } = req.query;
  const cacheKey = `bankaccounts:read:${company_id}:search:${generateCacheKey(
    {
      company_id,
      role,
      user_id,
      designation,
      page,
      limit,
      query: normalizeQueryForCache(req.query),
      search,
    },
    'bankaccounts-search',
  )}`;

  const cached = await readJsonCache(cacheKey, 'BankAccounts search cache');
  if (cached) {
    return sendSuccess(res, cached, 'get Banks successfully');
  }

  const filters = {
    bank_used_for,
    active,
  };
  const data = await getBankAccountBySearchService(
    filters,
    company_id,
    role,
    page,
    limit,
    user_id,
    designation,
    search,
  );

  await writeJsonCache(cacheKey, data, controllerCacheTtls.bankAccounts.search);

  return sendSuccess(res, data, 'get Banks successfully');
};

const getBankaccountNickName = async (req, res) => {
  const { type, user } = req.query;
  const { company_id, role, user_id, designation } = req.user;
  const data = await getBankaccountServiceNickName(
    company_id,
    type,
    role,
    user_id,
    designation,
    user,
    // check_enabled
  );
  return sendSuccess(res, data, 'get Banks successfully');
};

const getBankaccountById = async (req, res) => {
  const { id } = req.params;
  const { company_id, role } = req.user;
  const cacheKey = `bankaccounts:read:${company_id}:byid:${id}:${role}`;

  const cached = await readJsonCache(cacheKey, 'BankAccounts by-id cache');
  if (cached) {
    return sendSuccess(res, cached, 'get Bank successfully');
  }

  const data = await getBankaccountService(
    {
      company_id: company_id,
      id: id,
    },
    role,
  );

  await writeJsonCache(cacheKey, data, controllerCacheTtls.bankAccounts.byId);

  return sendSuccess(res, data, 'get Bank successfully');
};

const createBankaccount = async (req, res) => {
  let payload = req.body;
  if (!payload.payin_count) {
    payload.payin_count = 0;
  }
  delete payload.qr;
  const joiValidation = BANK_ACCOUNT_SCHEMA.validate(payload);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  const phonePe = payload.is_phonepay ? true : false;
  const intent = payload.is_intent ? true : false;
  const is_staticQR = payload.is_staticQR ? true : false;
  payload.bank_used_for == 'PayIn'
    ? (payload.config = {
        merchants: [],
        is_phonepay: phonePe,
        is_intent: intent,
        is_staticQR: is_staticQR,
      })
    : (payload.config = {});
  delete payload.is_phonepay;
  delete payload.is_intent;
  delete payload.is_staticQR;
  const { user_id, company_id, designation, role, user_name } = req.user;
  payload.created_by = user_id;
  payload.updated_by = user_id;
  payload.company_id = company_id;
  //error for nick name must be unique
  const unique = await getBankaccountDao(
    { nick_name: payload.nick_name },
    null,
    null,
    role,
  );
  if (unique.length > 0) {
    return sendError(res, 'Nick Name Must Be Unique', 400);
  }
  // const data =
  const bankDetail = await createBankaccountService(
    payload,
    designation,
    user_id,
    company_id,
  );
  await invalidateBankAccountsCache(company_id);
  return sendSuccess(
    res,
    { id: bankDetail.id, created_by: user_name },
    'Created Banks successfully',
  );
};

const updateBankaccount = async (req, res) => {
  const { id } = req.params;
  const { user_name, role } = req.user;
  let payload = req.body;
  const joiValidation = UPDATE_BANK_ACCOUNT_SCHEMA.validate(req.body);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  const { company_id, user_id } = req.user;
  payload.updated_by = user_id;
  const ids = { id, company_id };
  // const data =
  const updatebank = await updateBankaccountService(
    ids,
    payload,
    role,
    company_id,
    user_id,
  );
  await invalidateBankAccountsCache(company_id);
  return sendSuccess(
    res,
    { id: updatebank.id, updated_by: user_name },
    'Updated Banks successfully',
  );
};

const getMerchantBank = async (req, res) => {
  // Fetch the bank account details for the given merchant ID
  const { company_id, user_id } = req.user;
  const { role } = req.user;
  const filterColumns =
    role === Role.MERCHANT
      ? merchantColumns.BANK_ACCOUNT
      : role === Role.VENDOR
        ? vendorColumns.BANK_ACCOUNT
        : columns.BANK_ACCOUNT;
  const cacheKey = `bankaccounts:read:${company_id}:merchantbank:${generateCacheKey(
    {
      company_id,
      user_id,
      role,
    },
    'bankaccounts-merchant-bank',
  )}`;

  const cached = await readJsonCache(cacheKey, 'BankAccounts merchant-bank cache');
  if (cached) {
    return sendSuccess(res, cached, 'Bank details fetched successfully');
  }

  // const bankRes = await getMerchantBankDao({
  //   company_id,
  //   user_id
  // }, role);
  const bankRes = await getMerchantBankDao(
    { company_id: company_id, user_id: user_id },
    null,
    null,
    null,
    null,
    filterColumns,
  );

  await writeJsonCache(
    cacheKey,
    bankRes,
    controllerCacheTtls.bankAccounts.merchantBank,
  );

  return sendSuccess(res, bankRes, 'Bank details fetched successfully');
};

const deleteBankaccount = async (req, res) => {
  const { id } = req.params;
  const joiValidation = VALIDATE_BANK_RESPONSE_BY_ID.validate(id);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  const { company_id, user_name, user_id } = req.user;
  const ids = { id, company_id };
  // const data =
  const deletebank = await deleteBankaccountService(
    ids,
    user_id,
  );
  await invalidateBankAccountsCache(company_id);
  return sendSuccess(
    res,
    { id: deletebank.id, deleted_by: user_name },
    'Deleted Banks Successfully',
  );
};

const activeInactiveBankAccount = async (req, res) => {
  const { bank_account_id, is_active } = req.body;
  const company_id = req.headers['x-auth-token'];
  const joiValidation = VALIDATE_ACTIVE_INACTIVE_BANK_ACCOUNT_SCHEMA.validate(req.body);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  const ids = { id: bank_account_id, company_id: company_id };
  const payload = {
    is_enabled: is_active,
  };
  const updateBank = await activeInactiveBankAccountService(
    ids,
    payload,
  );
  await invalidateBankAccountsCache(company_id);
  return sendSuccess(
    res,
    { id: updateBank.id },
    `Bank account ${is_active === 'true' ? 'activated' : 'deactivated'} successfully`,
  );
};

export {
  getBankaccount,
  getBankAccountBySearch,
  getBankaccountById,
  createBankaccount,
  updateBankaccount,
  deleteBankaccount,
  getMerchantBank,
  getBankaccountNickName,
  activeInactiveBankAccount,
};
