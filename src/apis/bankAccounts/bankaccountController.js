import { BadRequestError } from '../../utils/appErrors.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { getBankaccountService, createBankaccountService, updateBankaccountService, deleteBankaccountService, getMerchantBankService } from './bankaccountServices.js';

const getBankaccount = async (req, res) => {
  try {
    const payload = req.query.search;
     let filters = {};
    if (payload) {
      filters.user_id = payload; 
    }
    const data = await getBankaccountService(filters);
    console.log('getUsers successfully');
    return sendSuccess(res, data, 'getUsers successfully');
  } catch (error) {
    console.error('error getting while logging in', error);
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
    console.log('getUsers successfully');
    return sendSuccess(res, data, 'getUsers successfully');
  } catch (error) {
    console.error('error getting while logging in', error);
  }
}

const updateBankaccount = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body;
    const data = await updateBankaccountService(id, payload);
    console.log('getUsers successfully');
    return sendSuccess(res, data, 'getUsers successfully');
  } catch (error) {
    console.error('error getting while logging in', error);
  }
}

const getMerchantBank = async (req, res) => {
  // Fetch the bank account details for the given merchant ID
  const bankRes = await getMerchantBankService(req.params.id);
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
    console.log('getUsers successfully');
    return sendSuccess(res, data, 'getUsers successfully');
  } catch (error) {
    console.error('error getting while logging in', error);
  }
}
export { getBankaccount, createBankaccount, updateBankaccount, deleteBankaccount, getMerchantBank };
