import { transactionWrapper } from '../../utils/db.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import {
  createCompanyService,
  deleteCompanyService,
  getCompanyByIdService,
  getCompanyNamesService,
  getCompanyService,
  updateCompanyService,
} from './companyServices.js';
import {
  VALIDATE_COMPANY_SCHEMA,
  VALIDATE_COMPANY_BY_ID,
  VALIDATE_UPDATE_COMPANY_STATUS,
} from '../../schemas/companySchema.js';
import { ValidationError } from '../../utils/appErrors.js';

const getCompany = async (req, res) => {
  const { page, limit } = req.query;
  const company_id = req?.user?.company_id || req?.query?.company_id;
  
  let filters = {
    company_id,
    ...req.query,
  };
  
  let searchTerms;
  if (filters.search) {
    searchTerms = filters.search
      .split(',')
      .map((term) => term.trim())
      .filter((term) => term.length > 0);
    delete filters.search;
  }
  
  const data = await getCompanyService(
    filters,
    searchTerms,
    page,
    limit,
  );
  return sendSuccess(res, data, 'get Company successfully');
};

const getCompanyNamesController = async (req, res) => {
  const data = await getCompanyNamesService();
  return sendSuccess(res, data, 'get Company names successfully');
};

const getCompanyById = async (req, res) => {
  const joiValidation = VALIDATE_COMPANY_BY_ID.validate(req.params);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  const { id } = req.params;
  const data = await getCompanyByIdService({ id: id });
  return sendSuccess(res, data, 'get Company successfully');
};

const createCompany = async (req, res) => {
  let payload = req.body;
  const { user_name } = req.user;
  const joiValidation = VALIDATE_COMPANY_SCHEMA.validate(payload);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }

  const data = await transactionWrapper(createCompanyService)(payload, user_name, true);
  return sendSuccess(res, data, 'Create Company successfully');
};

const signUpCompany = async (req, res) => {
  let payload = req.body;
  const user_name = payload.user_name;
  const joiValidation = VALIDATE_COMPANY_SCHEMA.validate(payload);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }

  const data = await transactionWrapper(createCompanyService)(payload, user_name, false);
  return sendSuccess(res, data, 'Create Company successfully');
};

const updateCompany = async (req, res) => {
  const payload = req.body;
  const { user_name } = req.user;
  const joiValidation = VALIDATE_UPDATE_COMPANY_STATUS.validate(payload);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  const Validation = VALIDATE_COMPANY_BY_ID.validate(req.params);
  if (Validation.error) {
    throw new ValidationError(Validation.error);
  }
  const { id } = req.params;
  // const data =
  await updateCompanyService({ id: id }, payload, user_name);
  return sendSuccess(res, {}, 'Update Company successfully');
};

const deleteCompany = async (req, res) => {
  const Validation = VALIDATE_COMPANY_BY_ID.validate(req.params);
  if (Validation.error) {
    throw new ValidationError(Validation.error);
  }
  const { id } = req.params;
  await deleteCompanyService({ id: id });

  return sendSuccess(res, {}, 'Delete Company successfully');
};

export {
  getCompany,
  getCompanyById,
  createCompany,
  updateCompany,
  deleteCompany,
  getCompanyNamesController,
  signUpCompany,
};
