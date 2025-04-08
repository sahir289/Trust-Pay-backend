import { InternalServerError } from '../../utils/appErrors.js';
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

const getSettlementService = async (ids, page, limit, search) => {
  try {
    const filterColumns =
      ids.role === Role.MERCHANT
        ? merchantColumns.SETTLEMENT
        : ids.role === Role.VENDOR
          ? Role.vendorColumns.SETTLEMENT
          : columns.SETTLEMENT;
    return await getSettlementDao(
      { company_id: ids.company_id, role: ids.role_name, ...(search ? { search } : {}) },
      page,
      limit,
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
    payload.config = payload.config || {};

    if (payload.config.reference_id) {
      payload.status = 'SUCCESS';
      const data = await getSettlementDao(
        {
          id: ids.id,
          company_id: ids.company_id,
        },
        null,
        null,
        null,
        null
      );

      if (!data) {
        throw new InternalServerError('no data found');
      }

      const calculationData = await getCalculationforCronDao(data[0].user_table_id);
      if (calculationData.length > 0) {
        const calc = calculationData[0];
        const count = calc.total_settlement_count + 1;
        const amountCalculation = calc.total_settlement_amount + payload?.amount;
        const currentBalance = calc.current_balance - payload?.amount;
        const netBalance = calc.net_balance - payload?.amount;

        await updateCalculationDao(
          { id: calc.id },
          {
            total_settlement_count: count,
            total_settlement_amount: amountCalculation,
            current_balance: currentBalance,
            net_balance: netBalance,
          },
          conn
        );
      } else {
        console.log('no data in calculation');
      }

      const merchantData = await getMerchantsDao(
        { user_id: data[0].user_table_id },
        null,
        null,
        null,
        null
      );

      if (data[0].role === Role.VENDOR) {
        const bankData = await getBankaccountDao(
          { user_id: data[0].user_table_id },
          null,
          null,
          role
        );
        console.log('bankData_bank_account', bankData);

        if (bankData.length > 0) {
          console.log('bankData__bank_account', bankData);
          const bankAcc = bankData[0].balance - payload?.amount;
          const updatedBank = await updateBankaccountDao(
            { id: bankData[0].id },
            { balance: bankAcc },
            conn
          );
          console.log('updated_bank_account', updatedBank);
        } else {
          console.error('No data in bank accounts');
        }
      } else if (data[0].role === Role.MERCHANT) {
        const merchantAcc = merchantData[0].balance - payload?.amount;
        await updateMerchantDao(
          { id: merchantData[0].id },
          { balance: merchantAcc },
          conn
        );
      }
    }

    if (payload.config.rejected_reason) {
      payload.status = 'REJECTED';
    }

    if (payload.status === 'INITIATED') {
      payload.config.reference_id = '';
      payload.config.rejected_reason = '';
    }
    const updateData = await updateSettlementDao(
      conn,
      { id: ids.id, company_id: ids.company_id },
      payload
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
