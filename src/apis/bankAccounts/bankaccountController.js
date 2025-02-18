import { BadRequestError } from '../../utils/appErrors.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { getMerchantBankDao } from './bankaccountDao.js';
import { getBankaccountService, createBankaccountService, updateBankaccountService, deleteBankaccountService } from './bankaccountServices.js';

const getBankaccount = async (req, res) => {
  try {
    const payload = req.query.search;
    const data = await getBankaccountService(payload);
    console.log('get Banks successfully');
    return sendSuccess(res, data, 'get Banks successfully');
  } catch (error) {
    console.error('error getting while getting banks', error);
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
export { getBankaccount, createBankaccount, updateBankaccount, deleteBankaccount, getMerchantBank };
