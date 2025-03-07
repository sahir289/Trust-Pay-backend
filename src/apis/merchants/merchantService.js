import { InternalServerError, NotFoundError } from '../../utils/appErrors.js';
import {
  beginTransaction,
  commit,
  getConnection,
  rollback,
} from '../../utils/db.js';
import {
  createMerchantDao,
  deleteMerchantDao,
  getMerchantsDao,
  updateMerchantDao,
} from './merchantDao.js';
import { getRoleDao } from '../roles/rolesDao.js';
import {
  createUserHierarchyDao,
  getUserHierarchysDao,
  updateUserHierarchyDao,
} from '../userHierarchy/userHierarchyDao.js';
import {
  columns,
  merchantColumns,
  Method,
  Role,
} from '../../constants/index.js';
import { filterResponse } from '../../helpers/index.js';
import { createCalculationDao } from '../calculation/calculationDao.js';
// Create Merchant Service
const createMerchantService = async (conn, payload, roleIs) => {
  try {
    const filterColumns =
      roleIs === Role.MERCHANT ? merchantColumns.MERCHANT : columns.MERCHANT;
    const parentId = payload.parentId;
    delete payload.parentId;
    const data = await createMerchantDao(payload, conn);
    const calculationPayload = {
      role_id: data.role_id,
      user_id: data.user_id,
      company_id: data.company_id,
    };
    await createCalculationDao(conn, calculationPayload);
    const role = await getRoleDao({ id: payload.role_id });
    if (role.role === Method.MERCHANT) {
      await createUserHierarchyDao(
        {
          user_id: data.user_id,
          role_id: data.role_id,
          created_by: data.created_by,
          updated_by: data.updated_by,
          company_id: data.company_id,
        },
        conn,
      );
    } else if (role.role === Method.SUBMERCHANT) {
      const hierarchy = await getUserHierarchysDao({ user_id: parentId });
      await updateUserHierarchyDao(hierarchy.id, {
        config: {
          child: [...(hierarchy?.config?.child || []), data.id], // Use spread operator to add new element
        },
      });
    }

    console.log('Merchant created successfully');
    const finalResult = filterResponse(data, filterColumns);
    return finalResult;
  } catch (error) {
    console.error('Error while creating merchant', error);
    throw new InternalServerError(error);
  }
};

// Get Merchants Service
const getMerchantsService = async (filters, role, designation, user_id) => {
  try {
    const filterColumns =
      role === Role.MERCHANT ? merchantColumns.MERCHANT : columns.MERCHANT;

    // TODO: add designation constants
    if (role === Role.MERCHANT && designation === Role.MERCHANT_ADMIN) {

      // user_id is unique
      const userHierarchys = await getUserHierarchysDao({ user_id });
      const userHierarchy = userHierarchys[0];

      if (!userHierarchy || !userHierarchy.config || !Array.isArray(userHierarchy.config[user_id])) {
        return [];
      }

      // only send merhcant underlings if Requested person is Merchant Admin
      filters.user_id = userHierarchy.config[user_id];
    }

    const data = await getMerchantsDao(
      filters,
      null,
      null,
      null,
      null,
      filterColumns,
    );

    // TODO: add designation constants
    if (role === Role.ADMIN && designation === Role.ADMIN) {
      for (const merchant of data) {
        // user_id is unique
        const userHierarchys = await getUserHierarchysDao({ user_id: merchant.user_id });
        const userHierarchy = userHierarchys[0];

        if (!userHierarchy || !userHierarchy.config || !Array.isArray(userHierarchy.config[merchant.user_id])) {
          merchant.subMerchants = [];
          continue;
        }
        // if Requested Person is Admin Admin then also send merchant underlings
        merchant.subMerchants = await getMerchantsDao({
          user_id: userHierarchy.config[merchant.user_id],
          company_id: filters.company_id
        });
      }

    }


    return data;

  } catch (error) {
    console.error('Error while fetching merchants', error);
    throw new InternalServerError(error);
  }
};

// Update Merchant Service
const updateMerchantService = async (ids, payload, role) => {
  try {
    const filterColumns =
      role === Role.MERCHANT ? merchantColumns.MERCHANT : columns.MERCHANT;
    const data = await updateMerchantDao(ids, payload); // Adjust DAO call for update
    console.log('Merchant updated successfully');
    const finalResult = filterResponse(data, filterColumns);
    return finalResult;
  } catch (error) {
    console.error('Error while updating merchant', error);
    throw new InternalServerError(error);
  }
};

// Delete Merchant Service (with Transaction Handling)
const deleteMerchantService = async (ids, updated_by, roleIs) => {
  let conn;
  try {
    const filterColumns =
      roleIs === Role.MERCHANT ? merchantColumns.MERCHANT : columns.MERCHANT;
    conn = await getConnection();
    await beginTransaction(conn); // Start a transaction

    const payload = { is_obsolete: true, updated_by };
    const data = await deleteMerchantDao(ids, payload); // Adjust DAO call for delete
    await commit(conn); // Commit the transaction
    console.log('Merchant deleted successfully');
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
    console.error('Error while deleting merchant', error);
    throw new InternalServerError(error);
  } finally {
    if (conn) {
      try {
        conn.release(); // Release the connection back to the pool
      } catch (releaseError) {
        console.error('Error while releasing the connection', releaseError);
      }
    }
  }
};

const getMerchantByIdService = async (filters, role, addUserHierarchy = false) => {

  const entryColumns = role === Role.MERCHANT ? merchantColumns.MERCHANT : columns.MERCHANT
  const filterColumns = entryColumns.includes('user_id') ? entryColumns : [...entryColumns, 'user_id'];
  const dataArr = await getMerchantsDao(
    filters,
    null,
    null,
    null,
    null,
    filterColumns,
  );

  const merchant = dataArr[0];

  if(!merchant){
    throw new NotFoundError("Merchant not found!");
  }

  const user_id = merchant.user_id;
  delete merchant.user_id;

  if (addUserHierarchy) {
    // user_id is unique
    const userHierarchys = await getUserHierarchysDao({ user_id });
    const userHierarchy = userHierarchys[0];
    
    if (!userHierarchy || !userHierarchy.config || !Array.isArray(userHierarchy.config[user_id])) {
      merchant.subMerchants = [];
      return merchant;
    }

    merchant.subMerchants = await getMerchantsDao({
      user_id: userHierarchy.config[user_id],
      company_id: filters.company_id
    });
  }

  return merchant;
}

export {
  createMerchantService,
  getMerchantsService,
  updateMerchantService,
  deleteMerchantService,
  getMerchantByIdService,
};
