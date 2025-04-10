import {  BadRequestError, InternalServerError } from '../../utils/appErrors.js';
import {
  createSettlementDao,
  deleteSettlementDao,
  getSettlementDao,
  updateSettlementDao,
  getSettlementsBySearchDao
} from './settlementDao.js';
import {
  getCalculationforCronDao,
  updateCalculationDao,
} from '../calculation/calculationDao.js';
import {
  getMerchantsDao,
  updateMerchantDao,
} from '../merchants/merchantDao.js';
import { getVendorsDao } from '../vendors/vendorDao.js';
import {
  getBankaccountDao,
  updateBankaccountDao,
} from '../bankAccounts/bankaccountDao.js';
import {
  columns,
  merchantColumns,
  Role,
  vendorColumns,
} from '../../constants/index.js';
import { logger } from '../../utils/logger.js';

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
    console.error('error getting while  getting settlements', error);
    throw new InternalServerError(error);
  }
};

const getSettlementService = async (ids, filters, page, limit, sortBy, sortOrder) => {
  try {
    // Validate required parameters
    if (!ids?.company_id) {
      throw new BadRequestError('Company ID is required');
    }

    // Determine column selection based on role
    const filterColumns = (() => {
      switch (ids.role_name) {
        case Role.MERCHANT:
          return merchantColumns.SETTLEMENT;
        case Role.VENDOR:
          return vendorColumns.SETTLEMENT;
        default:
          return columns.SETTLEMENT;
      }
    })();

    // Prepare filter object, ensuring all properties are included
    const daoFilters = {
      company_id: ids.company_id,
      ...(ids.role_name && { role: ids.role_name }),
      ...filters
    };

    // Call DAO with validated parameters
    const settlementData = await getSettlementDao(
      daoFilters,
      page,
      limit,
      sortBy || 'sno',
      sortOrder || 'DESC',
      filterColumns
    );

    return settlementData;

  } catch (error) {
    // Handle and rethrow errors with appropriate context
    if (error instanceof BadRequestError) {
      throw error;
    }

    console.log(error)
    
    logger.error('Error in getSettlementService:', {
      error: error,
      ids,
      filters,
      page,
      limit
    });
    
    throw new InternalServerError('Failed to retrieve settlements: ' + error);
  }
};

const getSettlementsBySearchService = async (
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
        ? merchantColumns.SETTLEMENT
        : role === Role.VENDOR
          ? vendorColumns.SETTLEMENT
          : columns.SETTLEMENT;
    // TODO: add designation constants

    const data = await getSettlementsBySearchDao(
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

// const getSettlementServiceJoined = async (req) => {
//   try {
//     const settlementData = await settlementJoindao(
//       "Settlement",
//       [
//         { tableName: "BankAccount", id: "user_id" },
//       ],
//       req.query.page || 1,
//       req.query.pageSize || 10,
//       req.query.sortBy || "created_at",
//       req.query.sortOrder || "DESC"
//     );

//     if (!settlementData || settlementData.length === 0) {
//       throw new BadRequestError('Error getting settlements');
//     }

//     return settlementData

//   } catch (error) {
//     console.error('Error getting settlements:', error);
//     throw new BadRequestError('Error getting settlements');
//   }
// }

const createSettlementService = async (payload) => {
  try {
    const data = await createSettlementDao(payload);
    return data;
  } catch (error) {
    console.log('Error while creating Settlement', 'error', error);
    throw new InternalServerError(error);
  }
};

const updateSettlementService = async (conn, ids, payload, role) => {
  try {
    if (payload.config.reference_id) {
      payload.status = 'SUCCESS';
      const data = await getSettlementDao({
        id: ids.id,
        company_id: ids.company_id,
      },null ,null,null,null);
      if (!data) {
        throw new InternalServerError('no data found');
      }
      const calculationData = await getCalculationforCronDao(data[0].user_id);
      if (calculationData.length>0) {
      let count = calculationData[0].total_settlement_count + 1;
      let amountCalculation =
        calculationData[0].total_settlement_amount + payload?.amount;
      let calculationId = calculationData[0].id;
      let currentBalance = calculationData[0].current_balance + payload?.amount;
      let netBalance = calculationData[0].net_balance + payload?.amount;
        //  const updatedCalculations =
        await updateCalculationDao(
          { id: calculationId },
          {
            total_settlement_count: count,
            total_settlement_amount: amountCalculation,
            current_balance: currentBalance,
            net_balance: netBalance,
          },
          conn
        );
      } else {
        console.log('no data in calculation');
      }
      const vendorData = await getVendorsDao(
        { user_id: data[0].user_id },
         null, null, null, null
      );
      const merchantData = await getMerchantsDao(
        { user_id: data[0].user_id },
         null, null, null, null
      );
      if (vendorData) {
        const bankData = await getBankaccountDao(
          { user_id: vendorData.user_id },null,null, role
        );
        if (bankData) {
          const bankId = bankData.id;
          const bankAcc = bankData.balance - payload?.amount;
          await updateBankaccountDao(
            { id: bankId },
            { balance: bankAcc },
            conn,
          );
        } else {
          console.error('No data in bank accounts');
        }
      } else if (merchantData) {
        const merchantAcc = merchantData.balance - payload?.amount;
        await updateMerchantDao({id: merchantData.id, balance: merchantAcc }, conn);
      }
    }
    if (payload.config.rejected_reason) {
      payload.status = 'REJECTED';
    }
    if (payload.status == 'INITIATED') {
      payload.config.reference_id = '';
      payload.config.rejected_reason = '';
    }
    const updateData = await updateSettlementDao(
      conn,
      { id: ids.id, company_id: ids.company_id },
      payload,
    );
    return updateData;
  } catch (error) {
    console.log('Error while updating Settlement', 'error', error);
    throw new InternalServerError(error);
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
    console.error('error getting while deleting settlement', error);
    throw new InternalServerError(error);
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
