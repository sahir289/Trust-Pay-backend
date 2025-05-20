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
  getChargeBacksBySearchDao,
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
import {
  getMerchantsDao,
  updateMerchantDao,
} from '../merchants/merchantDao.js';
import { getUserHierarchysDao } from '../userHierarchy/userHierarchyDao.js';
import { getVendorsDao,updateVendorDao } from '../vendors/vendorDao.js';
import { getPayInsDao } from '../payIn/payInDao.js';
const createChargeBackService = async (
  payload,
  PayinDetails,
  role,
  company_id,
  user_id,
) => {
  let conn;
  try {
    // const filterColumns =
    //   role === Role.MERCHANT
    //     ? merchantColumns.CHARGE_BACK
    //     : role === Role.VENDOR
    //       ? vendorColumns.CHARGE_BACK
    //       : columns.CHARGE_BACK;
    conn = await getConnection();
    await beginTransaction(conn); // Start a transaction
    payload.vendor_user_id = PayinDetails[0].vendor_user_id;
    payload.merchant_user_id = PayinDetails[0].merchant_user_id;
    payload.payin_id = PayinDetails[0].payin_id;
    payload.bank_acc_id = PayinDetails[0].bank_acc_id;
    payload.created_by = user_id;
    payload.updated_by = user_id;
    payload.company_id = company_id;
    delete payload.merchant_order_id;
    ///create chargeback
    const data = await createChargeBackDao(payload);
    // update calculations
    // update merchant calculations
    let MerchantuserId = data.merchant_user_id;
    const merchantData = await getMerchantsDao({ user_id: MerchantuserId });
    const merchantCalculation = await getCalculationforCronDao(MerchantuserId)
    await updateMerchantDao(
          { user_id: MerchantuserId },
          { balance: merchantData[0].balance - payload.amount },
          conn,
        );
        let amount = Number(payload.amount);
        let merchantId = merchantCalculation[0].id;
     await updateCalculationBalanceDao(
          { id: merchantId },
          {
            total_chargeback_count: 1,
            total_chargeback_amount: amount,
            current_balance:  - amount,
            net_balance: - amount,
          },
          conn,
        );
        // update vendor calculations
    let VendorUserId = data.vendor_user_id;
    const vendorData = await getVendorsDao({ user_id: VendorUserId });
    await updateVendorDao(
          { user_id: VendorUserId },
          { balance: vendorData[0].balance - payload.amount },
          conn
         )
    const vendorCalculation = await getCalculationforCronDao(
          VendorUserId
        )
    let VendorId = vendorCalculation[0].id;
    await updateCalculationBalanceDao(
          { id: VendorId },
          {
            total_chargeback_count: 1,
            total_chargeback_amount: amount,
            current_balance:  - amount,
            net_balance:  - amount,
          },
          conn,
        );
    await commit(conn); // Commit the transaction
    console.log('ChargeBack created successfully');
    return data;
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
  // desingnation,
) => {
  try {
    // Determine columns based on role
    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.CHARGE_BACK
        : role === Role.VENDOR
          ? vendorColumns.CHARGE_BACK
          : columns.CHARGE_BACK;

    if (role == Role.MERCHANT) {
      filters.merchant_user_id = [user_id];
    }
    if (role == Role.VENDOR) {
      filters.vendor_user_id = [user_id];
    }

    if (role === Role.MERCHANT ) {
      // user_id is unique
      const userHierarchys = await getUserHierarchysDao({ user_id });
      if (userHierarchys || userHierarchys.length > 0) {
        const userHierarchy = userHierarchys[0];

        if (
          userHierarchy?.config ||
          Array.isArray(userHierarchy?.config?.siblings?.sub_merchants)
        ) {
          filters.merchant_user_id = [
            ...filters.merchant_user_id,
            ...(userHierarchy?.config?.siblings?.sub_merchants ?? []),
          ];
        }
      }
    }

    // Parse and validate pagination parameters
    const pageNumber = Math.max(1, parseInt(String(page), 10) || 1);
    const pageSize = Math.max(
      1,
      Math.min(100, parseInt(String(limit), 10) || 10),
    ); // Added upper limit

    // Call DAO with all required parameters
    const chargeBacks = await getChargeBackDao(
      filters,
      pageNumber,
      pageSize,
      'sno',
      'DESC',
      filterColumns,
      role,
    );

    logger.info('Fetched ChargeBacks successfully', {
      role,
      page: pageNumber,
      limit: pageSize,
      filterCount: Object.keys(filters).length,
    });

    return chargeBacks;
  } catch (error) {
    logger.error('Error while fetching ChargeBacks', {
      error: error instanceof Error ? error.message : String(error),
      role,
      filters,
      page,
      limit,
    });
    throw new InternalServerError(
      error instanceof Error ? error.message : 'Failed to fetch chargebacks',
    );
  }
};
const getChargeBacksBySearchService = async (
  filters,
  role,
  designation,
  user_id,
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

    if (role == Role.MERCHANT) {
      filters.merchant_user_id = [user_id];
    }
    if (role == Role.VENDOR) {
      filters.vendor_user_id = [user_id];
    }

    if (role === Role.MERCHANT || designation === Role.MERCHANT_OPERATIONS) {
      // user_id is unique
      const userHierarchys = await getUserHierarchysDao({ user_id });
      if (userHierarchys || userHierarchys.length > 0) {
        const userHierarchy = userHierarchys[0];

        if (
          userHierarchy?.config ||
          Array.isArray(userHierarchy?.config?.siblings?.sub_merchants)
        ) {
          filters.merchant_user_id = [
            ...filters.merchant_user_id,
            ...(userHierarchy?.config?.siblings?.sub_merchants ?? []),
          ];
        }
      }
    }

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

const blockChargebackUserService = async (ids) => {
  let conn;
  try {
    conn = await getConnection();
    await beginTransaction(conn); 
      const id = ids.id
      const chargebackdata = await getChargeBackDao({id},1,10,'created_at','DESC')
      const payinId = chargebackdata[0].payin_id
      const companyId = ids.company_id
      const payindata = await getPayInsDao({id: payinId},companyId)
      const code = payindata.payins[0].merchant_details.merchant_code
      const userIp = payindata.payins[0].payin_details?.user?.user_ip
      const merchant = await getMerchantsDao({code}); 
      const merchantId = payindata.payins[0].merchant_id
      const userId = payindata.payins[0].user
      const existingBlockedUsers = merchant.config?.blocked_users || [];
      const alreadyExists = existingBlockedUsers.some(
        (entry) => entry.user_id === userId && entry.user_ip === userIp
      );
      let merchantDetails;
      let updatedBlockedUsers;
      if (!alreadyExists) {
         updatedBlockedUsers = [...existingBlockedUsers, {  userId, user_ip: userIp }];
        
        const updatedConfig = {
          ...merchant.config,
          blocked_users: updatedBlockedUsers,
        };   
        merchantDetails = await updateMerchantDao(
          { id: merchantId },
          { config: updatedConfig } 
        );
      }
      else {
        const updatedBlockedUsers = existingBlockedUsers.filter(
          (entry) => !(entry.user_id === userId && entry.user_ip === userIp)
        );
        const updatedConfig = {
          ...merchant.config,
          blocked_users: updatedBlockedUsers,
        };
        merchantDetails = await updateMerchantDao({ id: merchantId }, { config: updatedConfig });
      }
    await commit(conn); 
    return merchantDetails;
  } catch (error) {
    if (conn) {
      try {
        await rollback(conn); 
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
  blockChargebackUserService,
};
