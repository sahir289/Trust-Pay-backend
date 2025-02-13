import { BadRequestError, CustomError } from '../../utils/appErrors.js';
import { createSettlementByIdDao, deleteSettlementByIdDao, getSettlementByIdDao, updateSettlementByIdDao } from './settlementDao.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { getCalculationDao, updateCalculationDao } from '../calculation/calculationDao.js';
import { getMerchantsDao } from '../merchants/merchantDao.js';
import { getVendorsDao } from '../vendors/vendorDao.js';
import { getBankaccountDao, updateBankaccountByIdDao } from '../bankAccounts/bankaccountDao.js';

const getSettlementByIDService = async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) {
      throw new CustomError(404, "id not found")
    }
    const merchantData = await getMerchantsDao({ searchString: id });
    if (merchantData?.length > 0) {

      const merchantUserData = await getSettlementByIdDao(merchantData?.user_id);
      return sendSuccess(res, merchantUserData, 'getUsers successfully');
    } else {
      const vendorData = await getVendorsDao({ searchString: id });
      const vendorUserData = await getSettlementByIdDao(vendorData?.user_id);
      return sendSuccess(res, vendorUserData, 'getUsers successfully');

    }
  } catch (error) {
    console.error('error getting while logging in', error);
    throw new BadRequestError('Error getting while logging in');
  }
};

const createSettlementByIDService = async (req, res) => {
  
  try {
    const payload = req.body;
    if (!payload) {
      console.error('payload is required');
      throw new BadRequestError('payload is required');
    }   
      const merchantUserData = await getSettlementByIdDao(payload.user_id);
      if (merchantUserData) {
        throw new CustomError(404, "Settlement already exist")
      }  
    const data = await createSettlementByIdDao(payload);
    return sendSuccess(res, data, 'getUsers successfully');

  } catch (error) {
    console.error('error getting while logging in', error);
    throw new BadRequestError('Error getting while logging in');
  }
};


const updateSettlementByIDService = async (req, res) => {
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
      //calculation for merchant and vendor
      const data = await getSettlementByIdDao(id)
      const calculationData = await getCalculationDao(data?.user_id);
      let count = calculationData?.total_settlement_count + 1;
      let amountCalculation = calculationData?.total_settlement_amount + payload?.amount;
      let calculationId = calculationData?.id;
      let currentBalance = calculationData?.current_balance + payload?.amount;
      let netBalance = calculationData?.net_balance + payload?.amount;
      const updated= await updateCalculationDao(calculationId,
        {
          total_settlement_count: count, total_settlement_amount: amountCalculation,
          current_balance: currentBalance, net_balance: netBalance
        })
        const settlementData = await getSettlementByIdDao(id)
        const vendorData = await getVendorsDao({searchString : settlementData?.user_id})
        console.log(vendorData, "empty")
        if (vendorData[0]>0) {
          const bankData = await getBankaccountDao({searchString: vendorData[0].user_id});
          const bankAcc = bankData[0].balance - payload?.amount;
          const updatedBankData = await updateBankaccountByIdDao(bankData[0].id, { balance: bankAcc });
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
    const updateData = await updateSettlementByIdDao(id, payload);
    return sendSuccess(res, updateData, 'getUsers successfully');

  } catch (error) {
    console.error('error getting while logging in', error);
    throw new BadRequestError('Error getting while logging in');
  }
};

const deleteSettlementByIDService = async (req, res) => {
  try {

    const { id } = req.params;
    const payload = { is_obsolete: true };
    if (!id) {
      console.error('payload is required');
      throw new BadRequestError('payload is required');
    }
    const merchantData = await getMerchantsDao(id);
    if (merchantData.length > 0) {
      const settlementData = await getSettlementByIDService(merchantData?.user_id);
      const merchantUserData = await deleteSettlementByIdDao(settlementData?.id, payload);
      return sendSuccess(res, merchantUserData, 'getUsers successfully');
    } else {

      const vendorData = await getVendorsDao({ searchString: id });
      const settlementData = await getSettlementByIDService(vendorData?.user_id);
      const vendorUserData = await deleteSettlementByIdDao(settlementData?.id, payload);
      return sendSuccess(res, vendorUserData, 'getUsers successfully');

    }

  } catch (error) {
    console.error('error getting while logging in', error);
    throw new BadRequestError('Error getting while logging in');
  }
};

export { getSettlementByIDService, createSettlementByIDService, updateSettlementByIDService, deleteSettlementByIDService };
