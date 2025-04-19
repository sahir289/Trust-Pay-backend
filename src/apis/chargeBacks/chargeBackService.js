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
  getChargeBacksBySearchDao
} from './chargeBackDao.js';
import {
  columns,
  merchantColumns,
  Role,
  vendorColumns,
} from '../../constants/index.js';
import { BadRequestError } from '../../utils/appErrors.js';
import { filterResponse } from '../../helpers/index.js';
import { getCalculationforCronDao } from '../calculation/calculationDao.js';
import { updateCalculationBalanceDao } from '../calculation/calculationDao.js';
import { logger } from '../../utils/logger.js';
import { getMerchantsDao, updateMerchantDao } from '../merchants/merchantDao.js';
import { getUserHierarchysDao } from '../userHierarchy/userHierarchyDao.js';
const createChargeBackService = async (payload, PayinDetails, role, company_id, user_id) => {
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
      const merchantData = await getMerchantsDao(
        { user_id: userId })

      if (merchantData) {
        await updateMerchantDao(
          { user_id: userId }, { balance: merchantData[0].balance - payload.amount }, conn
        );

        let count = Number(1);
        let amount = Number(payload.amount);
        let currentBalance = - Number(payload.amount);
        let net_balance = - Number(payload.amount);

        let Id = CalculationUser[0].id;
        await updateCalculationBalanceDao(
          { id: Id },
          {
            total_chargeback_count: count,
            total_chargeback_amount: amount,
            current_balance: currentBalance,
            net_balance: net_balance,
          },
          conn,
        );
      }
      else {
        let count = Number(1);
        let amount = Number(payload.amount);
        let currentBalance = + Number(payload.amount);
        let net_balance = + Number(payload.amount);

        let Id = CalculationUser[0].id;
        await updateCalculationBalanceDao(
          { id: Id },
          {
            total_chargeback_count: count,
            total_chargeback_amount: amount,
            current_balance: currentBalance,
            net_balance: net_balance,
          },
          conn,
        );
      }
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

const getChargeBacksService = async (
  filters,
  role,
  page,
  limit,
  user_id,
) => {
  try {
    // Determine columns based on role
    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.CHARGE_BACK
        : role === Role.VENDOR
          ? vendorColumns.CHARGE_BACK
          : columns.CHARGE_BACK;

          if(role == Role.MERCHANT){
            filters.merchant_user_id = [user_id]
          }
          if (role == Role.VENDOR) {
            filters.vendor_user_id = [user_id];
          }

              if (role === Role.MERCHANT) {
                // user_id is unique
                const userHierarchys = await getUserHierarchysDao({ user_id });
                if (userHierarchys || userHierarchys.length > 0) {           
                const userHierarchy = userHierarchys[0];
          
                if (
                  userHierarchy?.config ||
                  Array.isArray(userHierarchy?.config?.siblings?.sub_merchants)
                ) {
                  filters.merchant_user_id = [...filters.merchant_user_id, ...(userHierarchy?.config?.siblings?.sub_merchants ?? [])];
                }
              }
              }

    // Parse and validate pagination parameters
    const pageNumber = Math.max(1, parseInt(String(page), 10) || 1);
    const pageSize = Math.max(1, Math.min(100, parseInt(String(limit), 10) || 10)); // Added upper limit

    // Call DAO with all required parameters
    const chargeBacks = await getChargeBackDao(
      filters,
      pageNumber,
      pageSize,
      'sno',
      'DESC',
      filterColumns,
      role
    );

    logger.info('Fetched ChargeBacks successfully', {
      role,
      page: pageNumber,
      limit: pageSize,
      filterCount: Object.keys(filters).length
    });

    return chargeBacks;
  } catch (error) {
    logger.error('Error while fetching ChargeBacks', {
      error: error instanceof Error ? error.message : String(error),
      role,
      filters,
      page,
      limit
    });
    throw new InternalServerError(
      error instanceof Error ? error.message : 'Failed to fetch chargebacks'
    );
  }
};
const getChargeBacksBySearchService = async (
  filters,
  role,
  // designation,
  // user_id,
) => {
  try {
    const pageNum = parseInt(filters.page);
    const limitNum = parseInt(filters.limit);
    if (isNaN(pageNum) || isNaN(limitNum) || pageNum < 1 || limitNum < 1) {
      throw new BadRequestError('Invalid pagination parameters');
    }
    const searchTerms = filters.search
      .split(',')
      .map((term) => term.trim())
      .filter((term) => term.length > 0);

    if (searchTerms.length === 0) {
      throw new BadRequestError('Please provide valid search terms');
    }
    const offset = (pageNum - 1) * limitNum;

   const filterColumns =
     role === Role.MERCHANT
       ? merchantColumns.CHARGE_BACK
       : role === Role.VENDOR
         ? vendorColumns.CHARGE_BACK
         : columns.CHARGE_BACK;
    // TODO: add designation constants

    const data = await getChargeBacksBySearchDao(
      filters,
      searchTerms,
      limitNum,
      offset,
      filterColumns,
    );

    return data;
  } catch (error) {
    console.error('Error while fetching chargeback by search', error);
    throw new InternalServerError(error.message);
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
  getChargeBacksBySearchService,
  updateChargeBackService,
  deleteChargeBackService,
};
