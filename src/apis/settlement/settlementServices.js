import { BadRequestError, CustomError } from '../../utils/appErrors.js';
import { createSettlementDao, deleteSettlementDao, getSettlementDao, updateSettlementDao } from './settlementDao.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { getCalculationDao, updateCalculationDao } from '../calculation/calculationDao.js';
import { getMerchantsDao, updateMerchantDao } from '../merchants/merchantDao.js';
import { getVendorsDao } from '../vendors/vendorDao.js';
import { getBankaccountDao, updateBankaccountDao } from '../bankAccounts/bankaccountDao.js';

const getSettlementService = async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) {
      throw new CustomError(404, "id not found")
    }
    const merchantData = await getMerchantsDao({ searchString: id });
    if (merchantData?.length > 0) {

      const merchantUserData = await getSettlementDao(merchantData?.user_id);
      return sendSuccess(res, merchantUserData, 'getUsers successfully');
    } else {
      const vendorData = await getVendorsDao({ searchString: id });
      const vendorUserData = await getSettlementDao(vendorData?.user_id);
      return sendSuccess(res, vendorUserData, 'getUsers successfully');

    }
  } catch (error) {
    console.error('error getting while logging in', error);
    throw new BadRequestError('Error getting while logging in');
  }
};

const createSettlementService = async (req, res) => {
  
  try {
    const payload = req.body;
    if (!payload) {
      console.error('payload is required');
      throw new BadRequestError('payload is required');
    }   
      const merchantUserData = await getSettlementDao(payload.user_id);
      if (merchantUserData) {
        throw new CustomError(404, "Settlement already exist")
      }  
    const data = await createSettlementDao(payload);
    return sendSuccess(res, data, 'getUsers successfully');

  } catch (error) {
    console.error('error getting while logging in', error);
    throw new BadRequestError('Error getting while logging in');
  }
};


const updateSettlementService = async (req, res) => {
  try {
    const payload = { ...req.body };
    const { id } = req.params;
    
    //   if (req.body.status == "INITIATED") {

    //     console.log("vendorData", vendorData)

    //       if (settlementData.data[0].method === "INTERNAL_QR_TRANSFER" || settlementData.data[0].method === "INTERNAL_BANK_TRANSFER") {
    //           const botRes = await getBankResponseDao(settlementData.data[0].config.refrence_id, String(settlementData.data[0].amount).replace("-", ""));
    //           const apiData = {
    //               status: "/success",
    //           }
    //           await updateBotResponseByUtrToInternalTransfer(botRes.id, apiData);
    //       }
    //     }
    // }


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
        const vendorData = await getVendorsDao({searchString : settlementData?.user_id})
        if (vendorData.length>0) {
          const bankData = await getBankaccountDao({searchString: vendorData[0].user_id});
          const bankAcc = bankData[0].balance - payload?.amount;
          // const updatedBankData = 
          await updateBankaccountDao(bankData[0].id, { balance: bankAcc });
        } 
        const merchantData = await getMerchantsDao({searchString : settlementData?.user_id})
        if (merchantData.length>0) {
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
      payload.status = "REJECTED";
    }
    if (!id) {
      throw new CustomError(404, "id not found")
    }
    const updateData = await updateSettlementDao(id, payload);
    return sendSuccess(res, updateData, 'getUsers successfully');

  } catch (error) {
    console.error('error getting while logging in', error);
    throw new BadRequestError('Error getting while logging in');
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
      return sendSuccess(res, merchantUserData, 'getUsers successfully');
    } else {

      const vendorData = await getVendorsDao({ searchString: id });
      const settlementData = await getSettlementService(vendorData?.user_id);
      const vendorUserData = await deleteSettlementDao(settlementData?.id, payload);
      return sendSuccess(res, vendorUserData, 'getUsers successfully');

    }

  } catch (error) {
    console.error('error getting while logging in', error);
    throw new BadRequestError('Error getting while logging in');
  }
};

export { getSettlementService, createSettlementService, updateSettlementService, deleteSettlementService };

