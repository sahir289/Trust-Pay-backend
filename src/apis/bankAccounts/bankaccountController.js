import { BadRequestError } from '../../utils/appErrors.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { getMerchantBankDao } from './bankaccountDao.js';
import { getBankaccountService, createBankaccountService, updateBankaccountService, deleteBankaccountService } from './bankaccountServices.js';
import { sendError } from '../../utils/responseHandlers.js';
const getBankaccount = async (req, res) => {
  try {
    const {company_id} = req.user;
    let payload = req.query.search;
    payload.company_id=company_id;
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
    const {company_id}= req.user;
    const data = await getBankaccountService({id:id,company_id:company_id});
    console.log('get Bank successfully');
    return sendSuccess(res, data, 'get Bank successfully');
  } catch (error) {
    console.error('error getting while getting bank', error);
  }
};

const createBankaccount = async (req, res) => {
  try {
    let payload = req.body;
      if (!payload) {
        console.error('payload is required');
        return sendError(res, 'payload is required', 'Validation Error');
      }
      const {company_id} = req.user;
      payload.company_id=company_id;
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
    const {company_id}  = req.user;
    const data = await updateBankaccountService(id,company_id, payload);
    console.log('get Banks successfully');
    return sendSuccess(res, data, 'get Banks successfully');
  } catch (error) {
    console.error('error getting while updating banks', error);
  }
}

const getMerchantBank = async (req, res) => {
  // Fetch the bank account details for the given merchant ID
  const {company_id}=req.user;
  const bankRes = await getMerchantBankDao(req.params.id,company_id);
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
