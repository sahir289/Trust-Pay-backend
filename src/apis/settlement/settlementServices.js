import {  InternalServerError } from '../../utils/appErrors.js';
import {
  createSettlementDao,
  deleteSettlementDao,
  getSettlementDao,
  updateSettlementDao,
} from './settlementDao.js';
import {
  getCalculationforCronDao,
  updateCalculationDao,
} from '../calculation/calculationDao.js';
import {
  getMerchantsDao,
  updateMerchantDao,
} from '../merchants/merchantDao.js';
import { getVendorsDao } from '../vendors/vendorDao.js';
import {
  getBankaccountDao,
  updateBankaccountDao,
} from '../bankAccounts/bankaccountDao.js';
import {
  columns,
  merchantColumns,
  Role,
  vendorColumns,
} from '../../constants/index.js';

const getSettlementServiceById = async (ids) => {
  try {
    const filterColumns =
      ids.role === Role.MERCHANT
        ? merchantColumns.SETTLEMENT
        : ids.role === Role.VENDOR
          ? vendorColumns.SETTLEMENT
          : columns.SETTLEMENT;
    return await getSettlementDao(
      { id: ids.id, company_id: ids.company_id },
      null,
      null,
      null,
      null,
      filterColumns,
    );
  } catch (error) {
    console.error('error getting while  getting settlements', error);
    throw new InternalServerError(error);
  }
};

const getSettlementService = async (ids,  page, limit) => {
  try {
    const filterColumns =
      ids.role === Role.MERCHANT
        ? merchantColumns.SETTLEMENT
        : ids.role === Role.VENDOR
          ? Role.vendorColumns.SETTLEMENT
          : columns.SETTLEMENT;
    return await getSettlementDao(
      { company_id: ids.company_id, role : ids.role_name },
      page, limit,
      null,
      null,
      filterColumns
    );  
  } catch (error) {
    console.error('error getting while  getting settlements', error);
    throw new InternalServerError(error);
  }
};

// const getSettlementServiceJoined = async (req) => {
//   try {
//     const settlementData = await settlementJoindao(
//       "Settlement",
//       [
//         { tableName: "BankAccount", id: "user_id" },
//       ],
//       req.query.page || 1,
//       req.query.pageSize || 10,
//       req.query.sortBy || "created_at",
//       req.query.sortOrder || "DESC"
//     );

//     if (!settlementData || settlementData.length === 0) {
//       throw new BadRequestError('Error getting settlements');
//     }

//     return settlementData

//   } catch (error) {
//     console.error('Error getting settlements:', error);
//     throw new BadRequestError('Error getting settlements');
//   }
// }

const createSettlementService = async (payload) => {
  try {
    const data = await createSettlementDao(payload);
    return data;
  } catch (error) {
    console.log('Error while creating Settlement', 'error', error);
    throw new InternalServerError(error);
  }
};

const updateSettlementService = async (conn, ids, payload, role) => {
  try {
    if (payload.config.reference_id) {
      payload.status = 'SUCCESS';
      const data = await getSettlementDao({
        id: ids.id,
        company_id: ids.company_id,
      });
      if (!data) {
        throw new InternalServerError('no data found');
      }
      const calculationData = await getCalculationforCronDao(data[0].user_id);
      if (calculationData.length>0) {
      let count = calculationData[0].total_settlement_count + 1;
      let amountCalculation =
        calculationData[0].total_settlement_amount + payload?.amount;
      let calculationId = calculationData[0].id;
      let currentBalance = calculationData[0].current_balance + payload?.amount;
      let netBalance = calculationData[0].net_balance + payload?.amount;
        //  const updatedCalculations =
        await updateCalculationDao(
          conn,
          { id: calculationId },
          {
            total_settlement_count: count,
            total_settlement_amount: amountCalculation,
            current_balance: currentBalance,
            net_balance: netBalance,
          },
        );
      } else {
        console.log('no data in calculation');
      }
      const vendorData = await getVendorsDao(
        { user_id: data[0].user_id },
        // , null, null, null, null, filterColumnsVendor
      );
      const merchantData = await getMerchantsDao(
        { user_id: data[0].user_id },
        // , null, null, null, null, filterColumns
      );
      if (vendorData) {
        const bankData = await getBankaccountDao(
          { user_id: vendorData.user_id },null,null, role
          // , null, null, null, null, filterColumnsBank
        );
        if (bankData) {
          const bankId = bankData.id;
          const bankAcc = bankData.balance - payload?.amount;
          await updateBankaccountDao(
            conn,
            { id: bankId },
            { balance: bankAcc },
          );
        } else {
          console.error('No data in bank accounts');
        }
      } else if (merchantData) {
        const merchantAcc = merchantData.balance - payload?.amount;
        await updateMerchantDao({ id: merchantData.id, balance: merchantAcc });
      }
    }
    if (payload.config.rejected_reason) {
      payload.status = 'REJECTED';
    }
    if (payload.status == 'INITIATED') {
      payload.config.reference_id = '';
      payload.config.rejected_reason = '';
    }
    const updateData = await updateSettlementDao(
      conn,
      { id: ids.id, company_id: ids.company_id },
      payload,
    );
    return updateData;
  } catch (error) {
    console.log('Error while updating Settlement', 'error', error);
    throw new InternalServerError(error);
  }
};

const deleteSettlementService = async (conn, ids) => {
  try {
    const updatedData = await deleteSettlementDao(
      conn,
      { id: ids.id, company_id: ids.company_id },
      { is_obsolete: true, updated_by: ids.user_id },
    );
    return updatedData;
  } catch (error) {
    console.error('error getting while deleting settlement', error);
    throw new InternalServerError(error);
  }
};

export {
  getSettlementService,
  createSettlementService,
  getSettlementServiceById,
  updateSettlementService,
  deleteSettlementService,
};
