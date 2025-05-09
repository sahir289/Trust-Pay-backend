import {
  columns,
  merchantColumns,
  Role,
  vendorColumns,
} from '../../constants/index.js';
import {
  BANK_ACCOUNT_SCHEMA,
  UPDATE_BANK_ACCOUNT_SCHEMA,
  VALIDATE_BANK_RESPONSE_BY_ID,
} from '../../schemas/bankAccoountSchema.js';
import { BadRequestError, ValidationError } from '../../utils/appErrors.js';
import { transactionWrapper } from '../../utils/db.js';
import { logger } from '../../utils/logger.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { getMerchantBankDao } from './bankaccountDao.js';
import {
  getBankaccountService,
  createBankaccountService,
  updateBankaccountService,
  deleteBankaccountService,
  getBankaccountServiceNickName,
  getBankAccountBySearchService,
} from './bankaccountServices.js';

const getBankaccount = async (req, res) => {
  const { company_id } = req.user;
  const { role, user_id, designation } = req.user;
  const { page, limit, bank_used_for } = req.query;
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
    designation
  );
  logger.log('get Banks successfully', role);
  return sendSuccess(res, data, 'get Banks successfully');
};

const getBankAccountBySearch = async (req, res) => {
  const { company_id, role } = req.user;
  const { search, bank_used_for, page = 1, limit = 10 } = req.query;
  if (!search) {
    throw new BadRequestError('search is required');
  }
  const data = await getBankAccountBySearchService(
    company_id,
    role,
    search,
    bank_used_for,
    page,
    limit,
  );
  return sendSuccess(res, data, 'get Banks by search successfully');
};

const getBankaccountNickName = async (req, res) => {
  const { type } = req.query;
  const { company_id } = req.user;
  const data = await getBankaccountServiceNickName(company_id, type);
  return sendSuccess(res, data, 'get Banks successfully');
};

const getBankaccountById = async (req, res) => {
  const { id } = req.params;
  const { company_id, role } = req.user;
  const data = await getBankaccountService(
    {
      company_id: company_id,
      id: id,
    },
    role,
  );
  console.log('get Bank successfully');
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
  payload.bank_used_for == 'PayIn'
    ? (payload.config = {
        merchants: [],
        is_phonepay: phonePe,
        is_intent: intent,
      })
    : (payload.config = {});
  delete payload.is_phonepay;
  delete payload.is_intent;
  const { user_id, company_id, designation,} = req.user;
  payload.created_by = user_id;
  payload.updated_by = user_id;
  payload.company_id = company_id;
  // const data =
  await createBankaccountService(payload,designation,user_id);
  console.log('get Banks successfully');
  return sendSuccess(res, {}, 'Created Banks successfully');
};

const updateBankaccount = async (req, res) => {
  const { id } = req.params;
  let payload = req.body;
  const joiValidation = UPDATE_BANK_ACCOUNT_SCHEMA.validate(req.body);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  const { company_id, user_id } = req.user;
  payload.updated_by = user_id;
  const ids = { id, company_id };
  // const data =
  await transactionWrapper(updateBankaccountService)(ids, payload);
  console.log('get Banks successfully');
  return sendSuccess(res, {}, 'Updated Banks successfully');
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

  // const bankRes = await getMerchantBankDao({
  //   company_id,
  //   user_id
  // }, role);
  console.log(
    { company_id: company_id, user_id: user_id },
    role,
    req.user,
    'company_iduser_id',
  );
  const bankRes = await getMerchantBankDao(
    { company_id: company_id, user_id: user_id },
    null,
    null,
    null,
    null,
    filterColumns,
  );
  return sendSuccess(res, bankRes, 'Bank details fetched successfully');
};

const deleteBankaccount = async (req, res) => {
  const { id } = req.params;
  const joiValidation = VALIDATE_BANK_RESPONSE_BY_ID.validate(id);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  const { company_id } = req.user;
  const ids = { id, company_id };
  // const data =
  await transactionWrapper(deleteBankaccountService)(ids);
  return sendSuccess(res, {}, 'deleted Banks successfully');
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
};
