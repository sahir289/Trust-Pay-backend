import { Role } from '../../constants/index.js';
import { BadRequestError, InternalServerError } from '../../utils/appErrors.js';
import {
  beginTransaction,
  commit,
  getConnection,
  rollback,
} from '../../utils/db.js';
import { logger } from '../../utils/logger.js';
import { deactivateBank } from '../../utils/sockets.js';
import { getRoleDao } from '../roles/rolesDao.js';
import { getUserHierarchysDao } from '../userHierarchy/userHierarchyDao.js';
import { getUserByIdDao } from '../users/userDao.js';
import {
  getBeneficiaryAccountDao,
  createBeneficiaryAccountDao,
  updateBeneficiaryAccountDao,
  deleteBankaccountDao,
  getBeneficiaryAccountDaoByBankName,
  getBeneficiaryAccountBySearchDao,
  getBeneficiaryAccountDaoAll,
} from './beneficiaryAccountDao.js';
// import { notifyAdminsAndUsers } from '../../utils/notifyUsers.js';

const getBeneficiaryAccountService = async (
  filters,
  role,
  page,
  limit,
  user_id,
  designation,
) => {
  try {
    let merchant_user_id = role === Role.MERCHANT ? [user_id] : [];

    if (role === Role.MERCHANT) {
      const userHierarchys = await getUserHierarchysDao({ user_id });
      const userHierarchy = userHierarchys?.[0];

      if (designation === Role.MERCHANT && userHierarchy) {
        const subMerchants =
          userHierarchy?.config?.siblings?.sub_merchants ?? [];
        if (Array.isArray(subMerchants) && subMerchants.length > 0) {
          merchant_user_id = [...merchant_user_id, ...subMerchants];
          filters.user_id = [merchant_user_id];
        } else {
          filters.user_id = [user_id];
        }
      } else if (designation === Role.SUB_MERCHANT) {
        filters.user_id = [user_id];
      } else if (designation === Role.MERCHANT_OPERATIONS && userHierarchy) {
        const parentID = userHierarchy?.config?.parent;
        if (parentID) {
          const parentHierarchys = await getUserHierarchysDao({
            user_id: parentID,
          });
          const parentHierarchy = parentHierarchys?.[0];
          const subMerchants =
            parentHierarchy?.config?.siblings?.sub_merchants ?? [];

          const userIdFilter = [...new Set([parentID, ...subMerchants])];
          filters.user_id = [userIdFilter];
        }
      }
    } else if (role === Role.VENDOR) {
      if (designation == Role.VENDOR) {
        filters.user_id = [user_id];
      } else if (designation == Role.VENDOR_OPERATIONS) {
        const userHierarchys = await getUserHierarchysDao({ user_id });
        const parentID = userHierarchys[0]?.config?.parent;
        if (parentID) {
          filters.user_id = [parentID];
        }
      }
    }

    let role_id;
    if (filters?.beneficiary_role) {
      role_id = await getRoleDao({ role: filters.beneficiary_role });
      filters.role_id = role_id[0]?.id;
      delete filters.beneficiary_role;
    }

    const pageNumber = parseInt(page, 10) || 1;
    const pageSize = parseInt(limit, 10) || 10;

    if (role_id?.[0]?.role !== Role.VENDOR) {
      return await getBeneficiaryAccountDao(
        { ...filters },
        pageNumber,
        pageSize,
        role,
      );
    }
    else {
      return await getBeneficiaryAccountDaoAll(
        { ...filters },
        pageNumber,
        pageSize,
        role,
      );
    }

  } catch (error) {
    logger.error('error getting while  getting banks', error);
    throw new InternalServerError(error);
  }
};

const getBeneficiaryAccountBySearchService = async (
  role,
  search,
  filters,
  page,
  limit,
  user_id,
  designation,
) => {
  try {
    let merchant_user_id = role === Role.MERCHANT ? [user_id] : [];

    if (role === Role.MERCHANT) {
      const userHierarchys = await getUserHierarchysDao({ user_id });
      const userHierarchy = userHierarchys?.[0];

      if (designation === Role.MERCHANT && userHierarchy) {
        const subMerchants =
          userHierarchy?.config?.siblings?.sub_merchants ?? [];
        if (Array.isArray(subMerchants) && subMerchants.length > 0) {
          merchant_user_id = [...merchant_user_id, ...subMerchants];
          filters.user_id = [merchant_user_id];
        } else {
          filters.user_id = [user_id];
        }
      } else if (designation === Role.SUB_MERCHANT) {
        filters.user_id = [user_id];
      } else if (designation === Role.MERCHANT_OPERATIONS && userHierarchy) {
        const parentID = userHierarchy?.config?.parent;
        if (parentID) {
          const parentHierarchys = await getUserHierarchysDao({
            user_id: parentID,
          });
          const parentHierarchy = parentHierarchys?.[0];
          const subMerchants =
            parentHierarchy?.config?.siblings?.sub_merchants ?? [];
          const userIdFilter = [...new Set([parentID, ...subMerchants])];
          filters.user_id = [userIdFilter];
        }
      }
    } else if (role === Role.VENDOR) {
      if (designation == Role.VENDOR) {
        filters.user_id = [user_id];
      } else if (designation == Role.VENDOR_OPERATIONS) {
        const userHierarchys = await getUserHierarchysDao({ user_id });
        const parentID = userHierarchys[0]?.config?.parent;
        if (parentID) {
          filters.user_id = [parentID];
        }
      }
    }

    if (filters?.beneficiary_role) {
      const role_id = await getRoleDao({ role: filters.beneficiary_role });
      filters.role_id = role_id[0]?.id;
      delete filters.beneficiary_role;
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    if (isNaN(pageNum) || isNaN(limitNum) || pageNum < 1 || limitNum < 1) {
      throw new BadRequestError('Invalid pagination parameters');
    }

    const searchTerms = search
      .split(',')
      .map((term) => term.trim())
      .filter((term) => term.length > 0);
    if (searchTerms.length === 0) {
      throw new BadRequestError('Please provide valid search items');
    }


    const result = await getBeneficiaryAccountBySearchDao(
      role,
      searchTerms,
      pageNum,
      limitNum,
      filters,
    );

    return result;
  } catch (error) {
    console.error('Error in get BeneficiaryAccountBySearchService:', error);
    throw error;
  }
};

const getBeneficiaryAccountServiceByBankName = async (
  company_id,
  type,
  role,
  user_id,
  designation,
) => {
  let conn;
  try {
    conn = await getConnection();
    await beginTransaction(conn);

    let filters = {};
    if (role == Role.VENDOR) {
      filters.user_id = [user_id];
    }
    const userHierarchys = await getUserHierarchysDao({ user_id });
    if (designation == Role.VENDOR_OPERATIONS) {
      const parentID = userHierarchys[0]?.config?.parent;
      if (parentID) {
        filters.user_id = [parentID];
      }
    }

    const result = await getBeneficiaryAccountDaoByBankName(
      conn,
      company_id,
      type,
      filters,
    );
    await commit(conn);
    return result;
  } catch (error) {
    if (conn) {
      try {
        await rollback(conn);
      } catch (rollbackError) {
        logger.error('Error during transaction rollback', rollbackError);
      }
    }
    throw new InternalServerError(error);
  } finally {
    if (conn) {
      try {
        conn.release();
      } catch (releaseError) {
        logger.error('Error while releasing the connection', releaseError);
      }
    }
  }
};

const createBeneficiaryAccountService = async (conn, payload) => {
  try {
    payload.user_id = payload.user_id ? payload.user_id : payload.created_by;
    const userRole = await getUserByIdDao(conn, { id: payload.user_id });
    const role_id = await getRoleDao({ role: userRole[0].role });
    payload.role_id = role_id[0]?.id;
    const userRoleName = role_id[0]?.role;
    if (userRoleName === Role.VENDOR) {
      payload.config = { type: payload?.config.type || '', balance: 0, today_balance: 0, uniqueCode: payload?.config.uniqueCode };
      delete payload.type;
    }
    if ([Role.VENDOR, Role.MERCHANT].includes(userRoleName)) {
      // Handle user_id as array for VENDOR
      const userIds = Array.isArray(payload.user_id)
        ? payload.user_id
        : [payload.user_id];
      for (const uid of userIds) {
        const filters = { acc_no: payload.acc_no };
        if (userRoleName === Role.VENDOR) {
          filters.user_id = uid;
        }
        const beneficiary = await getBeneficiaryAccountDao(
          filters,
          1,
          10,
          userRoleName,
        );
        if (beneficiary.length > 0) {
          throw new BadRequestError(
            'Beneficiary account already exists for this merchant',
          );
        }
      }
    }
    let result;
    const userIds = Array.isArray(payload.user_id)
      ? payload.user_id
      : [payload.user_id];
    if (
      [Role.VENDOR].includes(userRoleName) &&
      userIds.length > 1
    ) {
      result = [];
      delete payload.user_id; // Remove user_id from payload for bulk creation
      for (const uid of userIds) {
        const newPayload = { ...payload, user_id: uid };
        const created = await createBeneficiaryAccountDao(conn, newPayload);
        result.push(created);
      }
    } else {
      if (Array.isArray(payload.user_id)) {
        payload.user_id = payload.user_id[0];
      }
      result = await createBeneficiaryAccountDao(conn, payload);
    }
    // await notifyAdminsAndUsers({
    //   conn,
    //   company_id: company_id,
    //   message: `The new Beneficiary Account with Bank Name ${payload.bank_name} has been created.`,
    //   payloadUserId: userIds,
    //   actorUserId: payload.updated_by,
    // });
    return result;
  } catch (error) {
    logger.error('error getting while creating banks', error);
    throw error;
  }
};

const updateBeneficiaryAccountService = async (conn, ids, payload) => {
  try {
    let result;
    const banks = await getBeneficiaryAccountDao({
       'config->>uniqueCode': payload.config_uniquecode
    });

    const userRole = await getUserByIdDao(conn, { id: payload.user_id });
    if (!userRole || userRole.length === 0 || !userRole[0].role) {
      throw new BadRequestError('Invalid user role data');
    }
    const role_id = await getRoleDao({ role: userRole[0].role });

    if (payload?.user_id && Array.isArray(payload?.user_id)) {
      for(const userId of payload.user_id){
        const alreadyExist = await getBeneficiaryAccountDao({
          'config->>uniqueCode': payload.config_uniquecode, user_id: userId
       });
       if(alreadyExist.length>0){
         const data = await updateBeneficiaryAccountDao({ user_id: userId }, {is_obsolete: true}, conn)
          return data;
      }
      else{

        const data = await createBeneficiaryAccountDao(conn, {
          user_id: userId,
          upi_id: banks[0].upi_id,
          acc_holder_name: banks[0].acc_holder_name,
          acc_no: banks[0].acc_no,
          ifsc: banks[0].ifsc,
          bank_name: banks[0].bank_name,
          config: banks[0].config,
          role_id: role_id[0].id
         });
         return data;

        }
      }

    }
    for (const bank of banks) {
      if (Object.keys(payload).length === 0) {
        if (bank.today_balance >= bank.config?.max_limit) {
          payload.is_enabled = false;
          deactivateBank(bank.nick_name, ids.id);
        } else if (bank.today_balance === bank.config?.max_limit) {
          deactivateBank(bank.nick_name, ids.id, true);
        }
      }
      delete payload.config_uniquecode;
      if (Object.keys(payload).length > 0) {
        result = await updateBeneficiaryAccountDao({ id: bank.id }, payload, conn);
        return result;
      }
      // await notifyAdminsAndUsers({
      //   conn,
      //   company_id: ids.company_id,
      //   message: `The Beneficiary Account with Bank Name ${bank.bank_name} has been updated.`,
      //   payloadUserId: payload.updated_by,
      //   actorUserId: payload.updated_by,
      // });
    }
    
  } catch (error) {
    logger.error('error getting while  updating banks', error);
    throw new BadRequestError('Error getting while  updating banks');
  }
};

const deleteBeneficiaryAccountService = async (conn, ids) => {
  try {
    const userIds = ids.user_id?.split(',') || [];
    if (userIds.length === 0) {
      throw new BadRequestError('No user_id found in ids');
    }
    const firstUserId = userIds[0]; 
    const userRoleData = await getUserByIdDao(conn, { id: firstUserId });
    if (!userRoleData || userRoleData.length === 0 || !userRoleData[0].role) {
      throw new BadRequestError('Invalid user role data');
    }
    const role_id = await getRoleDao({ role: userRoleData[0].role });
    let allBeneficiaries
    if(role_id[0].role === Role.VENDOR){
       allBeneficiaries = await getBeneficiaryAccountDao({acc_no : ids.id}, null,null, Role.VENDOR)
    }
    else{
      allBeneficiaries = await getBeneficiaryAccountDao({id : ids.id}, null,null, Role.MERCHANT)
    }

    let result;
    for(const beneficiary of allBeneficiaries){
       result = await deleteBankaccountDao(conn, { id: beneficiary.id }, {is_obsolete :true});
    }
    return result;
  } catch (error) {
    logger.error('error getting while deleting banks', error);
    throw new BadRequestError('Error getting while  deleting banks');
  }
};

export {
  getBeneficiaryAccountService,
  getBeneficiaryAccountBySearchService,
  createBeneficiaryAccountService,
  updateBeneficiaryAccountService,
  deleteBeneficiaryAccountService,
  getBeneficiaryAccountServiceByBankName,
};
