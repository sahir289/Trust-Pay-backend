import { VALIDATE_BANK_RESPONSE_BY_ID } from '../../schemas/bankResponseSchema.js';
import { BadRequestError, ValidationError } from '../../utils/appErrors.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { getBankaccountDao, getMerchantBankDao } from './bankaccountDao.js';
import { getBankaccountService, createBankaccountService, updateBankaccountService, deleteBankaccountService } from './bankaccountServices.js';

const getBankaccountALL = async (req, res) => {
  try {
    
    const data = await getBankaccountDao();
    console.log('get Banks successfully');
    return sendSuccess(res, data, 'get Banks successfully');
  } catch (error) {
    console.error('error getting while getting banks', error);
  }
};
const getBankaccount = async (req, res) => {
  try {
    
    const payload = req.query.search;
    const joiValidation = VALIDATE_BANK_RESPONSE_BY_ID.validate(payload);
    if (joiValidation.error) {
        throw new ValidationError(joiValidation.error);
    }
    const data = await getBankaccountService(payload);
    console.log('get Banks successfully');
    return sendSuccess(res, data, 'get Banks successfully');
  } catch (error) {
    console.error('error getting while getting banks', error);
  }
};

const getBankaccountById = async (req, res) => {
  try {
    const {id} = req.params;
    const data = await getBankaccountService({id:id});
    console.log('get Bank successfully');
    return sendSuccess(res, data, 'get Bank successfully');
  } catch (error) {
    console.error('error getting while getting bank', error);
  }
};

const createBankaccount = async (req, res) => {
  try {
    const payload = req.body;

    if (!payload) {
      console.error('payload is required');
      throw new BadRequestError('payload is required');
    }
    const data = await createBankaccountService(payload);
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
    const data = await updateBankaccountService(id, payload);
    console.log('get Banks successfully');
    return sendSuccess(res, data, 'get Banks successfully');
  } catch (error) {
    console.error('error getting while updating banks', error);
  }
}

const getMerchantBank = async (req, res) => {
  // Fetch the bank account details for the given merchant ID
  const bankRes = await getMerchantBankDao(req.params.id);
  return sendSuccess(res, bankRes, 'Bank details fetched successfully');
}

const deleteBankaccount = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      console.error('payload is required');
      throw new BadRequestError('payload is required');
    }
    const data = await deleteBankaccountService(id);
    console.log('get Banks successfully');
    return sendSuccess(res, data, 'get Banks successfully');
  } catch (error) {
    console.error('error getting while deleting banks', error);
  }
}
export { getBankaccount,getBankaccountById, createBankaccount, updateBankaccount, deleteBankaccount, getMerchantBank };
