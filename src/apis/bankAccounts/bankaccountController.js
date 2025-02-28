import { columns, merchantColumns, Role, vendorColumns } from '../../constants/index.js';
import { BANK_ACCOUNT_SCHEMA, UPDATE_BANK_ACCOUNT_SCHEMA } from '../../schemas/bankAccoountSchema.js';
import { BadRequestError, ValidationError } from '../../utils/appErrors.js';
import { transactionWrapper } from '../../utils/db.js';
import { sendError, sendSuccess } from '../../utils/responseHandlers.js';
import { getMerchantBankDao } from './bankaccountDao.js';
import { getBankaccountService, createBankaccountService, updateBankaccountService, deleteBankaccountService } from './bankaccountServices.js';


const getBankaccount = async (req, res) => {
  try {
    const { company_id } = req.user;
    const {role} = req.user;
    const data = await getBankaccountService({
      company_id : company_id
    }, role);
    console.log('get Banks successfully', role);
    return sendSuccess(res, data, 'get Banks successfully');
  } catch (error) {
    sendError('error getting while getting banks', error);
  }
};

const getBankaccountById = async (req, res) => {
  try {
    const { id } = req.params;
    const { company_id, role } = req.user;
    const data = await getBankaccountService({
      company_id : company_id,
      id: id,
    }, role);
    console.log('get Bank successfully');
    return sendSuccess(res, data, 'get Bank successfully');
  } catch (error) {
    sendError('error getting while getting bank', error);
  }
};

const createBankaccount = async (req, res) => {
  try {
    let payload = req.body;
    const { user_id, company_id, role } = req.user
    payload.created_by = user_id
    payload.company_id = company_id;
    const joiValidation = BANK_ACCOUNT_SCHEMA.validate(payload);
    if (joiValidation.error) {
      throw new ValidationError(joiValidation.error);
    }
    if (!payload) {
      console.error('payload is required');
      throw new BadRequestError('payload is required');
    }
    // const data =
    await createBankaccountService(payload, role);
    console.log('get Banks successfully');
    return sendSuccess(res, 'Created Banks successfully');
  } catch (error) {
    sendError('error getting while creating banks', error);
  }
}

const updateBankaccount = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body;
    const { company_id , updated_by} = req.user;
    payload.updated_by = updated_by;
    const ids = { id, company_id };
    const joiValidation = UPDATE_BANK_ACCOUNT_SCHEMA.validate(payload);
    if (joiValidation.error) {
      throw new ValidationError(joiValidation.error);
    }
    
    // const data = 
    await transactionWrapper(updateBankaccountService)(ids, payload);
    console.log('get Banks successfully');
    return sendSuccess(res, 'Updated Banks successfully');
  } catch (error) {
    sendError('error getting while updating banks', error);
  }
}

const getMerchantBank = async (req, res) => {
  // Fetch the bank account details for the given merchant ID
  const { company_id, user_id } = req.user;
  const {role} = req.user;
  const filterColumns = role === Role.MERCHANT ? merchantColumns.BANK_ACCOUNT : role=== Role.VENDOR ? vendorColumns.BANK_ACCOUNT : columns.BANK_ACCOUNT;
  
  // const bankRes = await getMerchantBankDao({
  //   company_id,
  //   user_id
  // }, role);
  console.log({company_id:company_id ,user_id : user_id}, role, req.user, "company_iduser_id")
  const bankRes=  await getMerchantBankDao({company_id:company_id ,user_id : user_id}, null, null, null, null, filterColumns);
  return sendSuccess(res, bankRes, 'Bank details fetched successfully');
}

const deleteBankaccount = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      console.error('payload is required');
      throw new BadRequestError('payload is required');
    }
    const { company_id } = req.user;
    const ids = { id, company_id };
    // const data = 
    await transactionWrapper(deleteBankaccountService)(ids);
    console.log('get Banks successfully');
    return sendSuccess(res, 'get Banks successfully');
  } catch (error) {
    sendError('error getting while deleting banks', error);
  }
}
export { getBankaccount, getBankaccountById, createBankaccount, updateBankaccount, deleteBankaccount, getMerchantBank };
