import { BadRequestError, InternalServerError } from '../../utils/appErrors.js';
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
import { getUserHierarchysDao } from '../userHierarchy/userHierarchyDao.js';

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

const getSettlementService = async (ids, filters, page, limit, sortBy, sortOrder, role, user_id) => {
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

    if(role == Role.MERCHANT){
      filters.user_id = [user_id]
    }
    if (role == Role.VENDOR) {
      filters.user_id = [user_id]
    }
    if (role === Role.MERCHANT) {
      const userHierarchys = await getUserHierarchysDao({ user_id });
      if (userHierarchys || userHierarchys.length > 0) {
        const userHierarchy = userHierarchys[0];

        if (
          userHierarchy?.config ||
          Array.isArray(userHierarchy?.config?.siblings?.sub_merchants)
        ) {
          filters.user_id = [...filters.user_id, ...(userHierarchy?.config?.siblings?.sub_merchants ?? [])];
        }
      }
    }
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
    logger.error('Error while fetching chargeback by search', error);
    throw new InternalServerError(error.message);
  }
};

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
    payload.config = payload.config || {};
    const data = await getSettlementDao(
      {
        id: ids.id,
        company_id: ids.company_id,
      },
      null,
      null,
      null,
      null
    );
    const calculationData = await getCalculationforCronDao(data[0].user_table_id);
    const {
      id,
      total_settlement_count,
      total_settlement_amount,
      current_balance,
      net_balance
    } = calculationData[0];

    if (payload.config.reference_id) {
      payload.status = 'SUCCESS';
      if (!data) {
        throw new InternalServerError('no data found');
      }
      let updatedCalculation;
      const merchant_data = await getMerchantsDao(
        { user_id: data[0].user_table_id })
      if (merchant_data.length > 0) {
        if (Array.isArray(calculationData) && calculationData.length > 0) {

          const amount = payload?.amount || 0;
          updatedCalculation = {
            total_settlement_count: total_settlement_count + 1,
            total_settlement_amount: total_settlement_amount + amount,
            current_balance: current_balance - amount,
            net_balance: net_balance - amount,
          };
        }
      } else {
        if (Array.isArray(calculationData) && calculationData.length > 0) {
          const amount = payload?.amount || 0;
          updatedCalculation = {
            total_settlement_count: total_settlement_count + 1,
            total_settlement_amount: total_settlement_amount + amount,
            current_balance: current_balance + amount,
            net_balance: net_balance + amount,
          };
        }
      }

      await updateCalculationDao({ id }, updatedCalculation, conn);

      const merchantData = await getMerchantsDao(
        { user_id: data[0].user_table_id },
        null,
        null,
        null,
        null
      );

      if (data[0].role === Role.VENDOR) {
        const bankData = await getBankaccountDao(
          { user_id: data[0].user_table_id },
          null,
          null,
          role
        );

        if (bankData.length > 0) {
          const bankAcc = bankData[0].balance - payload?.amount;
          await updateBankaccountDao(
            { id: bankData[0].id },
            { balance: bankAcc },
            conn
          );
        } else {
          console.error('No data in bank accounts');
        }
      } else if (data[0].role === Role.MERCHANT) {
        const merchantAcc = merchantData[0].balance - payload?.amount;
        await updateMerchantDao(
          { id: merchantData[0].id },
          { balance: merchantAcc },
          conn
        );
      }
    }

    if (payload.config.rejected_reason) {
      payload.status = 'REJECTED';
    }

    if (payload.status === 'INITIATED') {
      const merchant_data = await getMerchantsDao(
        { user_id: data[0].user_table_id })
      if (merchant_data.length > 0) {
        payload.config.reference_id = '';
        payload.config.rejected_reason = '';
        let updatedCalculation
        const {
          total_settlement_count,
          total_settlement_amount,
          current_balance,
          net_balance
        } = calculationData[0];

        const amount = payload?.amount || 0;

        updatedCalculation = {
          total_settlement_count: total_settlement_count + 1,
          total_settlement_amount: total_settlement_amount + amount,
          current_balance: current_balance + amount,
          net_balance: net_balance + amount,
        };
        await updateCalculationDao({ id }, updatedCalculation, conn);

      } else {
        payload.config.reference_id = '';
        payload.config.rejected_reason = '';
        let updatedCalculation
        const {
          total_settlement_count,
          total_settlement_amount,
          current_balance,
          net_balance
        } = calculationData[0];

        const amount = payload?.amount || 0;

        updatedCalculation = {
          total_settlement_count: total_settlement_count + 1,
          total_settlement_amount: total_settlement_amount + amount,
          current_balance: current_balance - amount,
          net_balance: net_balance - amount,
        };
        await updateCalculationDao({ id }, updatedCalculation, conn);
      }
    }
    const updateData = await updateSettlementDao(
      conn,
      { id: ids.id, company_id: ids.company_id },
      payload
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
