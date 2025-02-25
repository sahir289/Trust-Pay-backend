import { BadRequestError, ValidationError } from '../../utils/appErrors.js';
import { createSettlementDao, deleteSettlementDao, getSettlementDao, getSettlementDaoAll, updateSettlementDao } from './settlementDao.js';
import { getCalculationDao, updateCalculationDao } from '../calculation/calculationDao.js';
import { getMerchantsDao, updateMerchantDao } from '../merchants/merchantDao.js';
import { getVendorsDao } from '../vendors/vendorDao.js';
import { getBankaccountDao, updateBankaccountDao } from '../bankAccounts/bankaccountDao.js';
import { CREATE_SETTLEMENT_SCHEMA, UPDATE_SETTLEMENT_SCHEMA, VALIDATE_SETTLEMENT_BY_ID } from '../../schemas/settlementSchema.js';
import { transactionWrapper } from '../../utils/db.js';
import { columns, merchantColumns, Role, vendorColumns } from '../../constants/index.js';
import { filterResponse } from '../../helpers/index.js';

const getSettlementService = async (req) => {
  try {
    const { role } = req.user;
    const filterColumns = role === Role.MERCHANT ? merchantColumns.SETTLEMENT : role === Role.VENDOR ? vendorColumns.SETTLEMENT : columns.SETTLEMENT;
    const { payload } = req.params;
    const { company_id } = req.user;
    const joiValidation = VALIDATE_SETTLEMENT_BY_ID.validate(payload);
    if (joiValidation.error) {
      throw new ValidationError(joiValidation.error);
    }

    const data = await transactionWrapper(getSettlementDao)({ payload, company_id });
    const finalResult =  filterResponse(data, filterColumns);
    return finalResult;
  } catch (error) {
    console.error('error getting while  getting settlements', error);
    throw new BadRequestError('Error getting while getting settlements');
  }
};

const getSettlementServiceAll = async (req) => {
  try {
    const { role } = req.user;
    const filterColumns = role === Role.MERCHANT ? merchantColumns.SETTLEMENT : role === Role.VENDOR ? vendorColumns.SETTLEMENT : columns.SETTLEMENT;
    // const payload = req.query;
    const { company_id } = req.user;
    const settlementData = await getSettlementDaoAll({
      company_id,
    });
    if (!settlementData) {
      throw new BadRequestError('Error getting while getting settlements');
    }
    const finalResult =  filterResponse(settlementData, filterColumns);
    return finalResult;
  } catch (error) {
    console.error('error getting while  getting settlements', error);
    throw new BadRequestError('Error getting while getting settlements');
  }
};

const createSettlementService = async (req) => {
 
  try {
    const { role } = req.user;
    const filterColumns = role === Role.MERCHANT ? merchantColumns.SETTLEMENT : role === Role.VENDOR ? vendorColumns.SETTLEMENT : columns.SETTLEMENT;
    const payload = req.body;
    const { company_id } = req.user;
    payload.company_id = company_id;
    const joiValidation = CREATE_SETTLEMENT_SCHEMA.validate(payload);
    if (joiValidation.error) {
      throw new ValidationError(joiValidation.error);
    }
    const data = await transactionWrapper(createSettlementDao)(payload);
    const finalResult =  filterResponse(data, filterColumns);
    return finalResult;
  } catch (error) {
    console.log('Error while creating Payout', 'error', error);
    throw new BadRequestError('Error occurred while creating Payout');
  } 
};



const updateSettlementService = async (req) => {
 
  try {
    const { role } = req.user;
    const filterColumns = role === Role.MERCHANT ? merchantColumns.SETTLEMENT : role === Role.VENDOR ? vendorColumns.SETTLEMENT : columns.SETTLEMENT;
    const { id } = req.params;
    const payload = { ...req.body };
    const { company_id } = req.user;
    const ids = { id, company_id }
    const joiValidation = UPDATE_SETTLEMENT_SCHEMA.validate(payload);
    if (joiValidation.error) {
      throw new ValidationError(joiValidation.error);
    }
    if (payload.config.reference_id) {
      payload.status = "SUCCESS";
      // calculation for merchant and vendor
      const data = await getSettlementDao({ id: id })
      if (!data) {
        throw new BadRequestError('payload is required');
      }
      const calculationData = await getCalculationDao({ user_id: data?.user_id });
      let count = calculationData?.total_settlement_count + 1;
      let amountCalculation = calculationData?.total_settlement_amount + payload?.amount;
      let calculationId = calculationData?.id;
      let currentBalance = calculationData?.current_balance + payload?.amount;
      let netBalance = calculationData?.net_balance + payload?.amount;
      if (calculationData) {
        await updateCalculationDao(calculationId,
          {
            total_settlement_count: count, total_settlement_amount: amountCalculation,
            current_balance: currentBalance, net_balance: netBalance
          })
      }
      const settlementData = await getSettlementDao({ id: id })
      const vendorData = await getVendorsDao({ user_id: settlementData?.user_id })
      const merchantData = await getMerchantsDao({ user_id: settlementData?.user_id })
      if (vendorData) {

        const bankData = await getBankaccountDao({ user_id: vendorData.user_id });
        if (bankData) {
          const bankAcc = bankData.balance - payload?.amount;
          await updateBankaccountDao(bankData[0].id, { balance: bankAcc });
        }
        else {
          console.error("No data in bank accounts")
        }
      }
      else if (merchantData) {
        const merchantAcc = merchantData.balance - payload?.amount;
        await updateMerchantDao(merchantData.id, { balance: merchantAcc });
      }

    }
    if (req.body.status == "INITIATED") {
      payload.config.reference_id = "";
      payload.config.rejected_reason = "";
    }
    if (req.body.config.rejected_reason) {
      payload.status = "REVERSED";
    }

    const updateData = await transactionWrapper(updateSettlementDao)(ids, payload);  
    const finalResult =  filterResponse(updateData, filterColumns);
    return finalResult;
  } catch (error) {
    console.log('Error while creating Payout', 'error', error);
    throw new BadRequestError('Error occurred while creating Payout');
  } 
};

const deleteSettlementService = async (req) => {
  try {
    const { role } = req.user;
    const filterColumns = role === Role.MERCHANT ? merchantColumns.SETTLEMENT : role === Role.VENDOR ? vendorColumns.SETTLEMENT : columns.SETTLEMENT;
    const { id } = req.params;
    const { company_id } = req.user;
    const ids = { id, company_id }
    const joiValidation = VALIDATE_SETTLEMENT_BY_ID.validate(id);
    if (joiValidation.error) {
      throw new ValidationError(joiValidation.error);
    }
    const updatedData = await transactionWrapper(deleteSettlementDao)(ids, { is_obsolete: true })
    const finalResult =  filterResponse(updatedData, filterColumns);
    return finalResult;
  } catch (error) {
    console.error('error getting while deleting settlement', error);
    throw new BadRequestError('Error getting while delete settlement');
  }
};

export { getSettlementService, createSettlementService, getSettlementServiceAll, updateSettlementService, deleteSettlementService };
