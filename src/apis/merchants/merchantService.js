import {
  BadRequestError,
  InternalServerError,
  NotFoundError,
} from '../../utils/appErrors.js';
import {
  beginTransaction,
  commit,
  getConnection,
  rollback,
} from '../../utils/db.js';
import {
  createMerchantDao,
  deleteMerchantDao,
  getMerchantsBySearchDao,
  getMerchantsCodeDao,
  getMerchantsDao,
  updateMerchantDao,
} from './merchantDao.js';
import {
  createUserHierarchyDao,
  getUserHierarchysDao,
  updateUserHierarchyDao,
} from '../userHierarchy/userHierarchyDao.js';
import {
  columns,
  merchantColumns,
  // Method,
  Role
} from '../../constants/index.js';
import { filterResponse } from '../../helpers/index.js';
import { createCalculationDao } from '../calculation/calculationDao.js';
import { logger } from '../../utils/logger.js';
// Create Merchant Service
  
const createMerchantService = async (conn, payload) => {
  try {
    const parentId = payload.created_by;
    delete payload.parentId;
    let Role_id = payload.role_id;
    let userRole = payload.role;
    let userDesignation = payload.designation;
    delete payload.role_id;
    delete payload.role;
    delete payload.designation;
    const data = await createMerchantDao(payload, conn);
    const calculationPayload = {
      role_id: Role_id,
      user_id: data.user_id,
      company_id: data.company_id,
    };
    await createCalculationDao(conn, calculationPayload);
    if (userRole === Role.MERCHANT) {
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
    }
   if (userDesignation === Role.MERCHANT) {
     try {
       const hierarchy = await getUserHierarchysDao({ user_id: parentId });
       if (!hierarchy || !hierarchy[0]?.id) {
         console.error('No hierarchy found for parentId:', parentId);
         return;
       }
      //  {"child":{"operations":[]},"siblings":{"sub_merchants":["19fb0634-31cc-41f3-a09f-29b524e4aee5","972d353d-158f-4013-93d6-a17f7e606800"]}}
       const currentChildren =
         hierarchy[0]?.config?.siblings?.sub_merchants || [];
       const userConfig = hierarchy[0]?.config;
       await updateUserHierarchyDao(
         { id: hierarchy[0].id },
         {
           config: {
             ...userConfig,
             siblings:{ sub_merchants: [...currentChildren, data.user_id] },
           },
         },
         conn
       );
     } catch (error) {
       console.error('Error updating hierarchy:', error);
     }
   }
    console.log('Merchant created successfully');
    return data;
  } catch (error) {
    console.error('Error while creating merchant', error);
    throw new InternalServerError(error);
  }
};

// Get Merchants Service
const getMerchantsService = async (
  filters,
  role,
  page,
  limit,
  designation,
  user_id,
) => {
  try {
    const filterColumns =
      role === Role.MERCHANT ? merchantColumns.MERCHANT : columns.MERCHANT;

    const pageNumber = parseInt(page, 10) || 1;
    const pageSize = parseInt(limit, 10) || 10;

    let userIdFilter = Array.isArray(user_id)
      ? [...user_id]
      : user_id
        ? [user_id]
        : [];
    if (role === Role.MERCHANT) {
      const userHierarchys = await getUserHierarchysDao({ user_id });
      const userHierarchy = userHierarchys[0];
      if (designation === Role.MERCHANT || designation === Role.SUB_MERCHANT) {
        
        if (userHierarchy?.config?.siblings?.sub_merchants) {
          const subMerchants =
            userHierarchy?.config?.siblings?.sub_merchants ?? [];
          userIdFilter = [...new Set([...userIdFilter, ...subMerchants])];

        }
      } else if (designation === Role.MERCHANT_OPERATIONS) {
        const parentUserId = userHierarchy?.config?.parent;
        if (parentUserId && !userIdFilter.includes(parentUserId)) {
          userIdFilter.push(parentUserId);
        }
        if (parentUserId) {
          const parentHierarchys = await getUserHierarchysDao({
            user_id: parentUserId,
          });
          const parentHierarchy = parentHierarchys[0];
          if (parentHierarchy?.config?.siblings?.sub_merchants) {
            const subMerchants =
              parentHierarchy?.config?.siblings?.sub_merchants ?? [];
            userIdFilter = [...new Set([...userIdFilter, ...subMerchants])];

          }
        }
      }
    }

    if (userIdFilter.length > 0) {
      filters.user_id =
        userIdFilter.length === 1 ? userIdFilter[0] : userIdFilter;
    }

    if (role === Role.ADMIN) {
      delete filters.user_id;
    }
    const data = await getMerchantsDao(
      filters,
      pageNumber,
      pageSize,
      null,
      null,
      filterColumns,
    );

    // Handle sub-merchants for specific roles and designations
    if (
      (role === Role.ADMIN ) &&
      (designation === Role.ADMIN ||
        designation === Role.TRANSACTIONS)
    ) {
      for (const merchant of data) {
        const userHierarchys = await getUserHierarchysDao({
          user_id: merchant.user_id,
        });
        const userHierarchy = userHierarchys[0];

        if (!userHierarchy?.config?.siblings?.sub_merchants) {
          merchant.subMerchants = [];
          continue;
        }

        const subMerchants =
          userHierarchy?.config?.siblings?.sub_merchants ?? [];
        const singleSubMerchant =
          subMerchants.length === 1 ? subMerchants[0] : subMerchants;

        const heir = await getMerchantsDao({
          user_id: singleSubMerchant,
          company_id: filters.company_id,
        });
        merchant.subMerchants = heir;
      }
    }

    return data;
  } catch (error) {
    console.error('Error while fetching merchants', error);
    throw new InternalServerError(error);
  }
};

const getMerchantsBySearchService = async (
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
      role === Role.MERCHANT ? merchantColumns.MERCHANT : columns.MERCHANT;

    // Prepare userIdFilter logic
    let userIdFilter = Array.isArray(user_id)
      ? [...user_id]
      : user_id
        ? [user_id]
        : [];

    
    if (role === Role.MERCHANT) {
      const userHierarchys = await getUserHierarchysDao({ user_id });
      const userHierarchy = userHierarchys[0];

      if (designation === Role.MERCHANT) {
        if (userHierarchy?.config?.siblings?.sub_merchants) {
          const subMerchants =
            userHierarchy?.config?.siblings?.sub_merchants ?? [];
          userIdFilter = [...new Set([...userIdFilter, ...subMerchants])];
        }
      } else if (designation === Role.MERCHANT_OPERATIONS) {
      console.log(userHierarchy);
        const parentUserId = userHierarchy?.config?.parent;
       if (parentUserId && !userIdFilter.includes(parentUserId)) {
          userIdFilter.push(parentUserId);

        }
        if (parentUserId) {
          const parentHierarchys = await getUserHierarchysDao({
            user_id: parentUserId,
          });
          const parentHierarchy = parentHierarchys[0];
          if (parentHierarchy?.config?.siblings?.sub_merchants) {
            const subMerchants =
              parentHierarchy?.config?.siblings?.sub_merchants ?? [];
            userIdFilter = [...new Set([...userIdFilter, ...subMerchants])];

          }
        }
      }
    }

    if (userIdFilter.length > 0) {
      filters.user_id =
        userIdFilter.length === 1 ? userIdFilter[0] : userIdFilter;
    }
 if (role === Role.ADMIN) {
   delete filters.user_id;
 }
    // Get paginated merchants matching search terms and userId filters
    const data = await getMerchantsBySearchDao(
      filters,
      searchTerms,
      limitNum,
      offset,
      filterColumns,
    );

    // Handle subMerchants (only for ADMIN roles)
    if (
      role === Role.ADMIN &&
      (designation === Role.ADMIN || designation === Role.TRANSACTIONS)
    ) {
      for (const merchant of data.merchants) {
        const userHierarchys = await getUserHierarchysDao({
          user_id: merchant.user_id,
        });
        const userHierarchy = userHierarchys[0];

        const subMerchants =
          userHierarchy?.config?.siblings?.sub_merchants ?? [];

        if (subMerchants.length === 0) {
          merchant.subMerchants = [];
          continue;
        }

        // Get all subMerchants without pagination or search filters
        const heir = await getMerchantsDao({
          user_id: subMerchants.length === 1 ? subMerchants[0] : subMerchants,
          company_id: filters.company_id,
        });

        merchant.subMerchants = heir;
      }
    }

    return data;
  } catch (error) {
    logger.error('Error while fetching merchants by search', error);
    throw new InternalServerError(error.message);
  }
};


const getMerchantsServiceCode = async (filters,role,designation,user_id) => {
  let conn;
  try {
    conn = await getConnection();
    await beginTransaction(conn);
   let userIdFilter = Array.isArray(user_id)
     ? [...user_id]
     : user_id
       ? [user_id]
       : [];
     if (role === Role.MERCHANT) {
       const userHierarchys = await getUserHierarchysDao({ user_id });
       const userHierarchy = userHierarchys[0];

       if (designation === Role.MERCHANT) {
         if (userHierarchy?.config?.siblings?.sub_merchants) {
           const subMerchants =
             userHierarchy?.config?.siblings?.sub_merchants ?? [];
           userIdFilter = [...new Set([...userIdFilter, ...subMerchants])];
         }
       } else if (designation === Role.MERCHANT_OPERATIONS) {
         const parentUserId = userHierarchy?.config?.parent;
         if (parentUserId && !userIdFilter.includes(parentUserId)) {
           userIdFilter.push(parentUserId);
         }
         if (parentUserId) {
           const parentHierarchys = await getUserHierarchysDao({
             user_id: parentUserId,
           });
           const parentHierarchy = parentHierarchys[0];
           if (parentHierarchy?.config?.siblings?.sub_merchants) {
             const subMerchants =
               parentHierarchy?.config?.siblings?.sub_merchants ?? [];
             userIdFilter = [...new Set([...userIdFilter, ...subMerchants])];
           }
         }
       }
     }
 if (userIdFilter.length > 0) {
   filters.user_id = userIdFilter.length === 1 ? userIdFilter[0] : userIdFilter;
 }
  if (role === Role.ADMIN) {
       delete filters.user_id;
     }
    // Fetch the merchant codes
    const codes = await getMerchantsCodeDao(conn, filters);
 if (
   role === Role.ADMIN &&
   (designation === Role.ADMIN || designation === Role.TRANSACTIONS)
 ) {
   for (const merchant of codes) {
     const userHierarchys = await getUserHierarchysDao({
       user_id: merchant.value,
     });
     const userHierarchy = userHierarchys[0];
     if (!userHierarchy?.config?.siblings?.sub_merchants) {
       merchant.submerchants = [];
       continue;
     }
     const submerchants = userHierarchy?.config?.siblings?.sub_merchants ?? [];
     const singleSubMerchant =
       submerchants.length === 1 ? submerchants[0] : submerchants;

     const heir = await getMerchantsCodeDao(conn,{
       user_id: singleSubMerchant,
       company_id: filters.company_id,
     });
     merchant.submerchants = heir;
   }
 }
    await commit(conn);
    return codes;
  } catch (error) {
    if (conn) {
      try {
        await rollback(conn); // Rollback the transaction in case of error
      } catch (rollbackError) {
        console.error('Error during transaction rollback', rollbackError);
      }
    }
    console.error('Error while getting merchants codes', error);
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

const getMerchantByIdService = async (
  filters,
  role,
  addUserHierarchy = false,
) => {
  const entryColumns =
    role === Role.MERCHANT ? merchantColumns.MERCHANT : columns.MERCHANT;
  const filterColumns = entryColumns.includes('user_id')
    ? entryColumns
    : [...entryColumns, 'user_id'];
  const dataArr = await getMerchantsDao(
    filters,
    null,
    null,
    null,
    null,
    filterColumns,
  );

  const merchant = dataArr[0];

  if (!merchant) {
    throw new NotFoundError('Merchant not found!');
  }

  const user_id = merchant.user_id;
  delete merchant.user_id;

  if (addUserHierarchy) {
    // user_id is unique
    const userHierarchys = await getUserHierarchysDao({ user_id });
    const userHierarchy = userHierarchys[0];

    if (
      !userHierarchy ||
      !userHierarchy.config ||
      !Array.isArray(userHierarchy.config[user_id])
    ) {
      merchant.subMerchants = [];
      return merchant;
    }

    merchant.subMerchants = await getMerchantsDao(
      {
        user_id: userHierarchy.config[user_id],
        company_id: filters.company_id,
      },
      null,
      null,
      null,
      null,
      filterColumns,
    );
  }

  return merchant;
};

export {
  createMerchantService,
  getMerchantsService,
  getMerchantsBySearchService,
  updateMerchantService,
  deleteMerchantService,
  getMerchantByIdService,
  getMerchantsServiceCode,
};
