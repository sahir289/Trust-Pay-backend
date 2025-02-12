import { BadRequestError } from '../../utils/appErrors.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { getBankaccountService, createBankaccountByIDService, updateBankaccountByIDService, deleteBankaccountByIDService, getMerchantBankByIdService } from './bankaccountServices.js';

const getBankaccount = async (req, res) => {
  try {
    const { payload } = req.query;
    const data = await getBankaccountService(payload);
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
    const data = await createBankaccountByIDService(payload);
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
    const data = await updateBankaccountByIDService(id, payload);
    console.log('getUsers successfully');
    return sendSuccess(res, data, 'getUsers successfully');
  } catch (error) {
    console.error('error getting while logging in', error);
  }
}

const getMerchantBankById = async (req, res) => {
  // Fetch the bank account details for the given merchant ID
  const bankRes = await getMerchantBankByIdService(req.params.id);
  return sendSuccess(res, bankRes, 'Bank details fetched successfully');
}

const deleteBankaccount = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      console.error('payload is required');
      throw new BadRequestError('payload is required');
    }
    const data = await deleteBankaccountByIDService(id);
    console.log('getUsers successfully');
    return sendSuccess(res, data, 'getUsers successfully');
  } catch (error) {
    console.error('error getting while logging in', error);
  }
}
export { getBankaccount, createBankaccount, updateBankaccount, deleteBankaccount, getMerchantBankById };
