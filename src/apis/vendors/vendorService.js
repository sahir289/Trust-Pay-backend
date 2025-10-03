import { Role } from '../../constants/index.js';

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
import { updateBankaccountDao } from '../bankAccounts/bankaccountDao.js';
import { updateUserDao } from '../users/userDao.js';
// import { notifyAdminsAndUsers } from '../../utils/notifyUsers.js';
import { deleteBeneficiaryDao } from '../beneficiaryAccounts/beneficiaryAccountDao.js';
import { notifyBankResponseAccessUpdate } from '../../utils/sockets.js';
import { BadRequestError, NotFoundError } from '../../utils/appErrors.js';
const createVendorService = async (conn, payload) => {
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
    await createCalculationDao(conn, calculationPayload);

    // Handle SUB_VENDOR hierarchy creation
    if (userDesignation === Role.SUB_VENDOR && parentId) {
      try {
        const hierarchy = await getUserHierarchysDao({ user_id: parentId });
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
    logger.error('Error while creating Vendor', error);
    throw error;
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
      const userHierarchys = await getUserHierarchysDao({ user_id });
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
          const parentHierarchys = await getUserHierarchysDao({
            user_id: parentUserId,
          });
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
) => {
  let conn;
  try {
    conn = await getConnection('reader');
    await beginTransaction(conn);

    let userIdFilter = Array.isArray(user_id)
      ? [...user_id]
      : user_id
        ? [user_id]
        : [];

    if (role === Role.VENDOR) {
      const userHierarchys = await getUserHierarchysDao({ user_id });
      const userHierarchy = userHierarchys[0];

      if (designation === Role.VENDOR) {
        const subVendors = userHierarchy?.config?.siblings?.sub_vendors ?? [];
        userIdFilter = [...new Set([...userIdFilter, ...subVendors])];
      } else if (designation === Role.VENDOR_OPERATIONS) {
        const parentUserId = userHierarchy?.config?.parent;
        if (parentUserId && !userIdFilter.includes(parentUserId)) {
          userIdFilter.push(parentUserId);
        }
        if (parentUserId) {
          const parentHierarchys = await getUserHierarchysDao({
            user_id: parentUserId,
          });
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

    if (role === Role.ADMIN || role === Role.SUPER_ADMIN) {
      delete filters.user_id;
    }

    const codes = await getVendorsCodeDao(
      filters,
      conn,
      includeSubVendors,
      includeOnlyVendors,
      excludeDisabledVendor,
      includeSeperateSubVendors,
    );
    await commit(conn);
    return codes;
  } catch (error) {
    if (conn) {
      try {
        await rollback(conn);
      } catch (rollbackError) {
        logger.error('Error during transaction rollback', rollbackError);
      }
    }
    logger.error('Error while getting vendors codes', error);
    throw error;
  } finally {
    if (conn) {
      try {
        conn.release();
      } catch (releaseError) {
        logger.error('Error releasing connection:', releaseError);
      }
    }
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
      const userHierarchys = await getUserHierarchysDao({ user_id });
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
          const parentHierarchys = await getUserHierarchysDao({
            user_id: parentUserId,
          });
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

    if (role === Role.ADMIN || role === Role.SUPER_ADMIN) {
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
    );

    return data;
  } catch (error) {
    logger.error('Error while fetching vendors by search', error);
    throw error;
  }
};

const updateVendorService = async (ids, payload) => {
  let conn;
  try {
    conn = await getConnection();
    await beginTransaction(conn);

    const data = await updateVendorDao(ids, payload, conn); // Adjust DAO call for update
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
    // await notifyAdminsAndUsers({
    //   conn,
    //   company_id: data.company_id,
    //   message: `Vendor with code: ${data.code} has been updated.`,
    //   payloadUserId: data.updated_by,
    //   actorUserId: data.updated_by,
    //   category: 'Client',
    //   subCategory: 'Vendor'
    // });
    await commit(conn); // Commit the transaction
    return data;
  } catch (error) {
    if (conn) {
      try {
        await rollback(conn);
      } catch (rollbackError) {
        logger.error('Error during transaction rollback:', rollbackError);
      }
    }
    logger.error('Error while updating Vendor', error);
    throw error;
  } finally {
    if (conn) {
      try {
        conn.release();
      } catch (releaseError) {
        logger.error('Error releasing connection:', releaseError);
      }
    }
  }
};

const deleteVendorService = async (ids, updated_by) => {
  let conn;
  try {
    conn = await getConnection();
    await beginTransaction(conn); // Start a transaction
    const payload = { is_obsolete: true, updated_by };
    const data = await deleteVendorDao(conn, ids, payload); // Adjust DAO call for delete
    //delete banks and childs for particular user
    if (data) {
      const payloadBank = {
        config: { is_freeze: true, isFromDeletedParent: true },
        is_qr: false,
        is_bank: false,
        is_enabled: false,
        updated_by,
      };
      await updateUserDao({ id: ids.user_id || ids.id }, payload, conn);
      await deleteBeneficiaryDao(
        conn,
        { user_id: ids.user_id || ids.id },
        { is_obsolete: true },
      );
      await updateBankaccountDao(
        { user_id: ids.user_id || ids.id },
        payloadBank,
        conn,
        true,
      );
      //for childs user hierachys
      const UserHierarchy = await getUserHierarchysDao({
        user_id: ids.user_id || ids.id,
      });
      if (UserHierarchy[0]?.config?.child?.operations) {
        const userIds = UserHierarchy[0].config.child.operations;
        for (const userId of userIds) {
          await updateUserDao({ id: userId }, payload, conn);
        }
      }
      if (UserHierarchy[0]?.config?.siblings?.sub_vendors) {
        const userIds = UserHierarchy[0].config.siblings.sub_vendors;
        for (const userId of userIds) {
          const vendorDesignationId = await getDesignationIdDao(
            Role.VENDOR,
            conn,
          );
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
    await commit(conn); // Commit the transaction
    return data;
  } catch (error) {
    if (conn) {
      try {
        await rollback(conn); // Rollback the transaction in case of error
      } catch (rollbackError) {
        logger.error(
          'Error during transaction rollback',
          'error',
          rollbackError,
        );
      }
    }
    logger.error('Error while deleting Vendor', error);
    throw error;
  } finally {
    if (conn) {
      try {
        conn.release(); // Release the connection back to the pool
      } catch (releaseError) {
        logger.error(
          'Error while releasing the connection',
          'error',
          releaseError,
        );
      }
    }
  }
};

const getBankResponseAccessByIDService = async (id) => {
  try {
    const data = await getBankResponseAccessByIDDao(id);
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

const linkVendorService = async (vendorUserId, subVendorUserId, user_id) => {
  let conn;
  try {
    conn = await getConnection();
    await beginTransaction(conn);
    if (!(await isNetBalanceZeroForTwoHours(subVendorUserId))) {
      throw new BadRequestError('Vendor net balance must be zero to link.');
    }
    const sub = await getVendorByUserId(subVendorUserId);
    const parent = await getVendorByUserId(vendorUserId);
    if (
      sub.payin_commission > parent.payin_commission &&
      sub.payout_commission > parent.payout_commission
    ) {
      throw new BadRequestError(
        'Sub Vendor commission must be less than or equal to Parent Vendor commission.',
      );
    }
    const result = await linkVendorDao(vendorUserId, subVendorUserId, user_id);
    // Change designation to SUB_VENDOR in user table using DAO
    const subVendorDesignationId = await getDesignationIdDao(
      Role.SUB_VENDOR,
      conn,
    );
    if (subVendorDesignationId) {
      await updateUserDao(
        { id: subVendorUserId },
        { designation_id: subVendorDesignationId, updated_by: user_id },
        conn,
      );
    }
    await commit(conn);
    return result;
  } catch (error) {
    if (conn) {
      try {
        await rollback(conn);
      } catch (e) {
        logger.error('Rollback error:', e);
      }
    }
    logger.error('Error in linkVendorService:', error);
    throw error;
  } finally {
    if (conn) {
      try {
        conn.release();
      } catch (e) {
        logger.error('Release error:', e);
      }
    }
  }
};

const unlinkVendorService = async (vendorUserId, subVendorUserId, user_id) => {
  let conn;
  try {
    conn = await getConnection();
    await beginTransaction(conn);
    if (!(await isNetBalanceZeroForTwoHours(subVendorUserId))) {
      throw new BadRequestError('Vendor net balance must be zero to unlink.');
    }
    const result = await unlinkVendorDao(
      vendorUserId,
      subVendorUserId,
      user_id,
    );
    // Change designation to VENDOR in user table using DAO
    const vendorDesignationId = await getDesignationIdDao(Role.VENDOR, conn);
    if (vendorDesignationId) {
      await updateUserDao(
        { id: subVendorUserId },
        { designation_id: vendorDesignationId, updated_by: user_id },
        conn,
      );
    }
    await commit(conn);
    return result;
  } catch (error) {
    if (conn) {
      try {
        await rollback(conn);
      } catch (e) {
        logger.error('Rollback error:', e);
      }
    }
    logger.error('Error in unlinkVendorService:', error);
    throw error;
  } finally {
    if (conn) {
      try {
        conn.release();
      } catch (e) {
        logger.error('Release error:', e);
      }
    }
  }
};

const transferVendorService = async (
  subVendorUserId,
  newVendorUserId,
  currentVendorUserId,
  user_id,
) => {
  let conn;
  try {
    conn = await getConnection();
    await beginTransaction(conn);
    if (!(await isNetBalanceZeroForTwoHours(subVendorUserId))) {
      throw new BadRequestError('Vendor net balance must be zero to transfer.');
    }
    const sub = await getVendorByUserId(subVendorUserId);
    const parent = await getVendorByUserId(newVendorUserId);
    if (
      sub.payin_commission > parent.payin_commission &&
      sub.payout_commission > parent.payout_commission
    ) {
      throw new BadRequestError(
        'Sub Vendor commission must be less than or equal to Parent Vendor commission.',
      );
    }
    const result = await transferVendorDao(
      subVendorUserId,
      newVendorUserId,
      currentVendorUserId,
      user_id,
    );
    await commit(conn);
    return result;
  } catch (error) {
    if (conn) {
      try {
        await rollback(conn);
      } catch (e) {
        logger.error('Rollback error:', e);
      }
    }
    logger.error('Error in transferVendorService:', error);
    throw error;
  } finally {
    if (conn) {
      try {
        conn.release();
      } catch (e) {
        logger.error('Release error:', e);
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
  getVendorsCodeService,
  getBankResponseAccessByIDService,
  getVendorsByCodeService,
  linkVendorService,
  unlinkVendorService,
  transferVendorService,
};
