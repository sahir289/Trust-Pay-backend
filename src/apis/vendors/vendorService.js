import { Role } from '../../constants/index.js';
import { forceLogoutUser } from '../../utils/sockets.js';
import {
  beginTransaction,
  commit,
  getConnection,
  rollback,
} from '../../utils/db.js';
import { logger } from '../../utils/logger.js';
import {
  createUserHierarchyDao,
  getUserHierarchysDao,
  updateUserHierarchyDao,
} from '../userHierarchy/userHierarchyDao.js';
import {
  createVendorDao,
  deleteVendorDao,
  getVendorsCodeDao,
  getVendorsBySearchDao,
  updateVendorDao,
  getAllVendorsDao,
  getBankResponseAccessByIDDao,
  getVendorByCodeDao,
  linkVendorDao,
  unlinkVendorDao,
  transferVendorDao,
  getDesignationIdDao,
  isNetBalanceZeroForTwoHours,
  getVendorByUserId,
} from './vendorDao.js';
import { createCalculationDao } from '../calculation/calculationDao.js';
import {
  deleteBankaccountByUserIdDao,
  getBankaccountCheckDao,
} from '../bankAccounts/bankaccountDao.js';
import { updateUserDao, getUsersNameDao } from '../users/userDao.js';
// import { notifyAdminsAndUsers } from '../../utils/notifyUsers.js';
import { deleteBeneficiaryDao } from '../beneficiaryAccounts/beneficiaryAccountDao.js';
import { notifyBankResponseAccessUpdate } from '../../utils/sockets.js';
import { BadRequestError, NotFoundError } from '../../utils/appErrors.js';
import {getSessionByIdDao} from '../auth/authDao.js';
const _createVendorServiceInternal = async (payload, conn) => {
  try {
    const parentId = payload.parent_id;
    const userDesignation = payload.designation;
    delete payload.parent_id;
    delete payload.designation;
    delete payload.role;
    let role_id = payload.role_id;
    delete payload.role_id;
    const data = await createVendorDao(payload, conn);
    const calculationPayload = {
      user_id: data.user_id,
      role_id: role_id,
      company_id: data.company_id,
    };
    await createCalculationDao(calculationPayload, conn);

    // Handle SUB_VENDOR hierarchy creation
    if (userDesignation === Role.SUB_VENDOR && parentId) {
      try {
        const hierarchy = await getUserHierarchysDao(
          { user_id: parentId },
          null,
          null,
          null,
          null,
          null,
          conn,
        );
        if (!hierarchy || hierarchy.length === 0) {
          logger.error('No hierarchy found for parentId:', parentId);
          return;
        }
        // Add the new SUB_VENDOR to the parent's siblings.sub_vendors array
        const currentChildren =
          hierarchy[0]?.config?.siblings?.sub_vendors || [];
        const userConfig = hierarchy[0]?.config;
        await updateUserHierarchyDao(
          { id: hierarchy[0].id },
          {
            config: {
              ...userConfig,
              siblings: {
                ...userConfig.siblings,
                sub_vendors: [...currentChildren, data.user_id],
              },
            },
          },
          conn,
        );
      } catch (error) {
        logger.error('Error updating vendor hierarchy:', error);
      }
    }

    await createUserHierarchyDao(
      {
        user_id: data.user_id,
        // role_id: Role_id,
        created_by: data.created_by,
        updated_by: data.updated_by,
        company_id: data.company_id,
        ...(parentId && { config: { parent: parentId } }),
      },
      conn,
    );
    // await notifyAdminsAndUsers({
    //   conn,
    //   company_id: data.company_id,
    //   message: `New Vendor with code: ${data.code} has been created.`,
    //   payloadUserId: data.updated_by,
    //   actorUserId: data.updated_by,
    //   category: 'Client',
    //   subCategory: 'Vendor'
    // });
    return data;
  } catch (error) {
    logger.error('Error while creating Vendor internally', error);
    throw error;
  }
};

const createVendorService = async (payload) => {
  let conn;
  let committed = false;
  try {
    conn = await getConnection();
    await beginTransaction(conn);
    const data = await _createVendorServiceInternal(payload, conn);
    await commit(conn);
    committed = true;
    return data;
  } catch (error) {
    if (conn && !committed) {
      await rollback(conn);
    }
    logger.error('Error while creating Vendor', error);
    throw error;
  } finally {
    if (conn) conn.release();
  }
};

const getVendorsService = async (
  filters,
  role,
  page,
  limit,
  designation,
  user_id,
) => {
  try {
    const pageNumber = parseInt(page, 10) || 1;
    const pageSize = parseInt(limit, 10) || 10;

    let userIdFilter = Array.isArray(user_id)
      ? [...user_id]
      : user_id
        ? [user_id]
        : [];

    if (role === Role.VENDOR) {
      const userHierarchys = await getUserHierarchysDao(
        { user_id },
        null,
        null,
        null,
        null,
        null,
      );
      const userHierarchy = userHierarchys[0];

      if (designation === Role.VENDOR || designation === Role.SUB_VENDOR) {
        if (userHierarchy?.config?.siblings?.sub_vendors) {
          const subVendors = userHierarchy?.config?.siblings?.sub_vendors ?? [];
          userIdFilter = [...new Set([...userIdFilter, ...subVendors])];
        }
      } else if (designation === Role.VENDOR_OPERATIONS) {
        const parentUserId = userHierarchy?.config?.parent;
        if (parentUserId && !userIdFilter.includes(parentUserId)) {
          userIdFilter.push(parentUserId);
        }
        if (parentUserId) {
          const parentHierarchys = await getUserHierarchysDao(
            {
              user_id: parentUserId,
            },
            null,
            null,
            null,
            null,
            null,
          );
          const parentHierarchy = parentHierarchys[0];
          if (parentHierarchy?.config?.siblings?.sub_vendors) {
            const subVendors =
              parentHierarchy?.config?.siblings?.sub_vendors ?? [];
            userIdFilter = [...new Set([...userIdFilter, ...subVendors])];
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

    return await getAllVendorsDao(
      filters,
      pageNumber,
      pageSize,
      null,
      null,
      role, //-role specific details
      null,
    );
  } catch (error) {
    logger.error('Error while fetching vendors', error);
    throw error;
  }
};

const getVendorsCodeService = async (
  filters,
  role,
  designation,
  user_id,
  includeSubVendors,
  includeOnlyVendors,
  excludeDisabledVendor,
  includeSeperateSubVendors,
  includeVendorAdmin,
  isEnabled,
) => {
  try {
    let userIdFilter = Array.isArray(user_id)
      ? [...user_id]
      : user_id
        ? [user_id]
        : [];

    if (role === Role.VENDOR) {
      const userHierarchys = await getUserHierarchysDao(
        { user_id },
        null,
        null,
        null,
        null,
        null,
      );
      const userHierarchy = userHierarchys[0];

      if (designation === Role.VENDOR || designation === Role.VENDOR_ADMIN) {
        const subVendors = userHierarchy?.config?.siblings?.sub_vendors ?? [];
        userIdFilter = [...new Set([...userIdFilter, ...subVendors])];
      } else if (designation === Role.VENDOR_OPERATIONS) {
        const parentUserId = userHierarchy?.config?.parent;
        if (parentUserId && !userIdFilter.includes(parentUserId)) {
          userIdFilter.push(parentUserId);
        }
        if (parentUserId) {
          const parentHierarchys = await getUserHierarchysDao(
            {
              user_id: parentUserId,
            },
            null,
            null,
            null,
            null,
            null,
          );
          const parentHierarchy = parentHierarchys[0];
          const subVendors =
            parentHierarchy?.config?.siblings?.sub_vendors ?? [];
          userIdFilter = [...new Set([...userIdFilter, ...subVendors])];
        }
      }
    }

    if (userIdFilter.length > 0) {
      filters.user_id =
        userIdFilter.length === 1 ? userIdFilter[0] : userIdFilter;
    }

    if (role === Role.ADMIN) {
      delete filters.user_id;
      excludeDisabledVendor = true;
    }

    const codes = await getVendorsCodeDao(
      filters,
      includeSubVendors,
      includeOnlyVendors,
      excludeDisabledVendor,
      includeSeperateSubVendors,
      includeVendorAdmin,
      isEnabled,
    );
    return codes;
  } catch (error) {
    logger.error('Error while getting vendors codes', error);
    throw error;
  }
};

const getVendorsBySearchService = async (
  filters,
  role,
  page,
  limit,
  designation,
  user_id,
) => {
  try {
    const pageNumber = parseInt(page, 10) || 1;
    const pageSize = parseInt(limit, 10) || 10;

    let userIdFilter = Array.isArray(user_id)
      ? [...user_id]
      : user_id
        ? [user_id]
        : [];

    if (role === Role.VENDOR) {
      const userHierarchys = await getUserHierarchysDao(
        { user_id },
        null,
        null,
        null,
        null,
        null,
      );
      const userHierarchy = userHierarchys[0];

      if (designation === Role.VENDOR || designation === Role.SUB_VENDOR) {
        if (userHierarchy?.config?.siblings?.sub_vendors) {
          const subVendors = userHierarchy?.config?.siblings?.sub_vendors ?? [];
          userIdFilter = [...new Set([...userIdFilter, ...subVendors])];
        }
      } else if (designation === Role.VENDOR_OPERATIONS) {
        const parentUserId = userHierarchy?.config?.parent;
        if (parentUserId && !userIdFilter.includes(parentUserId)) {
          userIdFilter.push(parentUserId);
        }
        if (parentUserId) {
          const parentHierarchys = await getUserHierarchysDao(
            {
              user_id: parentUserId,
            },
            null,
            null,
            null,
            null,
            null,
          );
          const parentHierarchy = parentHierarchys[0];
          if (parentHierarchy?.config?.siblings?.sub_vendors) {
            const subVendors =
              parentHierarchy?.config?.siblings?.sub_vendors ?? [];
            userIdFilter = [...new Set([...userIdFilter, ...subVendors])];
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

    let searchTerms;
    if (filters.search) {
      searchTerms = filters.search
        .split(',')
        .map((term) => term.trim())
        .filter((term) => term.length > 0);
    }
    filters.role = role;
    const data = await getVendorsBySearchDao(
      filters,
      pageNumber,
      pageSize,
      searchTerms,
      null,
    );

    return data;
  } catch (error) {
    logger.error('Error while fetching vendors by search', error);
    throw error;
  }
};

const _updateVendorServiceInternal = async (ids, payload) => {
  try {
    const data = await updateVendorDao(ids, payload); // Adjust DAO call for update
    if (
      data?.config?.bank_response_access === 'false' ||
      data?.config?.bank_response_access === false ||
      data?.config?.bank_response_access === '' ||
      data?.config?.bank_response_access === null
    ) {
      // Emit specific socket event for bank response access update
      await notifyBankResponseAccessUpdate(
        data.user_id,
        data?.config?.bank_response_access,
        data.code,
      );
    }
    if (payload.payin_commission || payload.payout_commission) {
      const userHierarchys = await getUsersNameDao(data.user_id);
      if (
        userHierarchys.designation === Role.VENDOR_ADMIN &&
        (payload.payin_commission > 5 || payload.payout_commission > 5)
      ) {
        throw new BadRequestError(
          'Vendor commission must be less than or equal to 5%.',
        );
      }
    }
    // await notifyAdminsAndUsers({
    //   conn,
    //   company_id: data.company_id,
    //   message: `Vendor with code: ${data.code} has been updated.`,
    //   payloadUserId: data.updated_by,
    //   actorUserId: data.updated_by,
    //   category: 'Client',
    //   subCategory: 'Vendor'
    // });
    return data;
  } catch (error) {
    logger.error('Error while updating Vendor internally', error);
    throw error;
  }
};

const updateVendorService = async (ids, payload) => {
  try {
    const data = await _updateVendorServiceInternal(ids, payload);
    return data;
  } catch (error) {
    logger.error('Error while updating Vendor', error);
    throw error;
  }
}; 

const _deleteVendorServiceInternal = async (ids, updated_by, conn) => {
  try {
    const payload = { is_obsolete: true, updated_by };
    const data = await deleteVendorDao(ids, payload, conn); // Adjust DAO call for delete
    //delete banks and childs for particular user
    if (data) {
      const payloadBank = {
        config: {
          is_freeze: false,
          is_intent: false,
          is_phonepay: false,
          is_staticQR: false,
          isFromDeletedParent: true,
        },
        is_qr: false,
        is_bank: false,
        is_enabled: false,
        is_obsolete: true,
        updated_by,
      };
      await updateUserDao({ id: ids.user_id || ids.id }, payload, conn);
      await deleteBeneficiaryDao(
        { user_id: ids.user_id || ids.id },
        { is_obsolete: true },
        conn,
      );
      await deleteBankaccountByUserIdDao(
        // here is a bug in below line, here need to remove user_id
        { company_id: ids.company_id, user_id: ids.user_id || ids.id },
        payloadBank,
        conn,
      );
      //for childs user hierachys
      const UserHierarchy = await getUserHierarchysDao(
        {
          user_id: ids.user_id || ids.id,
        },
        null,
        null,
        null,
        null,
        null,
        conn,
      );
      const session = await getSessionByIdDao(ids, conn);
      if (session?.session_id) {
        await forceLogoutUser(ids.user_id || ids.id, session?.session_id);
      }
      if (UserHierarchy[0]?.config?.child?.operations) {
        const userIds = UserHierarchy[0].config.child.operations;
        for (const userId of userIds) {
          await updateUserDao({ id: userId }, payload, conn);
          ids.user_id = userId;
          const session = await getSessionByIdDao(ids, conn);
          if (session?.session_id) {
            await forceLogoutUser(userId, session?.session_id);
          }
        }
      }
      if (UserHierarchy[0]?.config?.siblings?.sub_vendors) {
        const userIds = UserHierarchy[0].config.siblings.sub_vendors;
        for (const userId of userIds) {
          const vendorDesignationId = await getDesignationIdDao(Role.VENDOR);
          await updateUserDao(
            { id: userId },
            { designation_id: vendorDesignationId, updated_by: updated_by },
            conn,
          );
        }
      }
    }
    // await notifyAdminsAndUsers({
    //   conn,
    //   company_id: ids.company_id,
    //   message: `Vendor with code: ${data.code} has been deleted.`,
    //   payloadUserId: user_id,
    //   actorUserId: user_id,
    //   category: 'Client',
    //   subCategory: 'Vendor'
    // });
    return data;
  } catch (error) {
    logger.error('Error while deleting Vendor internally', error);
    throw error;
  }
};
 
const deleteVendorService = async (ids, updated_by) => {
  let conn;
  let committed = false;
  try {
    conn = await getConnection();
    await beginTransaction(conn); // Start a transaction
    const data = await _deleteVendorServiceInternal(ids, updated_by, conn);
    await commit(conn);
    committed = true; // Commit the transaction
    return data;
  } catch (error) {
    if (conn && !committed) {
      await rollback(conn); // Rollback the transaction in case of error
    }
    logger.error('Error while deleting Vendor', error);
    throw error;
  } finally {
    if (conn) conn.release();
  }
};

const getBankResponseAccessByIDService = async (id, designation) => {
  try {
    let userId = id;
    if (designation === Role.VENDOR_OPERATIONS) {
      const [userHierarchys] = await getUserHierarchysDao(
        { user_id: id },
        null,
        null,
        null,
        null,
        null,
      );
      userId = userHierarchys?.config?.parent || id;
    }
    const data = await getBankResponseAccessByIDDao(userId);
    return data;
  } catch (error) {
    logger.error('Error while fetching bank response access', error);
    throw error;
  }
};

const getVendorsByCodeService = async (code) => {
  try {
    if (!code) {
      throw new BadRequestError('Code is required');
    }
    const data = await getVendorByCodeDao(code);
    if (data.length === 0) {
      throw new NotFoundError('Vendor not found');
    }
    return data[0];
  } catch (error) {
    logger.error('Error while fetching vendor by code', error);
    throw error;
  }
};

const _linkVendorServiceInternal = async (
  vendorUserId,
  subVendorUserId,
  user_id,
  mediator_payin_commission,
  mediator_payout_commission,
  conn,
) => {
  try {
    if (!(await isNetBalanceZeroForTwoHours(subVendorUserId, conn))) {
      throw new BadRequestError('Vendor net balance must be zero to link.');
    }
    const parent = await getVendorByUserId(vendorUserId, conn);
    const banks = await getBankaccountCheckDao({ user_id: vendorUserId }, conn);
    if (banks) {
      throw new BadRequestError(
        'Parent cannot contain any existing banks. Please remove all banks from the parent before adding a new Vendor.',
      );
    }
    if (parent.payin_commission > 5 && parent.payout_commission > 5) {
      throw new BadRequestError(
        'Parent Vendor commission must be less than or equal to 5%.',
      );
    }
    const result = await linkVendorDao(
      vendorUserId,
      subVendorUserId,
      user_id,
      mediator_payin_commission,
      mediator_payout_commission,
      conn,
    );
    // Change designation to SUB_VENDOR in user table using DAO
    const subVendorDesignationId = await getDesignationIdDao(Role.SUB_VENDOR);
    if (subVendorDesignationId) {
      await updateUserDao(
        { id: subVendorUserId },
        { designation_id: subVendorDesignationId, updated_by: user_id },
        conn,
      );
    }
    return result;
  } catch (error) {
    logger.error('Error in _linkVendorServiceInternal', error);
    throw error;
  }
};

const linkVendorService = async (
  vendorUserId,
  subVendorUserId,
  user_id,
  mediator_payin_commission,
  mediator_payout_commission,
) => {
  let conn;
  let committed = false;
  try {
    conn = await getConnection();
    await beginTransaction(conn);
    const result = await _linkVendorServiceInternal(
      vendorUserId,
      subVendorUserId,
      user_id,
      mediator_payin_commission,
      mediator_payout_commission,
      conn,
    );
    await commit(conn);
    committed = true;
    return result;
  } catch (error) {
    if (conn && !committed) {
      await rollback(conn);
    }
    logger.error('Error in linkVendorService:', error);
    throw error;
  } finally {
    if (conn) conn.release();
  }
};

const _unlinkVendorServiceInternal = async (
  vendorUserId,
  subVendorUserId,
  user_id,
  conn,
) => {
  try {
    if (!(await isNetBalanceZeroForTwoHours(subVendorUserId))) {
      throw new BadRequestError('Vendor net balance must be zero to unlink.');
    }
    const result = await unlinkVendorDao(
      vendorUserId,
      subVendorUserId,
      user_id,
      conn,
    );
    // Change designation to VENDOR in user table using DAO
    const vendorDesignationId = await getDesignationIdDao(Role.VENDOR);
    if (vendorDesignationId) {
      await updateUserDao(
        { id: subVendorUserId },
        { designation_id: vendorDesignationId, updated_by: user_id },
        conn,
      );
    }
    return result;
  } catch (error) {
    logger.error('Error in _unlinkVendorServiceInternal', error);
    throw error;
  }
};

const unlinkVendorService = async (vendorUserId, subVendorUserId, user_id) => {
  let conn;
  let committed = false;
  try {
    conn = await getConnection();
    await beginTransaction(conn);
    const result = await _unlinkVendorServiceInternal(
      vendorUserId,
      subVendorUserId,
      user_id,
      conn,
    );
    await commit(conn);
    committed = true;
    return result;
  } catch (error) {
    if (conn && !committed) {
      await rollback(conn);
    }
    logger.error('Error in unlinkVendorService:', error);
    throw error;
  } finally {
    if (conn) conn.release();
  }
};

const _transferVendorServiceInternal = async (
  subVendorUserId,
  newVendorUserId,
  currentVendorUserId,
  user_id,
  conn,
) => {
  try {
    if (!(await isNetBalanceZeroForTwoHours(subVendorUserId))) {
      throw new BadRequestError('Vendor net balance must be zero to transfer.');
    }
    const parent = await getVendorByUserId(newVendorUserId, conn);
    const banks = await getBankaccountCheckDao(
      { user_id: newVendorUserId },
      conn,
    );
    if (banks) {
      throw new BadRequestError(
        'Parent cannot contain any existing banks. Please remove all banks from the New parent before transfering a new Vendor.',
      );
    }
    if (parent.payin_commission > 5 && parent.payout_commission > 5) {
      throw new BadRequestError(
        'Parent Vendor commission must be less than or equal to 5%.',
      );
    }
    const result = await transferVendorDao(
      subVendorUserId,
      newVendorUserId,
      currentVendorUserId,
      user_id,
      conn,
    );
    return result;
  } catch (error) {
    logger.error('Error in _transferVendorServiceInternal', error);
    throw error;
  }
};

const transferVendorService = async (
  subVendorUserId,
  newVendorUserId,
  currentVendorUserId,
  user_id,
) => {
  let conn;
  let committed = false;
  try {
    conn = await getConnection();
    await beginTransaction(conn);
    const result = await _transferVendorServiceInternal(
      subVendorUserId,
      newVendorUserId,
      currentVendorUserId,
      user_id,
      conn,
    );
    await commit(conn);
    committed = true;
    return result;
  } catch (error) {
    if (conn && !committed) {
      await rollback(conn);
    }
    logger.error('Error in transferVendorService:', error);
    throw error;
  } finally {
    if (conn) conn.release();
  }
};

export {
  _createVendorServiceInternal,
  createVendorService,
  getVendorsService,
  updateVendorService,
  deleteVendorService,
  getVendorsBySearchService,
  getVendorsCodeService,
  getBankResponseAccessByIDService,
  getVendorsByCodeService,
  linkVendorService,
  unlinkVendorService,
  transferVendorService,
};
