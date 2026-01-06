import { BadRequestError, NotFoundError } from '../../utils/appErrors.js';
import {
  beginTransaction,
  commit,
  getConnection,
  rollback,
  buildAndExecuteUpdateQuery,
} from '../../utils/db.js';
import {
  createSettlementDao,
  deleteSettlementDao,
  getSettlementDao,
  updateSettlementDao,
  getSettlementsBySearchDao,
  getSettlementByUTRDao,
} from './settlementDao.js';
import {
  getCalculationforCronDao,
  updateCalculationBalanceDao,
  // updateCalculationDao
  updateCalculationConfigDao,
} from '../calculation/calculationDao.js';
import { getMerchantsDao } from '../merchants/merchantDao.js';
import {
  columns,
  merchantColumns,
  Role,
  Status,
  tableName,
  vendorColumns,
} from '../../constants/index.js';
import { logger } from '../../utils/logger.js';
import { getUserHierarchysDao } from '../userHierarchy/userHierarchyDao.js';
import {
  getBankResponseByUTR,
  getInternalBankResponseByUTR,
  updateBankResponseDao,
} from '../bankResponse/bankResponseDao.js';
import { getVendorsDao } from '../vendors/vendorDao.js';
import { calculateCommission } from '../../utils/calculation.js';
import { checkLockEdit } from '../../utils/advisoryLock.js';
// import { notifyAdminsAndUsers } from '../../utils/notifyUsers.js';
// import { getUsersDao } from '../users/userDao.js';
import {
  getBeneficiaryAccountDao,
  // updateBeneficiaryAccountDao,
} from '../beneficiaryAccounts/beneficiaryAccountDao.js';
import { newTableEntry } from '../../utils/sockets.js';
import { trackVendorsNetBalance } from '../../utils/trackVendorsNetBalance.js';

// Helper function to check if vendor is sub-vendor and get parent info
const getSubVendorParentInfo = async (vendor, conn = null) => {
  try {
    logger.info(
      `Settlement: Checking sub-vendor status for vendor: userId=${vendor.user_id}, designation=${vendor.designation || vendor.designation_name}, config=${JSON.stringify(vendor.config)}`,
    );

    // Check if vendor designation is SUB_VENDOR (handle both designation and designation_name properties)
    const vendorDesignation = vendor.designation || vendor.designation_name;
    if (vendorDesignation !== Role.SUB_VENDOR) {
      logger.info(
        `Settlement: Vendor is not SUB_VENDOR, designation: ${vendorDesignation}`,
      );
      return null;
    }

    // Check is_owned config
    const isOwned = vendor.config?.is_owned;
    if (isOwned === true || isOwned === 'true') {
      logger.info(
        `Settlement: Vendor is owned (is_owned=${isOwned}), skipping parent calculation`,
      );
      return null;
    }

    logger.info(
      `Settlement: Sub-vendor detected with is_owned=${isOwned}, fetching user hierarchy`,
    );

    // Get user hierarchy to find parent
    const userHierarchys = await getUserHierarchysDao(
      {
        user_id: vendor.user_id,
      },
      null,
      null,
      null,
      null,
      null,
      conn,
    );

    logger.info(
      `Settlement: User hierarchy result: ${JSON.stringify(userHierarchys)}`,
    );

    const userHierarchy = userHierarchys?.[0];
    const parentId = userHierarchy?.config?.parent;

    if (!parentId) {
      logger.warn(
        `Settlement: Sub-vendor ${vendor.user_id} has no parent in hierarchy`,
      );
      return null;
    }

    logger.info(
      `Settlement: Found parent ID: ${parentId}, fetching parent vendor details`,
    );

    // Get parent vendor details
    const parentVendors = await getVendorsDao(
      { user_id: parentId },
      null,
      null,
      null,
      null,
      null,
      null,
      conn,
    );
    if (!parentVendors || !parentVendors[0]) {
      logger.warn(
        `Settlement: Parent vendor not found for user_id: ${parentId}`,
      );
      return null;
    }

    logger.info(
      `Settlement: Parent vendor found: ${JSON.stringify(parentVendors[0])}`,
    );

    return {
      parentVendor: parentVendors[0],
      parentUserId: parentId,
    };
  } catch (error) {
    logger.error('Settlement: Error in getSubVendorParentInfo:', error);
    return null;
  }
};

// Helper function to calculate commission for parent vendor in settlement
const updateParentVendorSettlementCalculation = async (
  parentUserId,
  amount,
  vendorCommissionRate,
  isApproved,
  conn = null,
) => {
  try {
    logger.info(`Settlement: updateParentVendorSettlementCalculation called with: parentUserId=${parentUserId}, amount=${amount}, rate=${vendorCommissionRate}, isApproved=${isApproved}`);
    // Ensure numeric inputs to avoid NaN being persisted to DB
    const safeAmount = Number(amount) || 0;
    let safeRate = Number(vendorCommissionRate);
    if (!Number.isFinite(safeRate)) safeRate = 0;

    const parentCommission = calculateCommission(safeAmount, safeRate);
    
    logger.info(`Settlement: Calculated parent commission: ${parentCommission}`);
    
    // Get parent calculation data
    const parentCalculationData = await getCalculationforCronDao(
      parentUserId,
      conn,
    );
    if (!parentCalculationData[0]) {
      throw new NotFoundError(
        `Settlement: Parent calculation not found for user_id: ${parentUserId}`,
      );
    }
    // Create calculation update for parent vendor
    const calculationUpdate = isApproved
      ? {
          // For approval: Remove commission from parent (negative commission)
          total_settlement_count: 1,
          total_settlement_amount: 0, // Parent amount is always 0
          total_settlement_commission: parentCommission, // Negative to remove commission
          current_balance: parentCommission,
          net_balance: parentCommission,
        }
      : {
          // For reversal: Add commission back to parent (positive commission)
          total_settlement_count: -1,
          total_settlement_amount: 0, // Parent amount is always 0
          total_settlement_commission: -parentCommission, // Positive to add commission back
          current_balance: -parentCommission,
          net_balance: -parentCommission,
        };
    logger.info(
      `Settlement: Updating parent calculation table with: ${JSON.stringify(calculationUpdate)}`,
    );
    const response = await updateCalculationBalanceDao(
      { id: parentCalculationData[0].id },
      calculationUpdate,
      conn,
    );
    await trackVendorsNetBalance(parentUserId, response);

    logger.info(
      `Settlement: Parent vendor calculation table updated successfully for userId: ${parentUserId}`,
    );

    return parentCommission;
  } catch (error) {
    logger.error(
      'Settlement: Error in updateParentVendorSettlementCalculation:',
      error,
    );
    throw error;
  }
};

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
    logger.error('error getting while  getting settlements', error);
    throw error;
  }
};

const getSettlementService = async (
  ids,
  filters,
  page,
  limit,
  sortBy,
  sortOrder,
  role,
  user_id,
  designation,
) => {
  try {
    // Validate required parameters
    if (!ids?.company_id) {
      throw new BadRequestError('Company ID is required');
    }
    // Determine column selection based on role
    const filterColumns = (() => {
      switch (ids.role) {
        case Role.MERCHANT:
          return merchantColumns.SETTLEMENT;
        case Role.VENDOR:
          return vendorColumns.SETTLEMENT;
        default:
          return columns.SETTLEMENT;
      }
    })();

    if (role == Role.MERCHANT && designation != Role.MERCHANT_OPERATIONS) {
      filters.user_id ? filters.user_id : (filters.user_id = [user_id]);
    }
    if (role == Role.VENDOR && designation != Role.VENDOR_OPERATIONS) {
      filters.user_id ? filters.user_id : (filters.user_id = [user_id]);
    }
    if (role === Role.MERCHANT) {
      // if (userHierarchys || userHierarchys.length > 0) {
      //   const userHierarchy = userHierarchys[0];
      //   if (
      //     userHierarchy?.config ||
      //     Array.isArray(userHierarchy?.config?.siblings?.sub_merchants)
      //   ) {
      //     filters.user_id = [
      //       ...filters.user_id,
      //       ...(userHierarchy?.config?.siblings?.sub_merchants ?? []),
      //     ];
      //   }
      // }
      if (designation === Role.MERCHANT_OPERATIONS) {
        const userHierarchys = await getUserHierarchysDao(
          { user_id },
          null,
          null,
          null,
          null,
          null,
          null,
        );
        if (userHierarchys || userHierarchys.length > 0) {
          const userHierarchy = userHierarchys[0];
          if (userHierarchy?.config?.parent) {
            filters.user_id = [userHierarchy?.config?.parent ?? null];
          }
        }
      }
    } else if (role === Role.VENDOR) {
      if (designation === Role.VENDOR_OPERATIONS) {
        const userHierarchys = await getUserHierarchysDao(
          { user_id },
          null,
          null,
          null,
          null,
          null,
          null,
        );
        if (userHierarchys || userHierarchys.length > 0) {
          const userHierarchy = userHierarchys[0];
          if (userHierarchy?.config?.parent) {
            filters.user_id = [userHierarchy?.config?.parent ?? null];
          }
        }
      }
    }
    // Prepare filter object, ensuring all properties are included
    const daoFilters = {
      company_id: ids.company_id,
      ...(ids.role_name && { role: ids.role_name }),
      ...filters,
    };

    // Call DAO with validated parameters
    const settlementData = await getSettlementDao(
      daoFilters,
      page,
      limit,
      sortBy || 'sno',
      sortOrder || 'DESC',
      filterColumns,
    );

    return settlementData;
  } catch (error) {
    logger.error('Error in getSettlementService:', error);
    throw error;
  }
};
// const searchTerms = filters.search
//   .split(',')
//   .map((term) => term.trim())
//   .filter((term) => term.length > 0);
const getSettlementsBySearchService = async (
  ids,
  filters,
  page,
  limit,
  sortBy,
  sortOrder,
  role,
  user_id,
  designation,
) => {
  try {
    // Validate required parameters
    if (!ids?.company_id) {
      throw new BadRequestError('Company ID is required');
    }

    // Determine column selection based on role
    const filterColumns = (() => {
      switch (role) {
        case Role.MERCHANT:
          return merchantColumns.SETTLEMENT;
        case Role.VENDOR:
          return vendorColumns.SETTLEMENT;
        default:
          return columns.SETTLEMENT;
      }
    })();

    // Apply user_id filter based on role and designation
    if (role === Role.MERCHANT && designation !== Role.MERCHANT_OPERATIONS) {
      filters.user_id = [user_id];
    }
    if (role === Role.VENDOR && designation !== Role.VENDOR_OPERATIONS) {
      filters.user_id = [user_id];
    }

    // Handle MERCHANT role hierarchy
    if (role === Role.MERCHANT) {
      if (designation === Role.MERCHANT_OPERATIONS) {
        const userHierarchys = await getUserHierarchysDao(
          { user_id },
          null,
          null,
          null,
          null,
          null,
          null,
        );
        if (userHierarchys && userHierarchys.length > 0) {
          const userHierarchy = userHierarchys[0];
          if (userHierarchy?.config?.parent) {
            filters.user_id = [userHierarchy.config.parent];
          }
        }
      }
    }
    // Handle VENDOR role hierarchy
    else if (role == Role.VENDOR) {
      const userHierarchys = await getUserHierarchysDao(
        { user_id },
        null,
        null,
        null,
        null,
        null,
        null,
      );
      const userHierarchy = userHierarchys?.[0];

      const subVendors = userHierarchy?.config?.siblings?.sub_vendors ?? [];
      if (Array.isArray(subVendors) && subVendors.length > 0) {
        const vendorUserIds = [user_id, ...subVendors];
        filters.user_id = vendorUserIds;
      } else {
        filters.user_id = [user_id];
      }
    } else if (role == Role.SUB_VENDOR) {
      filters.user_id = [user_id];
    }

    const userHierarchys = await getUserHierarchysDao(
      { user_id },
      null,
      null,
      null,
      null,
      null,
      null,
    );
    if (designation == Role.VENDOR_OPERATIONS) {
      const userHierarchy = userHierarchys?.[0];
      const parentID = userHierarchy?.config?.parent;
      const subVendors = userHierarchy?.config?.siblings?.sub_vendors ?? [];

      if (parentID) {
        if (Array.isArray(subVendors) && subVendors.length > 0) {
          const vendorUserIds = [parentID, ...subVendors];
          filters.user_id = vendorUserIds;
        } else {
          filters.user_id = [parentID];
        }
      }
    }

    // Prepare filter object
    const daoFilters = {
      company_id: ids.company_id,
      ...(ids.role_name && { role: ids.role_name }),
      ...filters,
    };

    // Process search terms
    const searchTerms = filters.search
      ? filters.search
          .split(',')
          .map((term) => term.trim())
          .filter((term) => term.length > 0)
      : [];

    // Call DAO
    const settlementData = await getSettlementsBySearchDao(
      daoFilters,
      page,
      limit,
      sortBy || 'sno',
      sortOrder || 'DESC',
      filterColumns,
      searchTerms,
      role,
    );

    return settlementData;
  } catch (error) {
    logger.error('Error while fetching settlements', error);
    throw error;
  }
};

const _createSettlementServiceInternal = async (payload, role, conn) => {
  const isInternalTransfer =
    payload.method === 'INTERNAL_QR_TRANSFER' ||
    payload.method === 'INTERNAL_BANK_TRANSFER';

  // Early return for non-internal transfers without reference_id
  if (!isInternalTransfer || !payload.config?.reference_id) {
    const result = await createSettlementDao(payload, conn);

    // Emit socket event for new settlement
    const settlementResponseObj = {
      id: result.id,
      sno: result.sno || null,
      user_id: result.user_id || null,
      status: result.status || null,
      amount: result.amount || 0,
      method: result.method || null,
      config: result.config || {},
      approved_at: result.approved_at || null,
      rejected_at: result.rejected_at || null,
      created_by: result.created_by || '',
      updated_by: result.updated_by || '',
      created_at: result.created_at,
      updated_at: result.updated_at,
      code: result.code || null,
    };
    setImmediate(() => {
      newTableEntry(tableName.SETTLEMENT, settlementResponseObj).catch((err) =>
        logger.error('Socket emit failed for settlement:', err),
      );
    });

    return result;
  }

  // Validate bank response for internal transfers
  const bankResponses = await getBankResponseByUTR(payload.config.reference_id);
  if (!bankResponses) {
    throw new NotFoundError('Bank response not found for the provided UTR');
  }

  // Get settlement data
  const settlementArray = await getSettlementByUTRDao(
    payload.config?.reference_id,
  );

  if (
    bankResponses.is_used ||
    bankResponses.status !== Status.BOT ||
    settlementArray?.length
  ) {
    throw new BadRequestError('UTR is already used');
  }

  // Handle vendor role internal transfers
  if (role !== Role.VENDOR) {
    const result = await handleVendorInternalTransferByAdmin(
      payload,
      bankResponses,
      conn,
    );
    return result;
  }

  // Handle other roles internal transfers
  const result = await handleVendorInternalTransfer(payload, conn);
  return result;
};

const createSettlementService = async (payload, role) => {
  let conn;
  let committed = false;
  try {
    conn = await getConnection();
    await beginTransaction(conn);
    const result = await _createSettlementServiceInternal(payload, role, conn);
    await commit(conn);
    committed = true;
    return result;
  } catch (error) {
    if (conn && !committed) await rollback(conn);
    logger.error('Error while creating Settlement', error);
    throw error;
  } finally {
    if (conn) conn.release();
  }
};

// Helper function for internal transfers from admin
const handleVendorInternalTransferByAdmin = async (
  payload,
  bankResponses,
  conn,
) => {
  // Get vendor and calculation data
  const [vendorData, calculationData] = await Promise.all([
    getVendorsDao(
      { user_id: payload.user_id },
      null,
      null,
      null,
      null,
      null,
      null,
      conn,
    ),
    getCalculationforCronDao(payload.user_id, conn),
  ]);

  if (!vendorData?.length) {
    throw new NotFoundError('Vendor not found');
  }
  if (!calculationData?.length) {
    throw new NotFoundError('Calculation data not found');
  }

  const vendorCommission = vendorData[0].payin_commission || 0;
  const commission = calculateCommission(payload.amount, vendorCommission);

  // Update bank response status
  const response = await updateBankResponseDao(
    { id: bankResponses.id },
    { status: '/internalTransfer' },
    conn,
  );
  const responseObj = {
    id: response.id,
    sno: response.sno,
    status: response.status,
    bank_id: response.bank_id,
    amount: response.amount,
    upi_short_code: response.upi_short_code || null,
    utr: response.utr,
    is_used: response.is_used === 'true',
    created_at: response.created_at,
    updated_at: response.updated_at,
    created_by: response.created_by,
    config: response.config || {},
    updated_by: response.updated_by,
    company_id: payload.company_id,
  };
  // Send to socket for real-time update
  await newTableEntry(tableName.BANK_RESPONSE, responseObj);

  // Update calculation balance
  const updatedCalculation = {
    total_settlement_count: 1,
    total_settlement_amount: -payload.amount,
    total_settlement_commission: commission,
    current_balance: -payload.amount + commission,
    net_balance: -payload.amount + commission,
  };

  const calculationResponse = await updateCalculationBalanceDao(
    { id: calculationData[0].id },
    updatedCalculation,
    conn,
  );

  await trackVendorsNetBalance(calculationData[0].user_id, calculationResponse);

  // Update calculation config based on method
  const config = getConfigForMethod(
    payload.method,
    calculationData[0].config,
    payload.amount,
  );
  await updateCalculationConfigDao(
    { id: calculationData[0].id },
    { config },
    conn,
  );

  // Set final payload properties
  payload.status = Status.SUCCESS;
  payload.approved_at = new Date();
  const subVendorParentInfo = await getSubVendorParentInfo(vendorData[0]);
  if (subVendorParentInfo) {
    await updateParentVendorSettlementCalculation(
      subVendorParentInfo.parentUserId,
      payload.amount,
      Number(vendorData[0].config?.mediator_payin_commission) || 0,
      true,
    );
  }
  const settlementResult = await createSettlementDao(payload, conn);

  // Emit socket event for new settlement
  const settlementResponseObj = {
    id: settlementResult.id,
    sno: settlementResult.sno,
    amount: settlementResult.amount,
    status: settlementResult.status,
    method: settlementResult.method,
    user_id: settlementResult.user_id,
    company_id: settlementResult.company_id,
    role: settlementResult.role,
    created_at: settlementResult.created_at,
    updated_at: settlementResult.updated_at,
    created_by: settlementResult.created_by,
    approved_at: settlementResult.approved_at,
    config: settlementResult.config,
  };
  setImmediate(() => {
    newTableEntry(tableName.SETTLEMENT, settlementResponseObj).catch((err) =>
      logger.error('Socket emit failed for settlement:', err),
    );
  });

  return settlementResult;
};

// Helper function for internal transfers from vendors
const handleVendorInternalTransfer = async (payload, conn) => {
  // Adjust amount based on debit_credit type
  const isReceived = payload.config.debit_credit === 'RECEIVED';
  const amount = Number(payload.amount);

  if (isReceived && amount > 0) {
    payload.amount = amount;
  } else {
    payload.amount = isReceived
      ? amount > 0
        ? -amount
        : amount
      : Math.abs(amount);
  }

  const settlementResult = await createSettlementDao(payload, conn);

  // Emit socket event for new settlement
  const settlementResponseObj = {
    id: settlementResult.id,
    sno: settlementResult.sno || null,
    user_id: settlementResult.user_id || null,
    status: settlementResult.status || null,
    amount: settlementResult.amount || 0,
    method: settlementResult.method || null,
    config: settlementResult.config || {},
    approved_at: settlementResult.approved_at || null,
    rejected_at: settlementResult.rejected_at || null,
    created_by: settlementResult.created_by || '',
    updated_by: settlementResult.updated_by || '',
    created_at: settlementResult.created_at,
    updated_at: settlementResult.updated_at,
    code: settlementResult.code || null,
  };
  setImmediate(() => {
    newTableEntry(tableName.SETTLEMENT, settlementResponseObj).catch((err) =>
      logger.error('Socket emit failed for settlement:', err),
    );
  });

  return settlementResult;
};

// Helper function to get config based on method
const getConfigForMethod = (method, existingConfig, amount) => {
  const configKey =
    method === 'INTERNAL_QR_TRANSFER'
      ? 'total_internalSettlement_amount'
      : 'total_internalBankSettlement_amount';

  const currentAmount = existingConfig[configKey] || 0;
  const newAmount = currentAmount > 0 ? currentAmount + amount : amount;

  return { [configKey]: newAmount };
};

// Constants for internal transfer methods
const INTERNAL_METHODS = ['INTERNAL_QR_TRANSFER', 'INTERNAL_BANK_TRANSFER'];
const TRANSFER_METHODS = ['CASH', 'BANK', 'CRYPTO', 'AED'];

// Helper function to create bank response object
const createBankResponseObject = (response, companyId) => ({
  id: response.id,
  sno: response.sno,
  status: response.status,
  bank_id: response.bank_id,
  amount: response.amount,
  upi_short_code: response.upi_short_code || null,
  utr: response.utr,
  is_used: response.is_used === 'true',
  created_at: response.created_at,
  updated_at: response.updated_at,
  created_by: response.created_by,
  config: response.config || {},
  updated_by: response.updated_by,
  company_id: companyId,
});

// Helper function to validate UTR
const validateUTR = (payload, settlementData) => {
  const isInternalMethod = INTERNAL_METHODS.includes(settlementData.method);

  if (
    payload.config.reference_id !== undefined &&
    settlementData.config?.reference_id === payload.config.reference_id &&
    (payload.config.reference_id !== '' || !payload.config.rejected_reason) &&
    !isInternalMethod
  ) {
    throw new BadRequestError('UTR already exists');
  }
};

// Helper function to handle internal transfer UTR
const handleInternalTransferUTR = async (
  payload,
  settlementData,
  changeUTRStatus,
  conn,
) => {
  const isInternalMethod = INTERNAL_METHODS.includes(settlementData.method);

  if (
    isInternalMethod &&
    payload.config.reference_id &&
    settlementData.status === Status.INITIATED
  ) {
    const bankResponses = await getBankResponseByUTR(
      payload.config.reference_id,
    );
    if (!bankResponses) {
      throw new NotFoundError('Bank response not found for the provided UTR');
    }

    if (changeUTRStatus) {
      if (
        bankResponses.is_used === false &&
        bankResponses.status === Status.BOT
      ) {
        const response = await updateBankResponseDao(
          { id: bankResponses.id },
          { status: '/internalTransfer' },
          conn,
        );

        const responseObj = createBankResponseObject(
          response,
          settlementData.company_id,
        );
        await newTableEntry(tableName.BANK_RESPONSE, responseObj);
      } else {
        throw new BadRequestError('UTR is already used');
      }
    }
  }
};

// Helper function to calculate vendor commission
const calculateVendorCommission = async (payload) => {
  const [vendorData] = await Promise.all([
    getVendorsDao({ user_id: payload.user_id }),
  ]);

  if (!vendorData?.length) {
    throw new NotFoundError('Vendor not found');
  }

  const vendor = vendorData[0];
  const vendorCommission = vendor.payin_commission || 0;
  const baseCommission = calculateCommission(payload.amount, vendorCommission);

  // Check if this is a sub-vendor and calculate parent commission
  const subVendorParentInfo = await getSubVendorParentInfo(vendor);
  if (subVendorParentInfo) {
    const parentCommission = calculateCommission(
      payload.amount,
      Number(vendor.config?.mediator_payin_commission) || 0,
    );
    payload._subVendorParentInfo = subVendorParentInfo;
    payload._parentCommission = parentCommission;
  }
  return baseCommission;
};

// Helper function to create calculation update object
const createCalculationUpdate = (
  settlementData,
  payload,
  commission = 0,
  isReversed = false,
) => {
  const amount = payload.amount || 0;
  const isInternalMethod = INTERNAL_METHODS.includes(settlementData.method);

  if (settlementData.role === Role.MERCHANT) {
    return {
      total_settlement_count: 1,
      total_settlement_amount: isReversed ? -amount : amount,
      current_balance: isReversed ? amount : -amount,
      net_balance: isReversed ? amount : -amount,
    };
  }

  // Vendor calculations
  if (isInternalMethod) {
    const settlementAmount = isReversed ? amount : -amount;
    const commissionAmount = isReversed ? -commission : commission;
    const balance = settlementAmount + commissionAmount;

    return {
      total_settlement_count: 1,
      total_settlement_amount: settlementAmount,
      total_settlement_commission: commissionAmount,
      current_balance: balance,
      net_balance: balance,
    };
  }

  return {
    total_settlement_count: 1,
    total_settlement_amount: isReversed ? -amount : amount,
    current_balance: isReversed ? -amount : amount,
    net_balance: isReversed ? -amount : amount,
  };
};

// Helper function to update beneficiary account
const updateBeneficiaryAccount = async (
  settlementData,
  payload,
  isReversed = false,
  conn = null,
) => {
  try {
    if (
      settlementData.role !== Role.VENDOR ||
      settlementData.method !== 'BANK'
    ) {
      return;
    }

    const searchCriteria = isReversed
      ? { user_id: settlementData.config.bank_id }
      : { bank_name: settlementData.config.bank_name };

    const [beneficiaryAcc] = await getBeneficiaryAccountDao(searchCriteria);

    if (!beneficiaryAcc) return;

    const isSend =
      payload.config?.debit_credit === 'send' ||
      settlementData.config?.debit_credit === 'send';
    const amount = payload.amount || 0;

    let beneficiaryClosingBalance;
    if (isReversed) {
      beneficiaryClosingBalance = isSend
        ? beneficiaryAcc.config?.closing_balance + amount
        : beneficiaryAcc.config?.closing_balance - amount;
    } else {
      beneficiaryClosingBalance = isSend
        ? beneficiaryAcc.config?.closing_balance - amount
        : beneficiaryAcc.config?.closing_balance + amount;
    }

    const beneficiaryUpdatedConfig = {
      ...beneficiaryAcc.config,
      closing_balance: beneficiaryClosingBalance,
    };

    await buildAndExecuteUpdateQuery(
      tableName.BENEFICIARY_ACCOUNTS,
      { config: beneficiaryUpdatedConfig },
      { id: beneficiaryAcc.id, company_id: settlementData.company_id },
      {},
      { returnUpdated: true },
      conn,
    );

    // Update payload config
    if (isReversed && isSend) {
      payload.config = {
        ...settlementData.config,
        beneficiary_closing_balance:
          settlementData.config?.closing_balance + amount,
      };
    } else if (isReversed) {
      payload.config = {
        ...settlementData.config,
        beneficiary_initial_balance:
          settlementData.config?.initial_balance - amount === 0
            ? settlementData.config?.initial_balance
            : Number(settlementData.config?.initial_balance) - Number(amount),
        beneficiary_closing_balance:
          Number(settlementData.config?.closing_balance) - Number(amount),
      };
    } else {
      payload.config = {
        ...payload.config,
        beneficiary_initial_balance: beneficiaryAcc.config?.closing_balance,
        beneficiary_closing_balance: beneficiaryClosingBalance,
      };
    }
  } catch (error) {
    logger.error('Error updating beneficiary account:', error);
    throw error;
  }
};

// Helper function to handle internal transfer reversal
const handleInternalTransferReversal = async (
  settlementData,
  payload,
  conn = null,
) => {
  const [vendorData, calculationData] = await Promise.all([
    getVendorsDao(
      { user_id: settlementData.user_id },
      null,
      null,
      null,
      null,
      null,
      null,
      conn,
    ),
    getCalculationforCronDao(settlementData.user_id, conn),
  ]);

  if (!vendorData?.length) {
    throw new NotFoundError('Vendor not found');
  }
  if (!calculationData?.length) {
    throw new NotFoundError('Calculation data not found');
  }

  const bankResponses = await getInternalBankResponseByUTR(
    settlementData.config?.reference_id,
  );

  if (!bankResponses) {
    throw new NotFoundError('Bank response not found for the provided UTR');
  }
  if (
    bankResponses.is_used === true ||
    payload.config?.reference_id === settlementData.config?.reference_id
  ) {
    throw new BadRequestError('UTR is already used');
  }

  const response = await updateBankResponseDao(
    { id: bankResponses.id },
    { status: '/success' },
    conn,
  );

  const responseObj = createBankResponseObject(
    response,
    settlementData.company_id,
  );
  await newTableEntry(tableName.BANK_RESPONSE, responseObj, conn);

  const commission = calculateCommission(
    payload.amount,
    vendorData[0].payin_commission || 0,
  );

  // Handle sub-vendor parent calculation for reversal
  const subVendorParentInfo = await getSubVendorParentInfo(vendorData[0], conn);
  if (subVendorParentInfo) {
    await updateParentVendorSettlementCalculation(
      subVendorParentInfo.parentUserId,
      payload.amount,
      Number(vendorData[0].config?.mediator_payin_commission) || 0,
      false, // isApproved = false (add commission back to parent)
      conn,
    );

    logger.info(
      `Settlement reversal: Parent vendor calculation updated for sub-vendor settlement reversal`,
    );
  }

  return {
    total_settlement_count: 1,
    total_settlement_commission: -commission,
    total_settlement_amount: payload.amount || 0,
    current_balance: (payload.amount || 0) - commission,
    net_balance: (payload.amount || 0) - commission,
  };
};

// Helper function to validate status transitions
const validateStatusTransition = (currentStatus, newStatus) => {
  if (currentStatus === Status.REJECTED && newStatus === Status.SUCCESS) {
    throw new BadRequestError(
      'Cannot change payout status from rejected to approved',
    );
  }

  if (newStatus === currentStatus) {
    throw new BadRequestError(
      'Payout status cannot be updated to the same value',
    );
  }
};

// Helper function to calculate settlement config amounts
const calculateSettlementConfigAmount = (
  method,
  currentConfig,
  amount,
  isReversed,
) => {
  const configMapping = {
    INTERNAL_QR_TRANSFER: 'total_internalSettlement_amount',
    INTERNAL_BANK_TRANSFER: 'total_internalBankSettlement_amount',
  };

  const configKey = configMapping[method];
  if (!configKey) return null;

  const currentAmount = currentConfig[configKey] || 0;
  const calculatedAmount = isReversed
    ? currentAmount > 0
      ? currentAmount - amount
      : -amount
    : currentAmount > 0
      ? currentAmount + amount
      : amount;

  return { [configKey]: calculatedAmount };
};

// Helper function to calculate transfer method config
const calculateTransferMethodConfig = (
  method,
  debitCredit,
  currentConfig,
  amount,
  isReversed,
) => {
  const methodMappings = {
    CASH: {
      SENT: 'total_cashSentSettlement_amount',
      RECEIVED: 'total_cashReceivedSettlement_amount',
    },
    BANK: {
      SENT: 'total_bankSentSettlement_amount',
      RECEIVED: 'total_bankReceivedSettlement_amount',
    },
    CRYPTO: {
      SENT: 'total_cryptoSentSettlement_amount',
      RECEIVED: 'total_cryptoReceivedSettlement_amount',
    },
    AED: {
      SENT: 'total_aedSentSettlement_amount',
      RECEIVED: 'total_aedReceivedSettlement_amount',
    },
  };

  const mapping = methodMappings[method];
  if (!mapping) return null;

  const keyName = mapping[debitCredit] || mapping.RECEIVED;
  const positiveAmount = Math.abs(amount);
  const currentAmount = currentConfig[keyName] || 0;

  const totalSettlementAmount = isReversed
    ? currentAmount > 0
      ? currentAmount - positiveAmount
      : -positiveAmount
    : currentAmount > 0
      ? currentAmount + positiveAmount
      : positiveAmount;

  return { [keyName]: totalSettlementAmount };
};

const _updateSettlementServiceInternal = async (ids, payload, conn) => {
  await checkLockEdit(ids.id, false, conn);
  payload.config = payload.config || {};

  // Get settlement data
  const settlementArray = await getSettlementDao({
    id: ids.id,
    company_id: ids.company_id,
  });

  if (!settlementArray?.length) {
    throw new NotFoundError('Settlement not found');
  }

  const settlementData = settlementArray[0];

  // Validate UTR
  validateUTR(payload, settlementData);

  let changeUTRStatus = true;

  if (payload.config.rejected_reason) {
    changeUTRStatus = false;
  }

  // Handle internal transfer UTR
  await handleInternalTransferUTR(
    payload,
    settlementData,
    changeUTRStatus,
    conn,
  );

  // Get calculation data
  const calculationData = await getCalculationforCronDao(
    settlementData.user_id,
    conn,
  );

  // Handle rejection
  if (payload.config.rejected_reason) {
    payload.status = Status.REJECTED;
    payload.rejected_at = new Date();
    payload.config.reference_id = '';
  }

  // Handle approval (reference_id provided)
  if (payload.config.reference_id) {
    payload.status = Status.SUCCESS;
    payload.approved_at = new Date();

    // Get merchant data to determine role
    const merchantData = await getMerchantsDao(
      {
        user_id: settlementData.user_id,
      },
      null,
      null,
      null,
      null,
      'ADMIN',
      conn,
    );
    const isMerchant = merchantData.length > 0;

    let updatedCalculation;

    if (Array.isArray(calculationData) && calculationData.length > 0) {
      if (isMerchant) {
        updatedCalculation = createCalculationUpdate(settlementData, payload);
      } else {
        // Vendor approval
        const isInternalMethod = INTERNAL_METHODS.includes(
          settlementData.method,
        );
        if (isInternalMethod) {
          const commission = await calculateVendorCommission(payload);
          updatedCalculation = createCalculationUpdate(
            settlementData,
            payload,
            commission,
          );

          // Handle parent vendor calculation for sub-vendors (only for internal methods)
          if (payload._subVendorParentInfo && payload._parentCommission) {
            await updateParentVendorSettlementCalculation(
              payload._subVendorParentInfo.parentUserId,
              payload.amount,
              Number(
                payload._subVendorParentInfo.parentVendor.payin_commission,
              ),
              true, // isApproved = true (remove commission from parent)
              conn,
            );

            logger.info(
              `Settlement approval: Parent vendor calculation updated for sub-vendor settlement`,
            );
          }
        } else {
          updatedCalculation = createCalculationUpdate(settlementData, payload);
        }
      }

      // Update calculation balance
      const { id } = calculationData[0];
      const updatedCalculationData = await updateCalculationBalanceDao(
        { id },
        updatedCalculation,
        conn,
      );

      await trackVendorsNetBalance(
        calculationData[0].user_id,
        updatedCalculationData,
      );
    }
    delete payload._subVendorParentInfo;
    delete payload._parentCommission;
    delete payload.config.brokerage_commission;

    // Update beneficiary account for vendor bank transactions
    await updateBeneficiaryAccount(settlementData, payload, false, conn);
  }

  // Handle reversal (status INITIATED)
  if (payload.status === Status.INITIATED) {
    // Skip if already reversed
    if (settlementData.status === Status.REVERSED) {
      throw new BadRequestError('Settlement is already reversed');
    }

    const merchantData = await getMerchantsDao({
      user_id: settlementData.user_id,
    });
    const isMerchant = merchantData.length > 0;

    payload.status = Status.REVERSED;
    payload.rejected_at = new Date();

    let updatedCalculation;

    if (isMerchant) {
      // Merchant reversal
      updatedCalculation = createCalculationUpdate(
        settlementData,
        payload,
        0,
        true,
      );
    } else {
      // Vendor reversal
      const isInternalMethod = INTERNAL_METHODS.includes(settlementData.method);

      if (isInternalMethod) {
        updatedCalculation = await handleInternalTransferReversal(
          settlementData,
          payload,
        );
      } else {
        updatedCalculation = createCalculationUpdate(
          settlementData,
          payload,
          0,
          true,
        );
        // Update beneficiary account for vendor bank transactions
        await updateBeneficiaryAccount(settlementData, payload, true, conn);
      }
    }

    // Update calculation balance
    if (calculationData.length > 0) {
      const { id } = calculationData[0];
      const updatedCalculationResponse = await updateCalculationBalanceDao(
        { id },
        updatedCalculation,
        conn,
      );

      await trackVendorsNetBalance(
        calculationData[0].user_id,
        updatedCalculationResponse,
      );
    }
  }

  // Validate status transitions
  if (payload.status) {
    validateStatusTransition(settlementData.status, payload.status);
  }

  // Update settlement
  const updateData = await updateSettlementDao(
    { id: ids.id, company_id: ids.company_id },
    payload,
    conn,
  );

  // Emit socket event for updated settlement
  const settlementResponseObj = {
    id: updateData.id,
    sno: updateData.sno || null,
    user_id: updateData.user_id || null,
    status: updateData.status || null,
    amount: updateData.amount || 0,
    method: updateData.method || null,
    config: updateData.config || {},
    approved_at: updateData.approved_at || null,
    rejected_at: updateData.rejected_at || null,
    created_by: updateData.created_by || '',
    updated_by: updateData.updated_by || '',
    created_at: updateData.created_at,
    updated_at: updateData.updated_at,
    code: updateData.code || null,
  };
  setImmediate(() => {
    newTableEntry(tableName.SETTLEMENT, settlementResponseObj).catch((err) =>
      logger.error('Socket emit failed for settlement update:', err),
    );
  });

  // Update calculation config for success/reversed status
  if (
    (payload.status === Status.SUCCESS || payload.status === Status.REVERSED) &&
    calculationData.length > 0
  ) {
    const isReversed = payload.status === Status.REVERSED;
    let config;

    // Handle internal methods
    if (INTERNAL_METHODS.includes(payload.method)) {
      config = calculateSettlementConfigAmount(
        payload.method,
        calculationData[0].config,
        payload.amount,
        isReversed,
      );
    }
    // Handle transfer methods
    else if (TRANSFER_METHODS.includes(payload.method)) {
      config = calculateTransferMethodConfig(
        payload.method,
        payload.config.debit_credit,
        calculationData[0].config,
        payload.amount,
        isReversed,
      );
    }

    if (config) {
      await updateCalculationConfigDao(
        { id: calculationData[0].id },
        { config },
        conn,
      );
    }
  }

  return updateData;
};

const updateSettlementService = async (ids, payload) => {
  let conn;
  let committed = false;
  try {
    conn = await getConnection();
    await beginTransaction(conn);
    const updateData = await _updateSettlementServiceInternal(
      ids,
      payload,
      conn,
    );
    await commit(conn);
    committed = true;
    return updateData;
  } catch (error) {
    if (conn && !committed) await rollback(conn);
    logger.error('Error while updating Settlement', error);
    throw error;
  } finally {
    if (conn) conn.release();
  }
};

const deleteSettlementService = async (ids) => {
  let conn;
  let committed = false;
  try {
    conn = await getConnection();
    await beginTransaction(conn);

    const updatedData = await deleteSettlementDao(
      { id: ids.id, company_id: ids.company_id },
      { is_obsolete: true, updated_by: ids.user_id },
      conn,
    );

    await commit(conn);
    committed = true;
    return updatedData;
  } catch (error) {
    if (conn && !committed) await rollback(conn);
    logger.error('error getting while deleting settlement', error);
    throw error;
  } finally {
    if (conn) conn.release();
  }
};

export {
  getSettlementService,
  createSettlementService,
  getSettlementServiceById,
  updateSettlementService,
  deleteSettlementService,
  getSettlementsBySearchService,
};
