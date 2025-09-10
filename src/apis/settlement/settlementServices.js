import {
  BadRequestError,
  InternalServerError,
  NotFoundError,
} from '../../utils/appErrors.js';
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
  updateBeneficiaryAccountDao,
} from '../beneficiaryAccounts/beneficiaryAccountDao.js';
import { newTableEntry } from '../../utils/sockets.js';
import { trackVendorsNetBalance } from '../../utils/trackVendorsNetBalance.js';

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
      filters.user_id = [user_id];
    }
    if (role == Role.VENDOR && designation != Role.VENDOR_OPERATIONS) {
      filters.user_id = [user_id];
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
        const userHierarchys = await getUserHierarchysDao({ user_id });
        if (userHierarchys || userHierarchys.length > 0) {
          const userHierarchy = userHierarchys[0];
          if (userHierarchy?.config?.parent) {
            filters.user_id = [userHierarchy?.config?.parent ?? null];
          }
        }
      }
    } else if (role === Role.VENDOR) {
      if (designation === Role.VENDOR_OPERATIONS) {
        const userHierarchys = await getUserHierarchysDao({ user_id });
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
        const userHierarchys = await getUserHierarchysDao({ user_id });
        if (userHierarchys && userHierarchys.length > 0) {
          const userHierarchy = userHierarchys[0];
          if (userHierarchy?.config?.parent) {
            filters.user_id = [userHierarchy.config.parent];
          }
        }
      }
    }
    // Handle VENDOR role hierarchy
    else if (role === Role.VENDOR) {
      if (designation === Role.VENDOR_OPERATIONS) {
        const userHierarchys = await getUserHierarchysDao({ user_id });
        if (userHierarchys && userHierarchys.length > 0) {
          const userHierarchy = userHierarchys[0];
          if (userHierarchy?.config?.parent) {
            filters.user_id = [userHierarchy.config.parent];
          }
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

const createSettlementService = async (conn, payload, role) => {
  try {
    const isInternalTransfer =
      payload.method === 'INTERNAL_QR_TRANSFER' ||
      payload.method === 'INTERNAL_BANK_TRANSFER';

    // Early return for non-internal transfers without reference_id
    if (!isInternalTransfer || !payload.config?.reference_id) {
      return await createSettlementDao(payload, conn);
    }

    // Validate bank response for internal transfers
    const bankResponses = await getBankResponseByUTR(
      payload.config.reference_id,
    );
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
      return await handleVendorInternalTransferByAdmin(
        conn,
        payload,
        bankResponses,
      );
    }

    // Handle other roles internal transfers
    return await handleVendorInternalTransfer(payload);
  } catch (error) {
    logger.error('Error while creating Settlement', error);
    throw new InternalServerError(
      error.message || 'Failed to create settlement',
    );
  }
};

// Helper function for internal transfers from admin
const handleVendorInternalTransferByAdmin = async (
  conn,
  payload,
  bankResponses,
) => {
  // Get vendor and calculation data
  const [vendorData, calculationData] = await Promise.all([
    getVendorsDao({ user_id: payload.user_id }),
    getCalculationforCronDao(payload.user_id),
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
  
  await trackVendorsNetBalance(calculationData[0].user_id, conn, calculationResponse);

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

  return await createSettlementDao(payload, conn);
};

// Helper function for internal transfers from vendors
const handleVendorInternalTransfer = async (payload) => {
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

  return await createSettlementDao(payload);
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
  conn,
  payload,
  settlementData,
  changeUTRStatus,
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

  const vendorCommission = vendorData[0].payin_commission || 0;
  return calculateCommission(payload.amount, vendorCommission);
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
  conn,
  settlementData,
  payload,
  isReversed = false,
) => {
  if (settlementData.role !== Role.VENDOR || settlementData.method !== 'BANK') {
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

  await updateBeneficiaryAccountDao(
    { id: beneficiaryAcc.id, company_id: settlementData.company_id },
    { config: beneficiaryUpdatedConfig },
    conn,
    false,
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
};

// Helper function to handle internal transfer reversal
const handleInternalTransferReversal = async (
  conn,
  settlementData,
  payload,
) => {
  const [vendorData, calculationData] = await Promise.all([
    getVendorsDao({ user_id: settlementData.user_id }),
    getCalculationforCronDao(settlementData.user_id),
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
  await newTableEntry(tableName.BANK_RESPONSE, responseObj);

  const commission = calculateCommission(
    payload.amount,
    vendorData[0].payin_commission || 0,
  );

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

const updateSettlementService = async (conn, ids, payload) => {
  try {
    await checkLockEdit(conn, ids.id);
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
      conn,
      payload,
      settlementData,
      changeUTRStatus,
    );

    // Get calculation data
    const calculationData = await getCalculationforCronDao(
      settlementData.user_id,
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
      const merchantData = await getMerchantsDao({
        user_id: settlementData.user_id,
      });
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
          } else {
            updatedCalculation = createCalculationUpdate(
              settlementData,
              payload,
            );
          }
        }

        // Update calculation balance
        const { id } = calculationData[0];
        const updatedCalculationData = await updateCalculationBalanceDao({ id }, updatedCalculation, conn);
        
        await trackVendorsNetBalance(calculationData[0].user_id, conn, updatedCalculationData);
      }

      // Update beneficiary account for vendor bank transactions
      await updateBeneficiaryAccount(conn, settlementData, payload);
    }

    // Handle reversal (status INITIATED)
    if (payload.status === Status.INITIATED) {
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
        const isInternalMethod = INTERNAL_METHODS.includes(
          settlementData.method,
        );

        if (isInternalMethod) {
          updatedCalculation = await handleInternalTransferReversal(
            conn,
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
          await updateBeneficiaryAccount(conn, settlementData, payload, true);
        }
      }

      // Update calculation balance
      if (calculationData.length > 0) {
        const { id } = calculationData[0];
        const updatedCalculationResponse = await updateCalculationBalanceDao({ id }, updatedCalculation, conn);
        
        await trackVendorsNetBalance(calculationData[0].user_id, conn, updatedCalculationResponse);
      }
    }

    // Validate status transitions
    if (payload.status) {
      validateStatusTransition(settlementData.status, payload.status);
    }

    // Update settlement
    const updateData = await updateSettlementDao(
      conn,
      { id: ids.id, company_id: ids.company_id },
      payload,
    );

    // Update calculation config for success/reversed status
    if (
      (payload.status === Status.SUCCESS ||
        payload.status === Status.REVERSED) &&
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
  } catch (error) {
    logger.error('Error while updating Settlement', error);
    throw error;
  }
};

const deleteSettlementService = async (conn, ids) => {
  try {
    const updatedData = await deleteSettlementDao(
      conn,
      { id: ids.id, company_id: ids.company_id },
      { is_obsolete: true, updated_by: ids.user_id },
    );
    return updatedData;
  } catch (error) {
    logger.error('error getting while deleting settlement', error);
    throw error;
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
