import {
  BENEFICIARY_ACCOUNT_SCHEMA,
  UPDATE_BENEFICIARY_ACCOUNT_SCHEMA,
  VALIDATE_BENEFICIARY_ACCOUNT_BY_ID,
} from '../../schemas/BeneficiaryAccountSchema.js';
import { BadRequestError, ValidationError } from '../../utils/appErrors.js';
import { transactionWrapper } from '../../utils/db.js';
import { logger } from '../../utils/logger.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import {
  getBeneficiaryAccountService,
  createBeneficiaryAccountService,
  updateBeneficiaryAccountService,
  deleteBeneficiaryAccountService,
  getBeneficiaryAccountServiceByBankName,
  getBeneficiaryAccountBySearchService,
} from './beneficiaryAccountServices.js';

const getBeneficiaryAccount = async (req, res) => {
  const { role, user_id, designation } = req.user;
  const { page, limit, beneficiary_role } = req.query;
  const filters = {
    beneficiary_role,
  };
  const data = await getBeneficiaryAccountService(
    filters,
    role,
    page,
    limit,
    user_id,
    designation,
  );
  logger.log('get Beneficiary successfully', role);
  return sendSuccess(res, data, 'get Beneficiary successfully');
};

const getBeneficiaryAccountBySearch = async (req, res) => {
  const { role } = req.user;
  const { search, bank_used_for, page = 1, limit = 10 } = req.query;
  if (!search) {
    throw new BadRequestError('search is required');
  }
  const data = await getBeneficiaryAccountBySearchService(
    role,
    search,
    bank_used_for,
    page,
    limit,
  );
  return sendSuccess(res, data, 'get Beneficiary by search successfully');
};

const getBeneficiaryAccountByBankName = async (req, res) => {
  const { type } = req.query;
  const { company_id, role, user_id, designation } = req.user;
  const data = await getBeneficiaryAccountServiceByBankName(
    company_id,
    type,
    role,
    user_id,
    designation,
  );
  return sendSuccess(res, data, 'get Beneficiary successfully');
};

const getBeneficiaryAccountById = async (req, res) => {
  const { id } = req.params;
  const { role } = req.user;
  const data = await getBeneficiaryAccountService(
    {
      id: id,
    },
    role,
  );
  logger.log('get Bank successfully');
  return sendSuccess(res, data, 'get Bank successfully');
};

const createBeneficiaryAccount = async (req, res) => {
  let payload = req.body;
  const joiValidation = BENEFICIARY_ACCOUNT_SCHEMA.validate(payload);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  const { user_id, role } = req.user;
  payload.created_by = user_id;
  payload.updated_by = user_id;
  // const data =
  await transactionWrapper(createBeneficiaryAccountService)(payload, role);
  logger.log('Created Beneficiary successfully');
  return sendSuccess(res, {}, 'Created Beneficiary successfully');
};

const updateBeneficiaryAccount = async (req, res) => {
  const { id } = req.params;
  let payload = req.body;
  const joiValidation = UPDATE_BENEFICIARY_ACCOUNT_SCHEMA.validate(req.body);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  const { company_id, user_id } = req.user;
  payload.updated_by = user_id;
  const ids = { id, company_id };
  // const data =
  await transactionWrapper(updateBeneficiaryAccountService)(ids, payload);
  logger.log('get Beneficiary successfully');
  return sendSuccess(res, {}, 'Updated Beneficiary successfully');
};

const deleteBeneficiaryAccount = async (req, res) => {
  const { id } = req.params;
  const joiValidation = VALIDATE_BENEFICIARY_ACCOUNT_BY_ID.validate(id);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  const { company_id } = req.user;
  const ids = { id, company_id };
  // const data =
  await transactionWrapper(deleteBeneficiaryAccountService)(ids);
  return sendSuccess(res, {}, 'deleted Beneficiary successfully');
};
export {
  getBeneficiaryAccount,
  getBeneficiaryAccountBySearch,
  getBeneficiaryAccountById,
  createBeneficiaryAccount,
  updateBeneficiaryAccount,
  deleteBeneficiaryAccount,
  getBeneficiaryAccountByBankName,
};
