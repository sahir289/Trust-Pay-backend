import { InternalServerError } from '../../utils/appErrors.js';
import {
  beginTransaction,
  commit,
  getConnection,
  rollback,
} from '../../utils/db.js';
import {
  createChargeBackDao,
  deleteChargeBackDao,
  getChargeBackDao,
  updateChargeBackDao,
} from './chargeBackDao.js';
import {
  columns,
  merchantColumns,
  Role,
  vendorColumns,
} from '../../constants/index.js';
import { filterResponse } from '../../helpers/index.js';
import { getCalculationforCronDao } from '../calculation/calculationDao.js';
import { updateCalculationBalanceDao } from '../calculation/calculationDao.js';
const createChargeBackService = async (payload,PayinDetails, role,company_id,user_id) => {
  let conn;
  try {
    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.CHARGE_BACK
        : role === Role.VENDOR
          ? vendorColumns.CHARGE_BACK
          : columns.CHARGE_BACK;
    conn = await getConnection();
    await beginTransaction(conn); // Start a transaction
    
    let userId = PayinDetails[0].merchant_user_id;
    const CalculationUser = await getCalculationforCronDao(userId);
    if (CalculationUser) {
       let count =  Number(1);
       let amount = Number(payload.amount);
       let currentBalance = -Number(payload.amount);
       let net_balance = -Number(payload.amount);
       
       let Id = CalculationUser[0].id;
        await updateCalculationBalanceDao(
         { id: Id },
         {
            total_chargeback_count: count,
           total_chargeback_amount: amount,
           current_balance: currentBalance,
           net_balance:net_balance,
         },
         conn,
       );
     }
     payload.vendor_user_id = PayinDetails[0].vendor_user_id;
     payload.merchant_user_id = PayinDetails[0].merchant_user_id;
     payload.payin_id = PayinDetails[0].payin_id;
     payload.bank_acc_id = PayinDetails[0].bank_acc_id;
     payload.created_by = user_id;
     payload.updated_by = user_id;
     payload.company_id = company_id;
     delete payload.merchant_order_id;
    const data = await createChargeBackDao(payload);
    await commit(conn); // Commit the transaction
    console.log('ChargeBack created successfully');
    const finalResult = filterResponse(data, filterColumns);
    return finalResult;
  } catch (error) {
    console.error('Error while creating ChargeBack', error);
    throw new InternalServerError(error);
  } finally {
    if (conn) {
      try {
        conn.release();
      } catch (releaseError) {
        console.error('Error while releasing the connection', releaseError);
      }
    }
  }
};

const getChargeBacksService = async (filters, role, page,limit,) => {
  try {
    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.CHARGE_BACK
        : role === Role.VENDOR
          ? vendorColumns.CHARGE_BACK
          : columns.CHARGE_BACK;
          const pageNumber = parseInt(page, 10) || 1;
      const pageSize = parseInt(limit, 10) || 10;
    console.log('Fetched ChargeBacks successfully');
    return await getChargeBackDao(
      filters,
      pageNumber, pageSize, 
      null,
      null,
      filterColumns,
    );
  } catch (error) {
    console.error('Error while fetching ChargeBacks', error);
    throw new InternalServerError(error);
  }
};

const updateChargeBackService = async (ids, payload, role) => {
  let conn;
  try {
    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.CHARGE_BACK
        : role === Role.VENDOR
          ? vendorColumns.CHARGE_BACK
          : columns.CHARGE_BACK;
    conn = await getConnection();
    await beginTransaction(conn); // Start a transaction
    const data = await updateChargeBackDao(ids, payload); // Adjust DAO call for update
    await commit(conn); // Commit the transaction
    console.log('ChargeBack updated successfully');
    const finalResult = filterResponse(data, filterColumns);
    return finalResult;
  } catch (error) {
    if (conn) {
      try {
        await rollback(conn); // Rollback the transaction in case of error
      } catch (rollbackError) {
        console.error('Error during transaction rollback', rollbackError);
      }
    }
    console.error('Error while updating ChargeBack', error);
    throw new InternalServerError(error);
  } finally {
    if (conn) {
      try {
        conn.release();
      } catch (releaseError) {
        console.error('Error while releasing the connection', releaseError);
      }
    }
  }
};

const deleteChargeBackService = async (ids, payload, role) => {
  let conn;
  try {
    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.CHARGE_BACK
        : role === Role.VENDOR
          ? vendorColumns.CHARGE_BACK
          : columns.CHARGE_BACK;

    conn = await getConnection();
    await beginTransaction(conn); // Start a transaction

    const data = await deleteChargeBackDao(ids, payload); // Adjust DAO call for delete
    await commit(conn); // Commit the transaction
    console.log('ChargeBack deleted successfully');
    const finalResult = filterResponse(data, filterColumns);
    return finalResult;
  } catch (error) {
    if (conn) {
      try {
        await rollback(conn); // Rollback the transaction in case of error
      } catch (rollbackError) {
        console.error('Error during transaction rollback', rollbackError);
      }
    }
    console.error('Error while deleting ChargeBack', error);
    throw new InternalServerError(error);
  } finally {
    if (conn) {
      try {
        conn.release();
      } catch (releaseError) {
        console.error('Error while releasing the connection', releaseError);
      }
    }
  }
};

export {
  createChargeBackService,
  getChargeBacksService,
  updateChargeBackService,
  deleteChargeBackService,
};
