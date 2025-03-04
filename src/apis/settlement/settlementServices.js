import { BadRequestError } from '../../utils/appErrors.js';
import {
  createSettlementDao,
  deleteSettlementDao,
  getSettlementDao,
  updateSettlementDao,
} from './settlementDao.js';
import {
  getCalculationDao,
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
    throw new BadRequestError('Error getting while getting settlements');
  }
};

const getSettlementService = async (ids) => {
  try {
    const filterColumns =
      ids.role === Role.MERCHANT
        ? merchantColumns.SETTLEMENT
        : ids.role === Role.VENDOR
          ? Role.vendorColumns.SETTLEMENT
          : columns.SETTLEMENT;
    return await getSettlementDao(
      { company_id: ids.company_id },
      null,
      null,
      null,
      null,
      filterColumns,
    );
  } catch (error) {
    console.error('error getting while  getting settlements', error);
    throw new BadRequestError('Error getting while getting settlements');
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
    throw new BadRequestError('Error occurred while creating Settlement');
  }
};

const updateSettlementService = async (conn, ids, payload) => {
  try {
    //-TODO after merchant and vendor filetr columns added
    // const filterColumns = ['id','balance'];
    const filterColumnsSettle =
      ids.role === Role.MERCHANT
        ? merchantColumns.SETTLEMENT
        : ids.role === Role.VENDOR
          ? Role.vendorColumns.SETTLEMENT
          : columns.SETTLEMENT;
    // const filterColumnsVendor = ['id','user_id'];
    // const filterColumnsBank =['id', 'balance']
    if (payload.config.reference_id) {
      payload.status = 'SUCCESS';
      const data = await getSettlementDao({
        id: ids.id,
        company_id: ids.company_id,
      });
      if (!data) {
        throw new BadRequestError('no data found');
      }
      const calculationData = await getCalculationDao(
        { user_id: data?.user_id },
        null,
        null,
        null,
        null,
        filterColumnsSettle,
      );
      let count = calculationData?.total_settlement_count + 1;
      let amountCalculation =
        calculationData?.total_settlement_amount + payload?.amount;
      let calculationId = calculationData?.id;
      let currentBalance = calculationData?.current_balance + payload?.amount;
      let netBalance = calculationData?.net_balance + payload?.amount;
      if (calculationData) {
        const updatedCalculations = await updateCalculationDao(
          conn,
          { id: calculationId },
          {
            total_settlement_count: count,
            total_settlement_amount: amountCalculation,
            current_balance: currentBalance,
            net_balance: netBalance,
          },
        );
        console.log(
          updatedCalculations,
          'updatedCalculationsupdatedCalculations',
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
          { user_id: vendorData.user_id },
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
    if (payload.status == 'INITIATED') {
      payload.config.reference_id = '';
      payload.config.rejected_reason = '';
    }
    if (payload.config.rejected_reason) {
      payload.status = 'REVERSED';
    }
    const updateData = await updateSettlementDao(
      conn,
      { id: ids.id, company_id: ids.company_id },
      payload,
    );
    return updateData;
  } catch (error) {
    console.log('Error while updating Settlement', 'error', error);
    throw new BadRequestError('Error occurred while updating Settlement');
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
    throw new BadRequestError('Error getting while delete settlement');
  }
};

export {
  getSettlementService,
  createSettlementService,
  getSettlementServiceById,
  updateSettlementService,
  deleteSettlementService,
};
