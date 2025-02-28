import { BadRequestError } from '../../utils/appErrors.js';
import {  transactionWrapper } from '../../utils/db.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { createCompanyService, deleteCompanyService, getCompanyService, updateCompanyService } from './companyServices.js';
import { VALIDATE_COMPANY_SCHEMA, VALIDATE_COMPANY_BY_ID, VALIDATE_UPDATE_COMPANY_STATUS } from '../../schemas/companySchema.js';
import { ValidationError } from '../../utils/appErrors.js';

const getCompany = async (req, res) => {
  try {
    const search = req.query.search;
    const data = await getCompanyService(search);
    return sendSuccess(res, data, 'get Company successfully');
  } catch (error) {
    console.error('error getting while Company', error);
  }
};

const getCompanyById = async (req, res) => {
  try {
    const joiValidation = VALIDATE_COMPANY_BY_ID.validate(req.params);
    if (joiValidation.error) {
      throw new ValidationError(joiValidation.error);
    }
    const { id } = req.params;
    const data = await getCompanyService({ id: id });
    return sendSuccess(res, data, 'get Company successfully');
  } catch (error) {
    console.error('error getting while Company', error);
  }
};

const createCompany = async (req, res) => {
  try {
    let payload = req.body;
    const joiValidation = VALIDATE_COMPANY_SCHEMA.validate(payload);
    if (joiValidation.error) {
      throw new ValidationError(joiValidation.error);
    }
    const { role } = req.user;
    // const data = 
    await transactionWrapper(createCompanyService)(payload, role);
    console.log('Create Company successfully');
    return sendSuccess(res, 'Create Company successfully');
  } catch (error) {
    console.log('Error while creating company', 'error', error);
    throw new BadRequestError('Error occurred while creating company');
  }
};

const updateCompany = async (req, res) => {
  try {
    const payload = req.body;
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
    await updateCompanyService({id:id}, payload);
    return sendSuccess(res, 'Update Company successfully');
  } catch (error) {
    console.error('error getting while getting Company', error);
  }
}

const deleteCompany = async (req, res) => {
  try {
    const Validation = VALIDATE_COMPANY_BY_ID.validate(req.params);
    if (Validation.error) {
      throw new ValidationError(Validation.error);
    }
    const { id } = req.params;
    await deleteCompanyService({id:id});
    console.log('Delete Company successfully');
    return sendSuccess(res, 'Delete Company successfully');
  } catch (error) {
    console.error('error getting while company', error);
  }
}



export { getCompany, getCompanyById, createCompany, updateCompany, deleteCompany };
