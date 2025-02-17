import { BadRequestError, CustomError } from '../../utils/appErrors.js';
import { createSettlementDao, deleteSettlementDao, getSettlementDao, updateSettlementDao } from './settlementDao.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { getCalculationDao, updateCalculationDao } from '../calculation/calculationDao.js';
import { getMerchantsDao, updateMerchantDao } from '../merchants/merchantDao.js';
import { getVendorsDao } from '../vendors/vendorDao.js';

const getSettlementService = async (req, res) => {
  try {
    const { payload } = req.query;
    if (!payload) {
      throw new CustomError(404, "id not found")
    }
    const merchantData = await getMerchantsDao( {searchString: payload.merchant_id });
    if (merchantData?.length > 0) {

      const merchantUserData = await getSettlementDao(merchantData?.user_id);
      return sendSuccess(res, merchantUserData, 'get settlements successfully');
    } else {
      const vendorData = await getVendorsDao({ searchString: id });
      const vendorUserData = await getSettlementDao(vendorData?.user_id);
      return sendSuccess(res, vendorUserData, 'get settlements successfully');
    }
  } catch (error) {
    console.error('error getting while  getting settlements', error);
    throw new BadRequestError('Error getting while getting settlements');
  }
};

const createSettlementService = async (req, res) => {
  try {
    const payload = req.body;
    if (!payload) {
      console.error('payload is required');
      throw new BadRequestError('payload is required');
    }
    const merchantData = await getMerchantsDao(payload.id);
    if (merchantData.length > 0) {
      
      const merchantUserData = await getSettlementService(merchantData?.user_id);
      if (merchantUserData) {
        throw new CustomError(404, "Settlement already exist")
      }
    }

    const vendorData = await getVendorsDao(payload.id);
    if (vendorData.length > 0) {
      const vendorUserData = await getSettlementService(vendorData?.user_id);
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
    const { id } = req.params;
    const data = await getSettlementDao(id)
    const calculationData = await getCalculationDao(data.user_id);
    let count = calculationData?.total_settlement_count + 1;
    
    let amountCalculation = calculationData?.total_settlement_amount + payload?.amount;
    let calculationId = calculationData?.id;
    if (req.body.config.refrence_id) {
      payload.status = "SUCCESS";
      // calculation for merchant and vendor
      const data = await getSettlementDao(id)
      const calculationData = await getCalculationDao(data?.user_id);
      let count = calculationData?.total_settlement_count + 1;
      let amountCalculation = calculationData?.total_settlement_amount + payload?.amount;
      let calculationId = calculationData?.id;
      let currentBalance = calculationData?.current_balance + payload?.amount;
      let netBalance = calculationData?.net_balance + payload?.amount;
      await updateCalculationDao(calculationId,
        {
          total_settlement_count: count, total_settlement_amount: amountCalculation,
          current_balance: currentBalance, net_balance: netBalance
        })
      const settlementData = await getSettlementDao(id)
      const vendorData = await getVendorsDao({ searchString: settlementData?.user_id })
      if (vendorData.length > 0) {
        const bankData = await getBankaccountDao({ searchString: vendorData[0].user_id });
        const bankAcc = bankData[0].balance - payload?.amount;
        // const updatedBankData = 
        await updateBankaccountDao(bankData[0].id, { balance: bankAcc });
      }
      const merchantData = await getMerchantsDao({ searchString: settlementData?.user_id })
      if (merchantData.length > 0) {
        console.log(merchantData, "merchantData")
        const merchantAcc = merchantData[0].balance - payload?.amount;
        // const updatedBankData = 
        await updateMerchantDao(merchantData[0].id, { balance: merchantAcc });
      }

    }
    if (req.body.status == "INITIATED") {
      payload.config.refrence_id = "";
      payload.config.rejected_reason = "";
    }
    if (req.body.config.rejected_reason) {
      payload.status = "REVERSED";
    }
    if (!id) {
      throw new CustomError(404, "id not found")
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
    const payload = { is_obsolete: true };
    if (!id) {
      console.error('payload is required');
      throw new BadRequestError('payload is required');
    }
    const merchantData = await getMerchantsDao(id);
    if (merchantData.length > 0) {
      const settlementData = await getSettlementService(merchantData?.user_id);
      const merchantUserData = await deleteSettlementDao(settlementData?.id, payload);
      return sendSuccess(res, merchantUserData, 'delete settlements successfully');
    } else {

      const vendorData = await getVendorsDao({ searchString: id });
      const settlementData = await getSettlementService(vendorData?.user_id);
      const vendorUserData = await deleteSettlementDao(settlementData?.id, payload);
      return sendSuccess(res, vendorUserData, 'delete settlements successfully');

    }

  } catch (error) {
    console.error('error getting while deleting settlement', error);
    throw new BadRequestError('Error getting while delete settlement');
  }
};

export { getSettlementService, createSettlementService, updateSettlementService, deleteSettlementService };
