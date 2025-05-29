import { columns, Role, vendorColumns } from '../../constants/index.js';
import { filterResponse } from '../../helpers/index.js';
import { InternalServerError } from '../../utils/appErrors.js';
import {
  beginTransaction,
  commit,
  getConnection,
  rollback,
} from '../../utils/db.js';
import { logger } from '../../utils/logger.js';
import { createUserHierarchyDao, getUserHierarchysDao } from '../userHierarchy/userHierarchyDao.js';
import {
  createVendorDao,
  deleteVendorDao,
  getVendorsCodeDao,
  getVendorsDao,
  getVendorsBySearchDao,
  updateVendorDao,
} from './vendorDao.js';
import { BadRequestError } from '../../utils/appErrors.js';
import { createCalculationDao } from '../calculation/calculationDao.js';
import {updateBankaccountDao } from '../bankAccounts/bankaccountDao.js';
import {updateUserDao } from '../users/userDao.js';
const createVendorService = async (conn, payload) => {
  try {
    let role_id = payload.role_id;
    delete payload.role_id;
    const data = await createVendorDao(payload, conn);
    const calculationPayload = {
      user_id: data.user_id,
      role_id:role_id,
      company_id: data.company_id,
    };
    await createCalculationDao(conn, calculationPayload);
    await createUserHierarchyDao(
            {
              user_id: data.user_id,
              // role_id: Role_id,
              created_by: data.created_by,
              updated_by: data.updated_by,
              company_id: data.company_id,
            },
            conn,
          );
    console.log('Vendor created successfully', 'info');
    return data;
  } catch (error) {
    console.log('Error while creating Vendor', 'error', error);
    throw new InternalServerError(error);
  }
};

const getVendorsService = async (filters, roleIs, page, limit,user_id,designation) => {
  try {
    const filterColumns =
    roleIs === Role.VENDOR ? vendorColumns.VENDOR : columns.VENDOR;
    const pageNumber = parseInt(page, 10) || 1;
    const pageSize = parseInt(limit, 10) || 10;
    let parentUserId;
    if (roleIs === Role.VENDOR) {
      if (designation === Role.VENDOR_OPERATIONS) {
        const UserHierarchy = await getUserHierarchysDao({ user_id });
        const userHierarchy = UserHierarchy[0];
        parentUserId = userHierarchy?.config?.parent;
        filters.user_id = parentUserId;
      }
      else {
        parentUserId = user_id;
        filters.user_id = parentUserId;
      }
    }
    return await getVendorsDao(
      filters,
      pageNumber,
      pageSize,
      null,
      null,
      filterColumns,
      roleIs   //-role specific details
    );
  } catch (error) {
    console.error('Error while fetching vendors', error);
    throw new InternalServerError(error);
  }
};

const getVendorsCodeService = async (filters, roleIs, user_id, designation) => {
  let conn;
  try {
    conn = await getConnection(); // Get DB connection
    await beginTransaction(conn); // Start transaction
    let parentUserId;
    if (roleIs === Role.VENDOR) {
      if (designation === Role.VENDOR_OPERATIONS) {
        const UserHierarchy = await getUserHierarchysDao({ user_id });
        const userHierarchy = UserHierarchy[0];
        parentUserId = userHierarchy?.config?.parent;
        filters.user_id = parentUserId;
      } else {
        parentUserId = user_id;
        filters.user_id = parentUserId;
      }
    }
    const data = await getVendorsCodeDao(filters, conn);

    await commit(conn); // Commit transaction
    return data;
  } catch (error) {
    if (conn) {
      try {
        await rollback(conn); // Rollback in case of error
      } catch (rollbackError) {
        console.error('Error during transaction rollback:', rollbackError);
      }
    }
    console.error('Error while fetching vendors:', error);
    throw new InternalServerError(error);
  } finally {
    if (conn) {
      try {
        conn.release(); // Ensure connection is released
      } catch (releaseError) {
        console.error('Error releasing connection:', releaseError);
      }
    }
  }
};
const getVendorsBySearchService = async (
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
      role === Role.VENDOR ? vendorColumns.VENDOR : columns.VENDOR;
    // TODO: add designation constants
   let parentUserId;
   if (role === Role.VENDOR) {
     if (designation === Role.VENDOR_OPERATIONS) {
       const UserHierarchy = await getUserHierarchysDao({ user_id });
       const userHierarchy = UserHierarchy[0];
       parentUserId = userHierarchy?.config?.parent;
       filters.user_id = parentUserId;
     } else {
       parentUserId = user_id;
       filters.user_id = parentUserId;
     }
   }
    const data = await getVendorsBySearchDao(
      filters,
      searchTerms,
      limitNum,
      offset,
      filterColumns,
    );

    return data;
  } catch (error) {
    logger.error('Error while fetching vendors by search', error);
    throw new InternalServerError(error);
  }
};

const updateVendorService = async (id, payload, role) => {
  let conn;
  try {
    const filterColumns =
      role === Role.VENDOR ? vendorColumns.VENDOR : columns.VENDOR;
    conn = await getConnection();
    await beginTransaction(conn); // Start a transaction
    const data = await updateVendorDao(id, payload, conn); // Adjust DAO call for update
    await commit(conn); // Commit the transaction
    console.log('Vendor updated successfully', 'info');
    const finalResult = filterResponse(data, filterColumns);
    return finalResult;
  } catch (error) {
    if (conn) {
      try {
        await rollback(conn); // Rollback the transaction in case of error
      } catch (rollbackError) {
        console.log(
          'Error during transaction rollback',
          'error',
          rollbackError,
        );
      }
    }
    console.log('Error while updating Vendor', 'error', error);
    throw new InternalServerError(error);
  } finally {
    if (conn) {
      try {
        conn.release(); // Release the connection back to the pool
      } catch (releaseError) {
        console.log(
          'Error while releasing the connection',
          'error',
          releaseError,
        );
      }
    }
  }
};

const deleteVendorService = async (ids) => {
  let conn;
  try {
    conn = await getConnection();
    await beginTransaction(conn); // Start a transaction
    const payload = { is_obsolete: true };
    const data = await deleteVendorDao(ids, payload); // Adjust DAO call for delete
    //delete banks and childs for particular user
    if (data) {
      const payloadBank = { config:{ is_freeze: true, "isFromDeletedParent": true },is_qr:false,
      is_bank:false,
      is_enabled:false};
      await updateUserDao({ id: ids.user_id }, payload, conn)
      await updateBankaccountDao({ user_id: ids.user_id }, payloadBank, conn,true);
      //for childs user hierachys
       const UserHierarchy = await getUserHierarchysDao({
         user_id: ids.user_id,
       });
       if (UserHierarchy[0]?.config?.child?.operations) {
         const userIds = UserHierarchy[0].config.child.operations;
         for (const userId of userIds) {
           await updateUserDao({ id: userId }, payload, conn);
         }
       }
    }
    await commit(conn); // Commit the transaction
    console.log('Vendor deleted successfully', 'info');
    return data;
  } catch (error) {
    if (conn) {
      try {
        await rollback(conn); // Rollback the transaction in case of error
      } catch (rollbackError) {
        console.log(
          'Error during transaction rollback',
          'error',
          rollbackError,
        );
      }
    }
    console.log('Error while deleting Vendor', 'error', error);
    throw new InternalServerError(error);
  } finally {
    if (conn) {
      try {
        conn.release(); // Release the connection back to the pool
      } catch (releaseError) {
        console.log(
          'Error while releasing the connection',
          'error',
          releaseError,
        );
      }
    }
  }
};

export {
  createVendorService,
  getVendorsService,
  updateVendorService,
  deleteVendorService,
  getVendorsBySearchService,
  getVendorsCodeService
};
