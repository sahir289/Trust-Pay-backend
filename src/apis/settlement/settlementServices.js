import { BadRequestError, CustomError, ValidationError } from '../../utils/appErrors.js';
import { createSettlementDao, deleteSettlementDao, getSettlementDao, updateSettlementDao } from './settlementDao.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { getCalculationDao, updateCalculationDao } from '../calculation/calculationDao.js';
import { getMerchantsDao, updateMerchantDao } from '../merchants/merchantDao.js';
import { getVendorsDao } from '../vendors/vendorDao.js';
import { getBankaccountDao, updateBankaccountDao } from '../bankAccounts/bankaccountDao.js';
import { CREATE_SETTLEMENT_SCHEMA,UPDATE_SETTLEMENT_SCHEMA, VALIDATE_SETTLEMENT_BY_ID } from '../../schemas/settlementSchema.js';

const getSettlementService = async (req, res) => {
  try {
    
    
    const { id } = req.params;
    if (!id) {
      throw new CustomError(404, "id not found")
    }
    const joiValidation = VALIDATE_SETTLEMENT_BY_ID.validate(id);
    if (joiValidation.error) {
        throw new ValidationError(joiValidation.error);
    }

    const merchantData = await getMerchantsDao( {user_id: id });
    const vendorData = await getVendorsDao({ user_id: id });
    if (merchantData?.length > 0) {     
      const merchantUserData = await getSettlementDao({user_id : merchantData?.user_id});
      return sendSuccess(res, merchantUserData, 'get settlements successfully');
    }
    
    if(vendorData?.length>0) {
      const vendorUserData = await getSettlementDao({user_id : vendorData?.user_id});
      return sendSuccess(res, vendorUserData, 'get settlements successfully');
    }
      throw new BadRequestError('Error getting while getting settlements');    
  } catch (error) {
    console.error('error getting while  getting settlements', error);
    throw new BadRequestError('Error getting while getting settlements');
  }
};

const  getSettlementServiceAll = async (req, res) => {
  try {
    const payload = req.query;
    if (!payload) {
      throw new CustomError(404, "id not found")
    }
      const settlementData = await getSettlementDao(payload);
      if(!settlementData){
          throw new BadRequestError('Error getting while getting settlements');    
      }
      console.log(settlementData, "settlementData")
      return sendSuccess(res, settlementData, 'get settlements successfully');

    
  } catch (error) {
    console.error('error getting while  getting settlements', error);
    throw new BadRequestError('Error getting while getting settlements');
  }
};

const createSettlementService = async (req, res) => {
  try {
    const payload = req.body;
    
    const joiValidation = CREATE_SETTLEMENT_SCHEMA.validate(payload);
    if (joiValidation.error) {
        throw new ValidationError(joiValidation.error);
    }

    if (!payload) {
      console.error('payload is required');
      throw new BadRequestError('payload is required');
    }
    const merchantData = await getMerchantsDao({id : payload.id});

    if (merchantData) {
      const merchantUserData = await getSettlementDao({user_id : merchantData.user_id});
      if (merchantUserData) {
        throw new CustomError(404, "Settlement already exist")
      }
    }
    
  
    const vendorData = await getVendorsDao({id : payload.id});
    if (vendorData) {
      const vendorUserData = await getSettlementService({user_id : vendorData[0].user_id});
      if (vendorUserData) {
        throw new CustomError(404, "Settlement already exist")
      }
    }

    const data = await createSettlementDao(payload);
    return sendSuccess(res, data, 'create settlements successfully');

  } catch (error) {
    console.error('error getting while creating', error);
    throw new BadRequestError('Error getting while creating settlement');
  }
};


const updateSettlementService = async (req, res) => {
  try {
    const payload = { ...req.body };
    const joiValidation = UPDATE_SETTLEMENT_SCHEMA.validate(payload);
    if (joiValidation.error) {
        throw new ValidationError(joiValidation.error);
    }

    const { id } = req.params;
    if (!id) {
      console.error('payload is required');
      throw new BadRequestError('payload is required');
    }
    if (payload.config.reference_id) {
      payload.status = "SUCCESS";
      // calculation for merchant and vendor
      const data = await getSettlementDao({id : id})
      if(data){
        throw new BadRequestError('payload is required');
      }
      const calculationData = await getCalculationDao({user_id : data?.user_id});
      let count = calculationData?.total_settlement_count + 1;
      let amountCalculation = calculationData?.total_settlement_amount + payload?.amount;
      let calculationId = calculationData?.id;
      let currentBalance = calculationData?.current_balance + payload?.amount;
      let netBalance = calculationData?.net_balance + payload?.amount;
      // const updated = 
      await updateCalculationDao(calculationId,
        {
          total_settlement_count: count, total_settlement_amount: amountCalculation,
          current_balance: currentBalance, net_balance: netBalance
        })
  
      const settlementData = await getSettlementDao({id: id})
      const vendorData = await getVendorsDao({ user_id: settlementData?.user_id })
      if (vendorData) {
        const bankData = await getBankaccountDao({ user_id: vendorData?.user_id });
        const bankAcc = bankData[0].balance - payload?.amount;
        // const updatedBankData = 
        await updateBankaccountDao(bankData[0].id, { balance: bankAcc });
      }
      const merchantData = await getMerchantsDao({ user_id: settlementData?.user_id })
      if (merchantData) {
        console.log(merchantData, "merchantData")
        const merchantAcc = merchantData[0].balance - payload?.amount;
        // const updatedBankData = 
        await updateMerchantDao(merchantData[0].id, { balance: merchantAcc });
      }

    }
    if (req.body.status == "INITIATED") {
      payload.config.reference_id = "";
      payload.config.rejected_reason = "";
    }
    if (req.body.config.rejected_reason) {
      payload.status = "REVERSED";
    }
    
    const updateData = await updateSettlementDao(id, payload);
    return sendSuccess(res, updateData, 'update settlements successfully');

  } catch (error) {
    console.error('error getting while ', error);
    throw new BadRequestError('Error getting while creating settlements');
  }
};

const deleteSettlementService = async (req, res) => {
  try {

    const { id } = req.params;
    if (!id) {
      console.error('payload is required');
      throw new BadRequestError('payload is required');
    }
      const updatedData = await deleteSettlementDao(id, {is_obsolete: true})    
      return sendSuccess(res, updatedData, 'delete settlements successfully');
  } catch (error) {
    console.error('error getting while deleting settlement', error);
    throw new BadRequestError('Error getting while delete settlement');
  }
};

export { getSettlementService, createSettlementService,getSettlementServiceAll, updateSettlementService, deleteSettlementService };
