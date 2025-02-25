import { BANK_ACCOUNT_SCHEMA, UPDATE_BANK_ACCOUNT_SCHEMA } from '../../schemas/bankAccoountSchema.js';
import { VALIDATE_BANK_RESPONSE_BY_ID } from '../../schemas/bankResponseSchema.js';
import { BadRequestError, ValidationError } from '../../utils/appErrors.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { getMerchantBankDao } from './bankaccountDao.js';
import { getBankaccountService, createBankaccountService, updateBankaccountService, deleteBankaccountService } from './bankaccountServices.js';


const getBankaccount = async (req, res) => {
  try {
    const { company_id, user_id, role } = req.user;
    // let search = req.query.search;
    // Todo: Do we need to validate????
    // const joiValidation = BANK_ACCOUNT_SCHEMA.validate(payload);
    // if (joiValidation.error) {
    //   throw new ValidationError(joiValidation.error);
    // }
    const data = await getBankaccountService({
      company_id,
      user_id,
      // TODO: search
    }, role);
    console.log('get Banks successfully');
    return sendSuccess(res, data, 'get Banks successfully');
  } catch (error) {
    console.error('error getting while getting banks', error);
  }
};

const getBankaccountById = async (req, res) => {
  try {
    const { id } = req.params;
    const { company_id, user_id, role } = req.user;
    const data = await getBankaccountService({
      company_id,
      user_id,
      id,
    }, role);
    console.log('get Bank successfully');
    return sendSuccess(res, data, 'get Bank successfully');
  } catch (error) {
    console.error('error getting while getting bank', error);
  }
};

const createBankaccount = async (req, res) => {
  try {
    let payload = req.body;
    const { user_id, company_id, role } = req.user
    payload.user_id = user_id;
    payload.company_id = company_id;
    const joiValidation = BANK_ACCOUNT_SCHEMA.validate(payload);
    if (joiValidation.error) {
      throw new ValidationError(joiValidation.error);
    }
    if (!payload) {
      console.error('payload is required');
      throw new BadRequestError('payload is required');
    }
    const data = await createBankaccountService(payload, role);
    console.log('get Banks successfully');
    return sendSuccess(res, data, 'get Banks successfully');
  } catch (error) {
    console.error('error getting while creating banks', error);
  }
}

const updateBankaccount = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body;
    const { company_id, user_id, role } = req.user;
    const ids = { id, company_id, user_id };
    const joiValidation = UPDATE_BANK_ACCOUNT_SCHEMA.validate(payload);
    if (joiValidation.error) {
      throw new ValidationError(joiValidation.error);
    }
    const data = await updateBankaccountService(ids, payload, role);
    console.log('get Banks successfully');
    return sendSuccess(res, data, 'get Banks successfully');
  } catch (error) {
    console.error('error getting while updating banks', error);
  }
}

const getMerchantBank = async (req, res) => {
  // Fetch the bank account details for the given merchant ID
  const { company_id, user_id, role } = req.user;
  const bankRes = await getMerchantBankDao({
    company_id,
    user_id,
  }, role);
  return sendSuccess(res, bankRes, 'Bank details fetched successfully');
}

const deleteBankaccount = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      console.error('payload is required');
      throw new BadRequestError('payload is required');
    }
    const { company_id, user_id, role } = req.user;
    const ids = { id, company_id, user_id };
    const data = await deleteBankaccountService(ids, role);
    console.log('get Banks successfully');
    return sendSuccess(res, data, 'get Banks successfully');
  } catch (error) {
    console.error('error getting while deleting banks', error);
  }
}
export { getBankaccount, getBankaccountById, createBankaccount, updateBankaccount, deleteBankaccount, getMerchantBank };
