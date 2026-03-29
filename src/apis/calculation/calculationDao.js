import {
  executeQuery,
  buildSelectQuery,
  buildInsertQuery,
  buildUpdateQuery,
  buildAndExecuteUpdateQuery,
  buildJoinQuery,
} from '../../utils/db.js';
import { Role, Status, tableName } from '../../constants/index.js';
import { getUserHierarchysDao } from '../userHierarchy/userHierarchyDao.js';
import { BadRequestError, NotFoundError } from '../../utils/appErrors.js';
import dayjs from 'dayjs';
import { logger } from '../../utils/logger.js';
import config from '../../config/config.js';

const IST = 'Asia/Kolkata';

const getCalculationDao = async (
  filters,
  page,
  pageSize,
  sortBy,
  sortOrder,
  columns = [],
  conn = null,
) => {
  try {
    // if simple user is querying then filter object must have user_id to bind result
    let baseQuery = `SELECT ${columns.length ? columns.join(', ') : '*'} FROM "${tableName.CALCULATION}" WHERE 1=1`;
    const {
      role,
      designation,
      startDate,
      endDate,
      sDate,
      eDate,
      includeSubVendors,
      includeSubMerchant,
      user_id,
    } = filters;
    let users = filters.users || '';
    delete filters.designation;
    delete filters.users;
    delete filters.role;
    delete filters.startDate;
    delete filters.endDate;
    delete filters.sDate;
    delete filters.eDate;
    users = users.split(',');

    // scenarios for super admin
    if (role && role === Role.SUPER_ADMIN) {
      delete filters.company_id;
      delete filters.user_id;
    }

    // scenarios for admin
    if (role && role === Role.ADMIN) {
      // filter object must have company_id to bind the result
      delete filters.user_id;
    }

    // scenarios for merchant admin, vendor admin
    if (
      role &&
      designation &&
      [Role.MERCHANT_ADMIN, Role.VENDOR_ADMIN].includes(designation) &&
      (includeSubMerchant || includeSubVendors)
    ) {
      delete filters.user_id;
      const roleToMatch =
        role === Role.MERCHANT_ADMIN ? Role.MERCHANT : Role.VENDOR;

      baseQuery = buildJoinQuery(
        tableName.CALCULATION,
        columns.length ? columns : '*',
        [
          {
            table: tableName.USER,
            keys: ['user_id', 'id'],
            columns: ['role_id'],
          },
          {
            table: tableName.ROLE,
            keys: ['role_id', 'id'],
            columns: ['role'],
            referenceTable: tableName.USER,
          },
        ],
      );

      baseQuery += ` AND "${tableName.ROLE}".role = '${roleToMatch}'`;

      if (includeSubMerchant || includeSubVendors || users.length) {
        const heirarchy = await getUserHierarchysDao({ user_id });
        if (!heirarchy) {
          throw new NotFoundError('Sub Merchants not found!');
        }
        const heirarchyUsers = heirarchy.config[user_id] || [];
        if (heirarchyUsers.length && users.length) {
          // fetch user heirarchy
          let userIds = [];
          for (const user of users) {
            if (heirarchyUsers.includes(user)) {
              userIds.push(user);
            }
          }

          if (userIds.length) {
            filters.user_id = userIds;
          }
        }
      }
    }

    if (startDate && endDate) {
      baseQuery += ` AND created_at BETWEEN '${new Date(startDate).toISOString()}'::TIMESTAMPTZ AND '${new Date(endDate).toISOString()}'::TIMESTAMPTZ`;
    }

    if (sDate && eDate) {
      baseQuery += ` AND created_at BETWEEN '${new Date(sDate).toISOString()}'::TIMESTAMPTZ AND '${new Date(eDate).toISOString()}'::TIMESTAMPTZ`;
    }

    const [sql, queryParams] = buildSelectQuery(
      baseQuery,
      filters,
      page,
      pageSize,
      sortBy,
      sortOrder,
      tableName.CALCULATION,
    );
    // Execute query
    const result = await executeQuery(sql, queryParams, conn);
    return result.rows;
  } catch (error) {
    logger.error('Error fetching Calculation', error);
    throw error;
  }
};
export const getCalculationDashBoardReportDao = async (
  filters = {},
  conn = null,
) => {
  try {
    const selectColumns = `
      total_payin_amount,
      total_payin_count,
      total_payout_amount,
      total_payout_count
    `;
    const { user_id, company_id, sDate, eDate } = filters;
    if (!user_id || !company_id || !sDate || !eDate) {
      throw new BadRequestError(
        'user_id, company_id, sDate, and eDate are required',
      );
    }
    let baseQuery = `SELECT ${selectColumns} FROM "${tableName.CALCULATION}" WHERE 1=1`;
    const queryFilters = { user_id, company_id };
    baseQuery += ` AND created_at BETWEEN '${new Date(sDate).toISOString()}'::TIMESTAMPTZ AND '${new Date(eDate).toISOString()}'::TIMESTAMPTZ`;
    const [sql, params] = buildSelectQuery(baseQuery, queryFilters);
    const result = await executeQuery(sql, params, conn);
    return result.rows || [];
  } catch (error) {
    logger.error('Error getting calculation data:', error);
    throw error;
  }
};
export const getCalculationByDateAndUserDao = async (date, conn = null) => {
  if (!date) {
    throw new Error('date are required');
  }
  const parsedDate = new Date(date);
  if (isNaN(parsedDate.getTime())) {
    throw new Error('Invalid date format. Use YYYY-MM-DD');
  }
  const isoDate = parsedDate.toISOString().split('T')[0];
  try {
    const sql = `
      SELECT
        id,
        user_id,
        role_id,
        company_id,
        current_balance,
        net_balance,
        created_at
      FROM "${tableName.CALCULATION}"
      WHERE created_at::DATE = $1   
    `;
    const params = [isoDate];
    const result = await executeQuery(sql, params, conn);
    return result.rows || null;
  } catch (error) {
    logger.error(
      `Error in getCalculationByDateAndUserDao for  date ${date}:`,
      error,
    );
    throw error;
  }
};
export const updateTodayNetBalanceDao = async (
  Id,
  net_balance,
  conn = null,
) => {
  try {
    const sql = `
      UPDATE "${tableName.CALCULATION}"
      SET net_balance = $2 + current_balance
      WHERE id = $1 
    `;
    const params = [Id, net_balance];
    const result = await executeQuery(sql, params, conn);
    return result.rows[0] || null;
  } catch (error) {
    logger.error(`Failed to update net_balance for user ${Id}:`, error.message);
    throw error;
  }
};

export const getCalculationsSumDao = async (filters, conn) => {
  try {
    const {
      role,
      designation,
      startDate: start,
      endDate: end,
      user_id,
      users,
      company_id,
    } = filters;
    const startDate = start
      ? dayjs(start).tz(IST).startOf('day').toISOString()
      : dayjs().tz(IST).startOf('day').toISOString();

    const endDate = end
      ? dayjs(end).tz(IST).endOf('day').toISOString()
      : dayjs().tz(IST).endOf('day').toISOString();
    let vendorData = {},
      merchantData = {},
      netBalance = {};
    let hierarchyUsers = [];
    // Fix the userCodes array creation
    let userCodes = [];
    if (users) {
      userCodes = users.split(/\s*,\s*/).filter((id) => id.trim());
    }
    let effectiveUserId = user_id;

    // Cache for user hierarchies to avoid repeated database calls
    const hierarchyCache = new Map();

    // Helper function to get hierarchy with caching - reuses connection
    const getCachedHierarchy = async (userId) => {
      if (!userId) return null;
      if (!hierarchyCache.has(userId)) {
        const hierarchy = await getUserHierarchysDao({ user_id: userId }, null, null, null, null, null, conn);
        hierarchyCache.set(userId, hierarchy);
      }
      return hierarchyCache.get(userId);
    };
    
    // Helper to batch process promises with concurrency limit
    const batchProcess = async (items, batchSize, processFn) => {
      const results = [];
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map(processFn));
        results.push(...batchResults);
      }
      return results;
    };

    if (
      designation === Role.MERCHANT_OPERATIONS ||
      designation === Role.VENDOR_OPERATIONS
    ) {
      const hierarchy = await getCachedHierarchy(user_id);
      const parentId = hierarchy?.[0]?.config?.parent;
      if (parentId) {
        effectiveUserId = parentId;
      }
    }

    const groupBy = ` GROUP BY DATE_TRUNC('day', c.created_at) ORDER BY DATE_TRUNC('day', c.created_at)DESC;`;

    // Modified Base Query with numeric casting
    let baseQuery = `
      SELECT 
          (DATE_TRUNC('day', c.created_at)) AS date,
          CAST(SUM(c.total_payin_count) AS INTEGER) AS total_payin_count,
          CAST(ROUND(SUM(c.total_payin_amount)::NUMERIC, 2) AS FLOAT) AS total_payin_amount,
          CAST(ROUND(SUM(c.total_payin_commission)::NUMERIC, 2) AS FLOAT) AS total_payin_commission,
          CAST(SUM(c.total_payout_count) AS INTEGER) AS total_payout_count,
          CAST(ROUND(SUM(c.total_payout_amount)::NUMERIC, 2) AS FLOAT) AS total_payout_amount,
          CAST(ROUND(SUM(c.total_payout_commission)::NUMERIC, 2) AS FLOAT) AS total_payout_commission,
          CAST(SUM(c.total_settlement_count) AS INTEGER) AS total_settlement_count,
          CAST(ROUND(SUM(c.total_settlement_amount)::NUMERIC, 2) AS FLOAT) AS total_settlement_amount,
          CAST(ROUND(SUM(c.total_settlement_commission)::NUMERIC, 2) AS FLOAT) AS total_settlement_commission,
          CAST(SUM(c.total_chargeback_count) AS INTEGER) AS total_chargeback_count,
          CAST(ROUND(SUM(c.total_chargeback_amount)::NUMERIC, 2) AS FLOAT) AS total_chargeback_amount,
          CAST(SUM(c.total_reverse_payout_count) AS INTEGER) AS total_reverse_payout_count,
          CAST(ROUND(SUM(c.total_reverse_payout_amount)::NUMERIC, 2) AS FLOAT) AS total_reverse_payout_amount,
          CAST(ROUND(SUM(c.total_reverse_payout_commission)::NUMERIC, 2) AS FLOAT) AS total_reverse_payout_commission,
          CAST(SUM(c.total_adjustment_count) AS INTEGER) AS total_adjustment_count,
          CAST(ROUND(SUM(c.total_adjustment_amount)::NUMERIC, 2) AS FLOAT) AS total_adjustment_amount,
          CAST(ROUND(SUM(c.total_adjustment_commission)::NUMERIC, 2) AS FLOAT) AS total_adjustment_commission,
          CAST(ROUND(SUM(c.current_balance)::NUMERIC, 2) AS FLOAT) AS current_balance,
          CAST(ROUND(SUM(c.net_balance)::NUMERIC, 2) AS FLOAT) AS net_balance
      FROM "${tableName.CALCULATION}" c
      JOIN "${tableName.USER}" u ON c.user_id = u.id AND u.is_obsolete = FALSE
      JOIN "${tableName.ROLE}" r ON u.role_id = r.id
    `;

    // Queries for Different Roles
    let merchantQuery = `${baseQuery} 
      JOIN "${tableName.MERCHANT}" m ON m.user_id = c.user_id
      WHERE c.is_obsolete = FALSE 
      AND m.is_enabled = TRUE
      AND c.created_at BETWEEN '${startDate}' AND '${endDate}'
      AND r.role = 'MERCHANT' `;
    let vendorQuery = `${baseQuery} 
      JOIN "${tableName.VENDOR}" v ON v.user_id = c.user_id
      WHERE c.is_obsolete = FALSE 
      AND c.created_at BETWEEN '${startDate}' AND '${endDate}'
      AND r.role = 'VENDOR' `;

    // Include hierarchy filtering (match against `code` column)
    if (hierarchyUsers.length) {
      merchantQuery += `
        AND EXISTS (
          SELECT 1 FROM merchant m
          WHERE m.user_id = ANY(ARRAY[${hierarchyUsers.map((el) => `'${el}'`)}])
        )`;

      vendorQuery += `
        AND EXISTS (
          SELECT 1 FROM vendor v
          WHERE v.user_id = ANY(ARRAY[${hierarchyUsers.map((el) => `'${el}'`)}])
        )`;
    }

    // Modified user code condition for merchant and vendor queries

    // Admin Query
    if (Role.ADMIN === role) {
      if (userCodes.length > 0) {
        const hierarchies = await batchProcess(userCodes, 5, getCachedHierarchy);
        
        let userIds = [];
        let vendorUserIds = [];
        
        hierarchies.forEach((userHierarchys, index) => {
          const userCode = userCodes[index];
          if (userCode && userHierarchys) {
            const allowedSubmerchants =
              userHierarchys?.[0]?.config?.siblings?.sub_merchants || [];
            userIds.push(userCode);
            userIds.push(...allowedSubmerchants);
            vendorUserIds.push(userCode);
          }
        });
        
        userIds = [...new Set(userIds)];
        vendorUserIds = [...new Set(vendorUserIds)];
        const userCodeParams = userIds.map((code) => `'${code}'`).join(',');
        const vendorCodeParams = vendorUserIds
          .map((code) => `'${code}'`)
          .join(',');
        merchantQuery += ` AND m.user_id = ANY(ARRAY[${userCodeParams}]) `;
        vendorQuery += ` AND v.user_id = ANY(ARRAY[${vendorCodeParams}]) `;
      }
      const vQuery = `${vendorQuery}  AND c.company_id = '${company_id}' AND u.company_id = '${company_id}' ${groupBy}`;
      const mQuery = `${merchantQuery}  AND c.company_id = '${company_id}' AND u.company_id = '${company_id}' ${groupBy}`;
      
      [merchantData, vendorData] = await Promise.all([
        executeQuery(mQuery, [], conn).then(result => result.rows),
        executeQuery(vQuery, [], conn).then(result => result.rows)
      ]);
    }

    // Super Admin Query
    if (Role.SUPER_ADMIN === role) {
      [merchantData, vendorData] = await Promise.all([
        executeQuery(`${merchantQuery}  ${groupBy}`, [], conn).then(result => result.rows),
        executeQuery(`${vendorQuery}  ${groupBy}`, [], conn).then(result => result.rows)
      ]);
    }

    // query for merchant only role
    if (role === Role.MERCHANT) {
      const userHierarchys = await getCachedHierarchy(effectiveUserId);
      let userIds = [effectiveUserId];

      if (userCodes?.length > 0) {
        // Get allowed submerchant IDs from hierarchy
        const allowedSubmerchants =
          userHierarchys?.[0]?.config?.siblings?.sub_merchants || [];
        // Only include valid submerchant IDs
        const validUserIds = userCodes.filter((id) =>
          allowedSubmerchants.includes(id),
        );
        userIds = [...userCodes, ...validUserIds]; // Include both merchant and valid submerchant IDs
      }

      // Create the query with proper type casting for array elements
      const mQuery = `${merchantQuery} 
        AND c.user_id = ANY(ARRAY[${userIds.map((id) => `'${id}'::text`).join(',')}])
        AND c.company_id = $1
        ${groupBy}`;

      merchantData = (
        await executeQuery(mQuery, [company_id], conn)
      ).rows;
    }

    // query for vendor only role
    if (role === Role.VENDOR) {
      const userHierarchys = await getCachedHierarchy(effectiveUserId);
      let userIds = [effectiveUserId];
      const subVendors =
        userHierarchys?.[0]?.config?.siblings?.sub_vendors || [];
      if (subVendors.length > 0) {
        userIds = [...new Set([...userIds, ...subVendors])];
      }
      if (userCodes?.length > 0) {
        userIds = [
          ...new Set([
            ...userCodes,
          ]),
        ];
      }

      const userIdParams = userIds.map((_, index) => `$${index + 1}`).join(',');
      const vQuery = `${vendorQuery}  AND c.user_id = ANY(ARRAY[${userIdParams}])  AND c.company_id = $${userIds.length + 1}  ${groupBy}`;
      vendorData = (
        await executeQuery(vQuery, [...userIds, company_id], conn)
      ).rows;
    }

    if ([Role.SUPER_ADMIN, Role.ADMIN].includes(role)) {
      const condition =
        role === Role.ADMIN ? ` AND c.company_id = '${company_id}' ` : '';
      // If userCodes are provided, filter by them
      let userIds = [];

      // Process each userCode if provided
      if (userCodes?.length > 0) {
        for (const userCode of userCodes) {
          if (userCode) {
            const userHierarchies = await getCachedHierarchy(userCode);
            const allowedSubMerchants =
              userHierarchies?.[0]?.config?.siblings?.sub_merchants || [];
            userIds = [
              ...new Set([
                ...userCodes,
                ...allowedSubMerchants,
              ]),
            ];
          }
        }
      }
      const baseCalQuery = `
        WITH LatestBalances AS (
          SELECT DISTINCT ON (c.user_id)
            c.user_id,
            c.company_id,
            c.net_balance,
            r.role
          FROM "${tableName.CALCULATION}" c
          INNER JOIN "${tableName.USER}" u ON c.user_id = u.id
          INNER JOIN "${tableName.ROLE}" r ON u.role_id = r.id 
          WHERE c.is_obsolete = FALSE
          AND u.is_obsolete = FALSE
          ${condition}
          ${userIds.length > 0 ? `AND c.user_id = ANY(ARRAY[${userIds.map((id) => `'${id}'`).join(',')}])` : ''}
          AND c.created_at BETWEEN '${startDate}' AND '${endDate}'
          ORDER BY c.user_id, c.created_at DESC
        )
        SELECT 
          role,
          company_id,
          CAST(ROUND(SUM(net_balance)::NUMERIC, 2) AS FLOAT) as net_balance_sum
        FROM LatestBalances 
        GROUP BY role, company_id`;

      const balanceResult = await executeQuery(baseCalQuery, [], conn);

      netBalance = balanceResult.rows.reduce(
        (acc, row) => {
          if (
            row.role === Role.VENDOR &&
            (!company_id || row.company_id === company_id)
          ) {
            acc.vendor = row.net_balance_sum || 0;
          } else if (
            row.role === Role.MERCHANT &&
            (!company_id || row.company_id === company_id)
          ) {
            acc.merchant = row.net_balance_sum || 0;
          }
          return acc;
        },
        { vendor: 0, merchant: 0 },
      );
    } else {
      const userHierarchys = await getCachedHierarchy(effectiveUserId);
      let userIds = [effectiveUserId];

      if (role === Role.MERCHANT) {
        const subMerchants =
          userHierarchys?.[0]?.config?.siblings?.sub_merchants || [];
        if (subMerchants.length > 0) {
          userIds = [...new Set([...userIds, ...subMerchants])];
        }
      }

      if (userCodes?.length > 0) {
        const allowedSubmerchants =
          userHierarchys?.[0]?.config?.siblings?.sub_merchants || [];

        const validUserIds = userCodes.filter(
          (id) => allowedSubmerchants.includes(id)
        );
        userIds = [...new Set([...userCodes, ...validUserIds])];
      }

      const endDateConditon = ` AND DATE(c.created_at) = '${endDate}' `;
      const calBaseQuery = `
        WITH LatestCalculations AS (
          SELECT DISTINCT ON (c.user_id) 
            c.user_id,
            c.net_balance
          FROM "${tableName.CALCULATION}" c
          JOIN "${tableName.USER}" u ON c.user_id = u.id AND u.is_obsolete = FALSE
          JOIN "${tableName.ROLE}" r ON u.role_id = r.id AND r.role = 'PLACE_ROLE_HERE'
          WHERE c.is_obsolete = FALSE 
          AND c.user_id = ANY(ARRAY[${userIds.map((id) => `'${id}'`).join(',')}])
          AND c.company_id = '${company_id}'
          ${endDateConditon}
          ORDER BY c.user_id, c.created_at DESC
        )
        SELECT COALESCE(SUM(net_balance), 0) as net_balance_sum
        FROM LatestCalculations`;

      let vendorCalQuery = calBaseQuery.replace('PLACE_ROLE_HERE', Role.VENDOR);
      let merchantCalQuery = calBaseQuery.replace(
        'PLACE_ROLE_HERE',
        Role.MERCHANT,
      );

      const [vendorBalance, merchantBalance] = await Promise.all([
        executeQuery(vendorCalQuery, [], conn).then(result => result.rows[0]?.net_balance_sum || 0),
        executeQuery(merchantCalQuery, [], conn).then(result => result.rows[0]?.net_balance_sum || 0)
      ]);
      
      netBalance.vendor = vendorBalance;
      netBalance.merchant = merchantBalance;
    }

    // Modify total calculations query for merchants based on role
    let merchantTotalQuery = `
      SELECT 
        CAST(SUM(c.total_payin_count) AS INTEGER) AS total_payin_count,
        CAST(ROUND(SUM(c.total_payin_amount)::NUMERIC, 2) AS FLOAT) AS total_payin_amount,
        CAST(ROUND(SUM(c.total_payin_commission)::NUMERIC, 2) AS FLOAT) AS total_payin_commission,
        CAST(SUM(c.total_payout_count) AS INTEGER) AS total_payout_count,
        CAST(ROUND(SUM(c.total_payout_amount)::NUMERIC, 2) AS FLOAT) AS total_payout_amount,
        CAST(ROUND(SUM(c.total_payout_commission)::NUMERIC, 2) AS FLOAT) AS total_payout_commission,
        CAST(SUM(c.total_settlement_count) AS INTEGER) AS total_settlement_count,
        CAST(ROUND(SUM(c.total_settlement_amount)::NUMERIC, 2) AS FLOAT) AS total_settlement_amount,
        CAST(ROUND(SUM(c.total_settlement_commission)::NUMERIC, 2) AS FLOAT) AS total_settlement_commission,
        CAST(SUM(c.total_chargeback_count) AS INTEGER) AS total_chargeback_count,
        CAST(ROUND(SUM(c.total_chargeback_amount)::NUMERIC, 2) AS FLOAT) AS total_chargeback_amount,
        CAST(SUM(c.total_reverse_payout_count) AS INTEGER) AS total_reverse_payout_count,
        CAST(ROUND(SUM(c.total_reverse_payout_amount)::NUMERIC, 2) AS FLOAT) AS total_reverse_payout_amount,
        CAST(ROUND(SUM(c.total_reverse_payout_commission)::NUMERIC, 2) AS FLOAT) AS total_reverse_payout_commission,
        CAST(SUM(c.total_adjustment_count) AS INTEGER) AS total_adjustment_count,
        CAST(ROUND(SUM(c.total_adjustment_amount)::NUMERIC, 2) AS FLOAT) AS total_adjustment_amount,
        CAST(ROUND(SUM(c.total_adjustment_commission)::NUMERIC, 2) AS FLOAT) AS total_adjustment_commission,
        CAST(ROUND(SUM(c.current_balance)::NUMERIC, 2) AS FLOAT) AS current_balance,
        CAST(ROUND(SUM(c.net_balance)::NUMERIC, 2) AS FLOAT) AS net_balance,
        CAST(ROUND(SUM(COALESCE((c.config->>'total_bankSettlement_amount')::NUMERIC, 0))::NUMERIC, 2) AS FLOAT) AS total_bankSettlement_amount,
        CAST(ROUND(SUM(COALESCE((c.config->>'total_aedSentSettlement_amount')::NUMERIC, 0))::NUMERIC, 2) AS FLOAT) AS total_aedSentSettlement_amount,
        CAST(ROUND(SUM(COALESCE((c.config->>'total_bankSentSettlement_amount')::NUMERIC, 0))::NUMERIC, 2) AS FLOAT) AS total_bankSentSettlement_amount,
        CAST(ROUND(SUM(COALESCE((c.config->>'total_cashSentSettlement_amount')::NUMERIC, 0))::NUMERIC, 2) AS FLOAT) AS total_cashSentSettlement_amount,
        CAST(ROUND(SUM(COALESCE((c.config->>'total_internalSettlement_amount')::NUMERIC, 0))::NUMERIC, 2) AS FLOAT) AS total_internalSettlement_amount,
        CAST(ROUND(SUM(COALESCE((c.config->>'total_cryptoSentSettlement_amount')::NUMERIC, 0))::NUMERIC, 2) AS FLOAT) AS total_cryptoSentSettlement_amount,
        CAST(ROUND(SUM(COALESCE((c.config->>'total_aedReceivedSettlement_amount')::NUMERIC, 0))::NUMERIC, 2) AS FLOAT) AS total_aedReceivedSettlement_amount,
        CAST(ROUND(SUM(COALESCE((c.config->>'total_bankReceivedSettlement_amount')::NUMERIC, 0))::NUMERIC, 2) AS FLOAT) AS total_bankReceivedSettlement_amount,
        CAST(ROUND(SUM(COALESCE((c.config->>'total_cashReceivedSettlement_amount')::NUMERIC, 0))::NUMERIC, 2) AS FLOAT) AS total_cashReceivedSettlement_amount,
        CAST(ROUND(SUM(COALESCE((c.config->>'total_internalBankSettlement_amount')::NUMERIC, 0))::NUMERIC, 2) AS FLOAT) AS total_internalBankSettlement_amount,
        CAST(ROUND(SUM(COALESCE((c.config->>'total_cryptoReceivedSettlement_amount')::NUMERIC, 0))::NUMERIC, 2) AS FLOAT) AS total_cryptoReceivedSettlement_amount
      FROM "${tableName.CALCULATION}" c
      JOIN "${tableName.USER}" u ON c.user_id = u.id AND u.is_obsolete = FALSE 
      JOIN "${tableName.ROLE}" r ON u.role_id = r.id
      JOIN "${tableName.MERCHANT}" m ON c.user_id = m.user_id
      WHERE c.created_at BETWEEN '${startDate}' AND '${endDate}'
      AND m.is_enabled = TRUE
      AND r.role = 'MERCHANT'
    `;

    // Add vendor total calculations query
    let vendorTotalQuery = `
     SELECT 
      CAST(SUM(c.total_payin_count) AS INTEGER) AS total_payin_count,
      CAST(ROUND(SUM(c.total_payin_amount)::NUMERIC, 2) AS FLOAT) AS total_payin_amount,
      CAST(ROUND(SUM(c.total_payin_commission)::NUMERIC,2)  AS FLOAT)   AS total_payin_commission,
  
      CAST(SUM(c.total_payout_count)               AS INTEGER) AS total_payout_count,
      CAST(ROUND(SUM(c.total_payout_amount)::NUMERIC,2)     AS FLOAT)   AS total_payout_amount,
      CAST(ROUND(SUM(c.total_payout_commission)::NUMERIC,2) AS FLOAT)   AS total_payout_commission,
  
      CAST(SUM(c.total_settlement_count)           AS INTEGER) AS total_settlement_count,
      CAST(ROUND(SUM(c.total_settlement_amount)::NUMERIC,2) AS FLOAT)   AS total_settlement_amount,
      CAST(ROUND(SUM(c.total_settlement_commission)::NUMERIC,2) AS FLOAT) AS total_settlement_commission,
  
      CAST(SUM(c.total_chargeback_count)           AS INTEGER) AS total_chargeback_count,
      CAST(ROUND(SUM(c.total_chargeback_amount)::NUMERIC,2) AS FLOAT)   AS total_chargeback_amount,
  
      CAST(SUM(c.total_reverse_payout_count)       AS INTEGER) AS total_reverse_payout_count,
      CAST(ROUND(SUM(c.total_reverse_payout_amount)::NUMERIC,2) AS FLOAT) AS total_reverse_payout_amount,
      CAST(ROUND(SUM(c.total_reverse_payout_commission)::NUMERIC,2) AS FLOAT) AS total_reverse_payout_commission,
  
      CAST(SUM(c.total_adjustment_count)           AS INTEGER) AS total_adjustment_count,
      CAST(ROUND(SUM(c.total_adjustment_amount)::NUMERIC,2) AS FLOAT)   AS total_adjustment_amount,
      CAST(ROUND(SUM(c.total_adjustment_commission)::NUMERIC,2) AS FLOAT) AS total_adjustment_commission,
  
      CAST(ROUND(SUM(c.current_balance)::NUMERIC,2) AS FLOAT) AS current_balance,
      CAST(ROUND(SUM(c.net_balance)::NUMERIC,2)     AS FLOAT) AS net_balance,
  
      CAST(ROUND(SUM(COALESCE((c.config->>'total_bankSettlement_amount')::NUMERIC,0))::NUMERIC,2) AS FLOAT) AS total_bankSettlement_amount,
      CAST(ROUND(SUM(COALESCE((c.config->>'total_aedSentSettlement_amount')::NUMERIC,0))::NUMERIC,2) AS FLOAT) AS total_aedSentSettlement_amount,
      CAST(ROUND(SUM(COALESCE((c.config->>'total_bankSentSettlement_amount')::NUMERIC,0))::NUMERIC,2) AS FLOAT) AS total_bankSentSettlement_amount,
      CAST(ROUND(SUM(COALESCE((c.config->>'total_cashSentSettlement_amount')::NUMERIC,0))::NUMERIC,2) AS FLOAT) AS total_cashSentSettlement_amount,
      CAST(ROUND(SUM(COALESCE((c.config->>'total_internalSettlement_amount')::NUMERIC,0))::NUMERIC,2) AS FLOAT) AS total_internalSettlement_amount,
      CAST(ROUND(SUM(COALESCE((c.config->>'total_cryptoSentSettlement_amount')::NUMERIC,0))::NUMERIC,2) AS FLOAT) AS total_cryptoSentSettlement_amount,
      CAST(ROUND(SUM(COALESCE((c.config->>'total_aedReceivedSettlement_amount')::NUMERIC,0))::NUMERIC,2) AS FLOAT) AS total_aedReceivedSettlement_amount,
      CAST(ROUND(SUM(COALESCE((c.config->>'total_bankReceivedSettlement_amount')::NUMERIC,0))::NUMERIC,2) AS FLOAT) AS total_bankReceivedSettlement_amount,
      CAST(ROUND(SUM(COALESCE((c.config->>'total_cashReceivedSettlement_amount')::NUMERIC,0))::NUMERIC,2) AS FLOAT) AS total_cashReceivedSettlement_amount,
      CAST(ROUND(SUM(COALESCE((c.config->>'total_internalBankSettlement_amount')::NUMERIC,0))::NUMERIC,2) AS FLOAT) AS total_internalBankSettlement_amount,
      CAST(ROUND(SUM(COALESCE((c.config->>'total_cryptoReceivedSettlement_amount')::NUMERIC,0))::NUMERIC,2) AS FLOAT) AS total_cryptoReceivedSettlement_amount,
  
      CAST(ROUND(
        SUM(CASE 
              WHEN '${role}' = 'ADMIN'  AND d.designation = 'SUB_VENDOR' THEN c.total_payin_commission
              WHEN '${role}' = 'VENDOR' AND d.designation = 'VENDOR'      THEN c.total_payin_commission
              ELSE 0
            END)::NUMERIC,2) AS FLOAT) AS vendor_payin_commission,
  
      CAST(ROUND(
        SUM(CASE 
              WHEN '${role}' = 'ADMIN'  AND d.designation = 'SUB_VENDOR' THEN c.total_payout_commission
              WHEN '${role}' = 'VENDOR' AND d.designation = 'VENDOR'      THEN c.total_payout_commission
              ELSE 0
            END)::NUMERIC,2) AS FLOAT) AS vendor_payout_commission,
  
      CAST(ROUND(
        SUM(CASE 
              WHEN '${role}' = 'ADMIN'  AND d.designation = 'SUB_VENDOR' THEN c.total_reverse_payout_commission
              WHEN '${role}' = 'VENDOR' AND d.designation = 'VENDOR'      THEN c.total_reverse_payout_commission
              ELSE 0
            END)::NUMERIC,2) AS FLOAT) AS vendor_reverse_payout_commission
  
  
    FROM "${tableName.CALCULATION}" AS c
    JOIN "${tableName.USER}"        AS u ON c.user_id = u.id AND u.is_obsolete = FALSE
    JOIN "${tableName.ROLE}"        AS r ON u.role_id = r.id
    JOIN "${tableName.VENDOR}"      AS v ON c.user_id = v.user_id
    LEFT JOIN "${tableName.DESIGNATION}" AS d ON u.designation_id = d.id
    WHERE c.created_at BETWEEN '${startDate}' AND '${endDate}'
      AND r.role = 'VENDOR'
  `;

    if (role === Role.MERCHANT) {
      const userHierarchys = await getCachedHierarchy(effectiveUserId);
      let userIds = [effectiveUserId];

      if (userCodes?.length > 0) {
        const allowedSubmerchants =
          userHierarchys?.[0]?.config?.siblings?.sub_merchants || [];
        const validUserIds = userCodes.filter((id) =>
          allowedSubmerchants.includes(id),
        );
        userIds = [...new Set([...userCodes, ...validUserIds])];
      }

      merchantTotalQuery += ` AND m.user_id = ANY(ARRAY['${userIds.join("','")}']) `;
      merchantTotalQuery += ` AND c.company_id = '${company_id}'`;
      vendorTotalQuery = null;
    } else if (role === Role.VENDOR) {
      let userIds = [effectiveUserId, ...userCodes];
      userIds = [...new Set(userIds)];

      vendorTotalQuery += ` AND c.user_id = ANY(ARRAY['${userIds.join("','")}']) `;
      vendorTotalQuery += ` AND c.company_id = '${company_id}'`;
      merchantTotalQuery = null;
    } else if (role === Role.SUB_VENDOR) {
      vendorTotalQuery += ` AND c.user_id = '${effectiveUserId}'`;
      vendorTotalQuery += ` AND c.company_id = '${company_id}'`;
      merchantTotalQuery = null;
    } else if (role === Role.ADMIN) {
      let userIds = [];

      if (userCodes?.length > 0) {
        const batchSize = 5;
        const hierarchies = [];
        for (let i = 0; i < userCodes.length; i += batchSize) {
          const batch = userCodes.slice(i, i + batchSize);
          const batchResults = await Promise.all(
            batch.map(userCode => getCachedHierarchy(userCode))
          );
          hierarchies.push(...batchResults);
        }
        
        hierarchies.forEach((userHierarchys, index) => {
          const userCode = userCodes[index];
          if (userCode && userHierarchys) {
            const allowedSubmerchants =
              userHierarchys?.[0]?.config?.siblings?.sub_merchants || [];
            userIds.push(userCode);
            userIds.push(...allowedSubmerchants);
          }
        });

        userIds = [...new Set(userIds)];

        if (userIds.length > 0) {
          const userIdsFormatted = userIds.map((id) => `'${id}'`).join(',');
          merchantTotalQuery += ` AND m.user_id = ANY(ARRAY[${userIdsFormatted}]) `;
          const uniqueVendorUserIds = [...new Set(userCodes)];
          if (uniqueVendorUserIds.length > 0) {
            vendorTotalQuery += ` AND v.user_id = ANY(ARRAY[${uniqueVendorUserIds.map((code) => `'${code}'`).join(',')}]) `;
          }
        }
      }

      merchantTotalQuery += ` AND c.company_id = '${company_id}'`;
      vendorTotalQuery += ` AND c.company_id = '${company_id}'`;
    }

    // Execute queries based on role
    const [merchantTotal, vendorTotal] = await Promise.all([
      merchantTotalQuery
        ? await executeQuery(merchantTotalQuery, [], conn)
        : Promise.resolve({ rows: [{}] }),
      vendorTotalQuery
        ? await executeQuery(vendorTotalQuery, [], conn)
        : Promise.resolve({ rows: [{}] }),
    ]);
    
    return {
      vendor: vendorData,
      merchant: merchantData,
      netBalance,
      merchantTotalCalculations: merchantTotal.rows[0] || {},
      vendorTotalCalculations: vendorTotal.rows[0] || {},
    };
  } catch (error) {
    logger.error('Error getting calculation data:', error);
    throw error;
  }
};

export const getCalculationsForInternalUseDao = async (
  filters,
  conn = null,
) => {
  try {
    const {
      role,
      designation,
      startDate: start,
      endDate: end,
      user_id,
      users,
      company_id,
    } = filters;

    const startDate = start
      ? dayjs(start).tz(IST).startOf('day').toISOString()
      : dayjs().tz(IST).startOf('day').toISOString();

    const endDate = end
      ? dayjs(end).tz(IST).endOf('day').toISOString()
      : dayjs().tz(IST).endOf('day').toISOString();
    let vendorData = {},
      merchantData = {},
      netBalance = {};
    let hierarchyUsers = [];

    // Fix the userCodes array creation
    let userCodes = [];
    if (users) {
      // Handle both comma-with-space and comma-only separators
      userCodes = users.split(/\s*,\s*/).filter((id) => id.trim());
      logger.info('Processed user codes:', userCodes);
    }

    let effectiveUserId = user_id;

    if (
      designation === Role.MERCHANT_OPERATIONS ||
      designation === Role.VENDOR_OPERATIONS
    ) {
      const hierarchy = await getUserHierarchysDao({ user_id }, null, null, null, null, null, conn);
      const parentId = hierarchy?.[0]?.config?.parent;
      if (parentId) {
        effectiveUserId = parentId;
        logger.info('Using parent merchant ID:', parentId);
      }
    }

    const groupBy = ` GROUP BY c.id, c.user_id, DATE_TRUNC('day', c.created_at) ORDER BY DATE_TRUNC('day', c.created_at)DESC;`;

    // Modified Base Query with numeric casting
    let baseQuery = `
      SELECT 
          c.id,
          c.user_id,
          (DATE_TRUNC('day', c.created_at)) AS date,
          CAST(SUM(c.total_payin_count) AS NUMERIC) AS total_payin_count,
          CAST(ROUND(SUM(c.total_payin_amount)::NUMERIC, 2) AS FLOAT) AS total_payin_amount,
          CAST(ROUND(SUM(c.total_payin_commission)::NUMERIC, 2) AS FLOAT) AS total_payin_commission,
          CAST(SUM(c.total_payout_count) AS NUMERIC) AS total_payout_count,
          CAST(ROUND(SUM(c.total_payout_amount)::NUMERIC, 2) AS FLOAT) AS total_payout_amount,
          CAST(ROUND(SUM(c.total_payout_commission)::NUMERIC, 2) AS FLOAT) AS total_payout_commission,
          CAST(SUM(c.total_settlement_count) AS NUMERIC) AS total_settlement_count,
          CAST(ROUND(SUM(c.total_settlement_amount)::NUMERIC, 2) AS FLOAT) AS total_settlement_amount,
          CAST(ROUND(SUM(c.total_settlement_commission)::NUMERIC, 2) AS FLOAT) AS total_settlement_commission,
          CAST(SUM(c.total_chargeback_count) AS NUMERIC) AS total_chargeback_count,
          CAST(ROUND(SUM(c.total_chargeback_amount)::NUMERIC, 2) AS FLOAT) AS total_chargeback_amount,
          CAST(SUM(c.total_reverse_payout_count) AS NUMERIC) AS total_reverse_payout_count,
          CAST(ROUND(SUM(c.total_reverse_payout_amount)::NUMERIC, 2) AS FLOAT) AS total_reverse_payout_amount,
          CAST(ROUND(SUM(c.total_reverse_payout_commission)::NUMERIC, 2) AS FLOAT) AS total_reverse_payout_commission,
          CAST(SUM(c.total_adjustment_count) AS NUMERIC) AS total_adjustment_count,
          CAST(ROUND(SUM(c.total_adjustment_amount)::NUMERIC, 2) AS FLOAT) AS total_adjustment_amount,
          CAST(ROUND(SUM(c.total_adjustment_commission)::NUMERIC, 2) AS FLOAT) AS total_adjustment_commission,
          CAST(ROUND(SUM(c.current_balance)::NUMERIC, 2) AS FLOAT) AS current_balance,
          CAST(ROUND(SUM(c.net_balance)::NUMERIC, 2) AS FLOAT) AS net_balance
      FROM "${tableName.CALCULATION}" c
      JOIN "${tableName.USER}" u ON c.user_id = u.id AND u.is_obsolete = FALSE
      JOIN "${tableName.ROLE}" r ON u.role_id = r.id
    `;

    // Queries for Different Roles
    let merchantQuery = `${baseQuery} 
      JOIN "${tableName.MERCHANT}" m ON m.user_id = c.user_id
      WHERE c.is_obsolete = FALSE 
      AND m.is_enabled = TRUE
      AND c.created_at BETWEEN '${startDate}' AND '${endDate}'
      AND r.role = 'MERCHANT' `;
    let vendorQuery = `${baseQuery} 
      JOIN "${tableName.VENDOR}" v ON v.user_id = c.user_id
      WHERE c.is_obsolete = FALSE 
      AND c.created_at BETWEEN '${startDate}' AND '${endDate}'
      AND r.role = 'VENDOR' `;

    // Include hierarchy filtering (match against `code` column)
    if (hierarchyUsers.length) {
      merchantQuery += `
        AND EXISTS (
          SELECT 1 FROM merchant m
          WHERE m.user_id = ANY(ARRAY[${hierarchyUsers.map((el) => `'${el}'`)}])
        )`;

      vendorQuery += `
        AND EXISTS (
          SELECT 1 FROM vendor v
          WHERE v.user_id = ANY(ARRAY[${hierarchyUsers.map((el) => `'${el}'`)}])
        )`;
    }

    // Modified user code condition for merchant and vendor queries

    // Admin Query
    if (Role.ADMIN === role) {
      if (userCodes.length > 0) {
        // Batch fetch hierarchies with limited concurrency to avoid connection pool exhaustion
        const batchSize = 5;
        const hierarchies = [];
        for (let i = 0; i < userCodes.length; i += batchSize) {
          const batch = userCodes.slice(i, i + batchSize);
          const batchResults = await Promise.all(
            batch.map(userCode => getUserHierarchysDao({ user_id: userCode }, null, null, null, null, null, conn))
          );
          hierarchies.push(...batchResults);
        }
        
        let userIds = [];
        let vendorUserIds = [];
        
        hierarchies.forEach((userHierarchys, index) => {
          const userCode = userCodes[index];
          if (userCode && userHierarchys) {
            const allowedSubmerchants =
              userHierarchys?.[0]?.config?.siblings?.sub_merchants || [];
            const allowedSubvendors =
              userHierarchys?.[0]?.config?.siblings?.sub_vendors || [];
            userIds.push(userCode);
            userIds.push(...allowedSubmerchants);
            vendorUserIds.push(userCode);
            vendorUserIds.push(...allowedSubvendors);
          }
        });
        // Remove any duplicates
        userIds = [...new Set(userIds)];
        vendorUserIds = [...new Set(vendorUserIds)];

        const userCodeParams = userIds.map((code) => `'${code}'`).join(',');
        const vendorCodeParams = vendorUserIds
          .map((code) => `'${code}'`)
          .join(',');
        merchantQuery += ` AND m.user_id = ANY(ARRAY[${userCodeParams}]) `;
        vendorQuery += ` AND v.user_id = ANY(ARRAY[${vendorCodeParams}]) `;
      }
      const vQuery = `${vendorQuery}  AND c.company_id = '${company_id}' AND u.company_id = '${company_id}' ${groupBy}`;
      const mQuery = `${merchantQuery}  AND c.company_id = '${company_id}' AND u.company_id = '${company_id}' ${groupBy}`;
      merchantData = (
        await executeQuery(mQuery, [], conn)
      ).rows;
      vendorData = (
        await executeQuery(vQuery, [], conn)
      ).rows;
    }

    // Super Admin Query
    if (Role.SUPER_ADMIN === role) {
      merchantData = (
        conn
          ? await conn.query(`${merchantQuery}  ${groupBy}`, [])
          : await executeQuery(`${merchantQuery}  ${groupBy}`, [], conn)
      ).rows;
      vendorData = (
        conn
          ? await conn.query(`${vendorQuery}  ${groupBy}`, [])
          : await executeQuery(`${vendorQuery}  ${groupBy}`, [], conn)
      ).rows;
    }

    // query for merchant only role
    if (role === Role.MERCHANT) {
      // Get user hierarchy to validate submerchant access
      const userHierarchys = await getUserHierarchysDao({
        user_id: effectiveUserId,
      }, null, null, null, null, null, conn);
      let userIds = [effectiveUserId]; // Always include merchant's own ID

      // Handle userCodes for merchant totals
      if (userCodes?.length > 0) {
        // Get allowed submerchant IDs from hierarchy
        const allowedSubmerchants =
          userHierarchys?.[0]?.config?.siblings?.sub_merchants || [];
        // Only include valid submerchant IDs
        const validUserIds = userCodes.filter((id) =>
          allowedSubmerchants.includes(id),
        );
        userIds = [...userCodes, ...validUserIds]; // Include both merchant and valid submerchant IDs
      }

      // Create the query with proper type casting for array elements
      const mQuery = `${merchantQuery} 
        AND c.user_id = ANY(ARRAY[${userIds.map((id) => `'${id}'::text`).join(',')}])
        AND c.company_id = $1
        ${groupBy}`;

      merchantData = (
        conn
          ? await conn.query(mQuery, [company_id])
          : await executeQuery(mQuery, [company_id], conn)
      ).rows;
    }

    // query for vendor only role
    if (role === Role.VENDOR) {
      // Get user hierarchy to validate sub-vendor access
      const userHierarchys = await getUserHierarchysDao({
        user_id: effectiveUserId,
      }, null, null, null, null, null, conn);
      let userIds = [effectiveUserId]; // Always include vendor's own ID

      // Include sub-vendors when available
      const subVendors =
        userHierarchys?.[0]?.config?.siblings?.sub_vendors || [];
      if (subVendors.length > 0) {
        userIds = [...new Set([...userIds, ...subVendors])];
      }

      // Handle userCodes for vendor totals
      if (userCodes?.length > 0) {
        // Get allowed sub-vendor IDs from hierarchy
        const allowedSubVendors =
          userHierarchys?.[0]?.config?.siblings?.sub_vendors || [];
        // Only include valid sub-vendor IDs
        const validUserIds = userCodes.filter((id) =>
          allowedSubVendors.includes(id),
        );
        userIds = [...new Set([...userCodes, ...validUserIds])]; // Remove duplicates
      }

      // Create parameterized query for all user IDs
      const userIdParams = userIds.map((_, index) => `$${index + 1}`).join(',');
      const vQuery = `${vendorQuery}  AND c.user_id = ANY(ARRAY[${userIdParams}])  AND c.company_id = $${userIds.length + 1}  ${groupBy}`;
      vendorData = (
        conn
          ? await conn.query(vQuery, [...userIds, company_id])
          : await executeQuery(vQuery, [...userIds, company_id], conn)
      ).rows;
    }

    if ([Role.SUPER_ADMIN, Role.ADMIN].includes(role)) {
      const condition =
        role === Role.ADMIN ? ` AND c.company_id = '${company_id}' ` : '';
      // If userCodes are provided, filter by them
      let userIds = [];
      if (userCodes.length > 0) {
        // Get user hierarchy to validate access

        // Process each userCode if provided
        if (userCodes?.length > 0) {
          for (const userCode of userCodes) {
            if (userCode) {
              const userHierarchys = await getUserHierarchysDao({
                user_id: userCode,
              });
              const allowedSubmerchants =
                userHierarchys?.[0]?.config?.siblings?.sub_merchants || [];
              // Combine current userCode with its submerchants
              userIds.push(userCode); // Add the main userCode
              userIds.push(...allowedSubmerchants); // Add all submerchants
            }
          }
        }
        // Remove any duplicates
        userIds = [...new Set(userIds)];
      }
      const baseCalQuery = `
        WITH LatestBalances AS (
          SELECT 
            c.user_id,
            c.company_id,
            c.net_balance,
            r.role,
            m.code as merchant_code,
            v.code as vendor_code,
            ROW_NUMBER() OVER (PARTITION BY c.user_id ORDER BY c.created_at DESC) as rn
          FROM "${tableName.CALCULATION}" c
          JOIN "${tableName.USER}" u ON c.user_id = u.id AND u.is_obsolete = FALSE
          JOIN "${tableName.ROLE}" r ON u.role_id = r.id 
          LEFT JOIN "${tableName.MERCHANT}" m ON m.user_id = c.user_id
          LEFT JOIN "${tableName.VENDOR}" v ON v.user_id = c.user_id
          WHERE c.is_obsolete = FALSE
          AND m.is_enabled = TRUE
          AND u.is_obsolete = FALSE
          AND c.created_at BETWEEN '${startDate}' AND '${endDate}'
          ${condition}
          ${
            userIds.length > 0
              ? `AND (m.user_id = ANY(ARRAY[${userIds.map((code) => `'${code}'`).join(',')}]) 
            OR v.user_id = ANY(ARRAY[${userCodes.map((code) => `'${code}'`).join(',')}]))`
              : 'AND m.is_obsolete = FALSE OR v.is_obsolete = FALSE'
          }
        )
        SELECT 
          role,
          company_id,
          CAST(ROUND(SUM(net_balance)::NUMERIC, 2) AS FLOAT) as net_balance_sum
        FROM LatestBalances 
        WHERE rn = 1
        GROUP BY role, company_id`;

      const balanceResult = conn
        ? await conn.query(baseCalQuery)
        : await executeQuery(baseCalQuery, [], conn);

      // Process results into netBalance object with company filtering
      netBalance = balanceResult.rows.reduce(
        (acc, row) => {
          if (
            row.role === Role.VENDOR &&
            (!company_id || row.company_id === company_id)
          ) {
            acc.vendor = row.net_balance_sum || 0;
          } else if (
            row.role === Role.MERCHANT &&
            (!company_id || row.company_id === company_id)
          ) {
            acc.merchant = row.net_balance_sum || 0;
          }
          return acc;
        },
        { vendor: 0, merchant: 0 },
      );
    } else {
      const userHierarchys = await getUserHierarchysDao({
        user_id: effectiveUserId,
      }, null, null, null, null, null, conn);
      let userIds = [effectiveUserId]; // Always include user's own ID

      // Include sub-merchants/sub-vendors when available based on role
      if (role === Role.MERCHANT) {
        const subMerchants =
          userHierarchys?.[0]?.config?.siblings?.sub_merchants || [];
        if (subMerchants.length > 0) {
          userIds = [...new Set([...userIds, ...subMerchants])];
        }
      } else if (role === Role.VENDOR) {
        const subVendors =
          userHierarchys?.[0]?.config?.siblings?.sub_vendors || [];
        if (subVendors.length > 0) {
          userIds = [...new Set([...userIds, ...subVendors])];
        }
      }

      // Handle userCodes for totals
      if (userCodes?.length > 0) {
        // Get allowed submerchant/sub-vendor IDs from hierarchy based on role
        const allowedSubmerchants =
          userHierarchys?.[0]?.config?.siblings?.sub_merchants || [];
        const allowedSubVendors =
          userHierarchys?.[0]?.config?.siblings?.sub_vendors || [];

        // Only include valid IDs based on role
        const validUserIds = userCodes.filter(
          (id) =>
            allowedSubmerchants.includes(id) || allowedSubVendors.includes(id),
        );
        userIds = [...new Set([...userCodes, ...validUserIds])]; // Remove duplicates
      }
      // For non-admin roles, use existing query logic

      const endDateConditon = ` AND DATE(c.created_at) = '${endDate}' `;
      const calBaseQuery = `
        WITH LatestCalculations AS (
          SELECT DISTINCT ON (c.user_id) 
            c.user_id,
            c.net_balance
          FROM "${tableName.CALCULATION}" c
          JOIN "${tableName.USER}" u ON c.user_id = u.id AND u.is_obsolete = FALSE
          JOIN "${tableName.ROLE}" r ON u.role_id = r.id AND r.role = 'PLACE_ROLE_HERE'
          WHERE c.is_obsolete = FALSE 
          AND c.user_id = ANY(ARRAY[${userIds.map((id) => `'${id}'`).join(',')}])
          AND c.company_id = '${company_id}'
          ${endDateConditon}
          ORDER BY c.user_id, c.created_at DESC
        )
        SELECT COALESCE(SUM(net_balance), 0) as net_balance_sum
        FROM LatestCalculations`;

      let vendorCalQuery = calBaseQuery.replace('PLACE_ROLE_HERE', Role.VENDOR);
      let merchantCalQuery = calBaseQuery.replace(
        'PLACE_ROLE_HERE',
        Role.MERCHANT,
      );

      netBalance.vendor =
        (conn
          ? await conn.query(vendorCalQuery)
          : await executeQuery(vendorCalQuery, [], conn)
        ).rows[0]?.net_balance_sum || 0;
      netBalance.merchant =
        (conn
          ? await conn.query(merchantCalQuery)
          : await executeQuery(merchantCalQuery, [], conn)
        ).rows[0]?.net_balance_sum || 0;
    }

    // Modify total calculations query for merchants based on role
    let merchantTotalQuery = `
      SELECT 
        CAST(SUM(c.total_payin_count) AS NUMERIC) AS total_payin_count,
        CAST(ROUND(SUM(c.total_payin_amount)::NUMERIC, 2) AS FLOAT) AS total_payin_amount,
        CAST(ROUND(SUM(c.total_payin_commission)::NUMERIC, 2) AS FLOAT) AS total_payin_commission,
        CAST(SUM(c.total_payout_count) AS NUMERIC) AS total_payout_count,
        CAST(ROUND(SUM(c.total_payout_amount)::NUMERIC, 2) AS FLOAT) AS total_payout_amount,
        CAST(ROUND(SUM(c.total_payout_commission)::NUMERIC, 2) AS FLOAT) AS total_payout_commission,
        CAST(SUM(c.total_settlement_count) AS NUMERIC) AS total_settlement_count,
        CAST(ROUND(SUM(c.total_settlement_amount)::NUMERIC, 2) AS FLOAT) AS total_settlement_amount,
        CAST(SUM(c.total_settlement_commission) AS NUMERIC) AS total_settlement_commission,
        CAST(SUM(c.total_chargeback_count) AS NUMERIC) AS total_chargeback_count,
        CAST(ROUND(SUM(c.total_chargeback_amount)::NUMERIC, 2) AS FLOAT) AS total_chargeback_amount,
        CAST(SUM(c.total_reverse_payout_count) AS NUMERIC) AS total_reverse_payout_count,
        CAST(ROUND(SUM(c.total_reverse_payout_amount)::NUMERIC, 2) AS FLOAT) AS total_reverse_payout_amount,
        CAST(ROUND(SUM(c.total_reverse_payout_commission)::NUMERIC, 2) AS FLOAT) AS total_reverse_payout_commission,
        CAST(SUM(c.total_adjustment_count) AS NUMERIC) AS total_adjustment_count,
        CAST(ROUND(SUM(c.total_adjustment_amount)::NUMERIC, 2) AS FLOAT) AS total_adjustment_amount,
        CAST(ROUND(SUM(c.total_adjustment_commission)::NUMERIC, 2) AS FLOAT) AS total_adjustment_commission,
        CAST(ROUND(SUM(c.current_balance)::NUMERIC, 2) AS FLOAT) AS current_balance,
        CAST(ROUND(SUM(c.net_balance)::NUMERIC, 2) AS FLOAT) AS net_balance,
        CAST(ROUND(SUM(COALESCE((c.config->>'total_bankSettlement_amount')::NUMERIC, 0))::NUMERIC, 2) AS FLOAT) AS total_bankSettlement_amount,
        CAST(ROUND(SUM(COALESCE((c.config->>'total_aedSentSettlement_amount')::NUMERIC, 0))::NUMERIC, 2) AS FLOAT) AS total_aedSentSettlement_amount,
        CAST(ROUND(SUM(COALESCE((c.config->>'total_bankSentSettlement_amount')::NUMERIC, 0))::NUMERIC, 2) AS FLOAT) AS total_bankSentSettlement_amount,
        CAST(ROUND(SUM(COALESCE((c.config->>'total_cashSentSettlement_amount')::NUMERIC, 0))::NUMERIC, 2) AS FLOAT) AS total_cashSentSettlement_amount,
        CAST(ROUND(SUM(COALESCE((c.config->>'total_internalSettlement_amount')::NUMERIC, 0))::NUMERIC, 2) AS FLOAT) AS total_internalSettlement_amount,
        CAST(ROUND(SUM(COALESCE((c.config->>'total_cryptoSentSettlement_amount')::NUMERIC, 0))::NUMERIC, 2) AS FLOAT) AS total_cryptoSentSettlement_amount,
        CAST(ROUND(SUM(COALESCE((c.config->>'total_aedReceivedSettlement_amount')::NUMERIC, 0))::NUMERIC, 2) AS FLOAT) AS total_aedReceivedSettlement_amount,
        CAST(ROUND(SUM(COALESCE((c.config->>'total_bankReceivedSettlement_amount')::NUMERIC, 0))::NUMERIC, 2) AS FLOAT) AS total_bankReceivedSettlement_amount,
        CAST(ROUND(SUM(COALESCE((c.config->>'total_cashReceivedSettlement_amount')::NUMERIC, 0))::NUMERIC, 2) AS FLOAT) AS total_cashReceivedSettlement_amount,
        CAST(ROUND(SUM(COALESCE((c.config->>'total_internalBankSettlement_amount')::NUMERIC, 0))::NUMERIC, 2) AS FLOAT) AS total_internalBankSettlement_amount,
        CAST(ROUND(SUM(COALESCE((c.config->>'total_cryptoReceivedSettlement_amount')::NUMERIC, 0))::NUMERIC, 2) AS FLOAT) AS total_cryptoReceivedSettlement_amount
      FROM "${tableName.CALCULATION}" c
      JOIN "${tableName.USER}" u ON c.user_id = u.id AND u.is_obsolete = FALSE 
      JOIN "${tableName.ROLE}" r ON u.role_id = r.id
      JOIN "${tableName.MERCHANT}" m ON c.user_id = m.user_id
      WHERE c.created_at BETWEEN '${startDate}' AND '${endDate}'
      AND m.is_enabled = TRUE
      AND r.role = 'MERCHANT'
    `;

    // Add vendor total calculations query
    let vendorTotalQuery = `
      SELECT 
        CAST(SUM(c.total_payin_count) AS NUMERIC) AS total_payin_count,
        CAST(ROUND(SUM(c.total_payin_amount)::NUMERIC, 2) AS FLOAT) AS total_payin_amount,
        CAST(ROUND(SUM(c.total_payin_commission)::NUMERIC, 2) AS FLOAT) AS total_payin_commission,
        CAST(SUM(c.total_payout_count) AS NUMERIC) AS total_payout_count,
        CAST(ROUND(SUM(c.total_payout_amount)::NUMERIC, 2) AS FLOAT) AS total_payout_amount,
        CAST(ROUND(SUM(c.total_payout_commission)::NUMERIC, 2) AS FLOAT) AS total_payout_commission,
        CAST(SUM(c.total_settlement_count) AS NUMERIC) AS total_settlement_count,
        CAST(ROUND(SUM(c.total_settlement_amount)::NUMERIC, 2) AS FLOAT) AS total_settlement_amount,
        CAST(SUM(c.total_settlement_commission) AS NUMERIC) AS total_settlement_commission,
        CAST(SUM(c.total_chargeback_count) AS NUMERIC) AS total_chargeback_count,
        CAST(ROUND(SUM(c.total_chargeback_amount)::NUMERIC, 2) AS FLOAT) AS total_chargeback_amount,
        CAST(SUM(c.total_reverse_payout_count) AS NUMERIC) AS total_reverse_payout_count,
        CAST(ROUND(SUM(c.total_reverse_payout_amount)::NUMERIC, 2) AS FLOAT) AS total_reverse_payout_amount,
        CAST(ROUND(SUM(c.total_reverse_payout_commission)::NUMERIC, 2) AS FLOAT) AS total_reverse_payout_commission,
        CAST(SUM(c.total_adjustment_count) AS NUMERIC) AS total_adjustment_count,
        CAST(ROUND(SUM(c.total_adjustment_amount)::NUMERIC, 2) AS FLOAT) AS total_adjustment_amount,
        CAST(ROUND(SUM(c.total_adjustment_commission)::NUMERIC, 2) AS FLOAT) AS total_adjustment_commission,
        CAST(ROUND(SUM(c.current_balance)::NUMERIC, 2) AS FLOAT) AS current_balance,
        CAST(ROUND(SUM(c.net_balance)::NUMERIC, 2) AS FLOAT) AS net_balance,
        CAST(ROUND(SUM(COALESCE((c.config->>'total_bankSettlement_amount')::NUMERIC, 0))::NUMERIC, 2) AS FLOAT) AS total_bankSettlement_amount,
        CAST(ROUND(SUM(COALESCE((c.config->>'total_aedSentSettlement_amount')::NUMERIC, 0))::NUMERIC, 2) AS FLOAT) AS total_aedSentSettlement_amount,
        CAST(ROUND(SUM(COALESCE((c.config->>'total_bankSentSettlement_amount')::NUMERIC, 0))::NUMERIC, 2) AS FLOAT) AS total_bankSentSettlement_amount,
        CAST(ROUND(SUM(COALESCE((c.config->>'total_cashSentSettlement_amount')::NUMERIC, 0))::NUMERIC, 2) AS FLOAT) AS total_cashSentSettlement_amount,
        CAST(ROUND(SUM(COALESCE((c.config->>'total_internalSettlement_amount')::NUMERIC, 0))::NUMERIC, 2) AS FLOAT) AS total_internalSettlement_amount,
        CAST(ROUND(SUM(COALESCE((c.config->>'total_cryptoSentSettlement_amount')::NUMERIC, 0))::NUMERIC, 2) AS FLOAT) AS total_cryptoSentSettlement_amount,
        CAST(ROUND(SUM(COALESCE((c.config->>'total_aedReceivedSettlement_amount')::NUMERIC, 0))::NUMERIC, 2) AS FLOAT) AS total_aedReceivedSettlement_amount,
        CAST(ROUND(SUM(COALESCE((c.config->>'total_bankReceivedSettlement_amount')::NUMERIC, 0))::NUMERIC, 2) AS FLOAT) AS total_bankReceivedSettlement_amount,
        CAST(ROUND(SUM(COALESCE((c.config->>'total_cashReceivedSettlement_amount')::NUMERIC, 0))::NUMERIC, 2) AS FLOAT) AS total_cashReceivedSettlement_amount,
        CAST(ROUND(SUM(COALESCE((c.config->>'total_internalBankSettlement_amount')::NUMERIC, 0))::NUMERIC, 2) AS FLOAT) AS total_internalBankSettlement_amount,
        CAST(ROUND(SUM(COALESCE((c.config->>'total_cryptoReceivedSettlement_amount')::NUMERIC, 0))::NUMERIC, 2) AS FLOAT) AS total_cryptoReceivedSettlement_amount,
        -- vendor_commission: commission from sub-vendors (role-based filtering)
        CAST(ROUND(SUM(CASE 
          WHEN '${role}' = 'ADMIN' AND d.designation = 'SUB_VENDOR' THEN c.total_payin_commission 
          WHEN '${role}' = 'VENDOR' AND d.designation = 'VENDOR' THEN c.total_payin_commission 
          ELSE 0 
        END)::NUMERIC, 2) AS FLOAT) AS vendor_commission,
        -- merdiator_commission: commission from vendor admins (role-based filtering)
        CAST(ROUND(SUM(CASE 
          WHEN '${role}' = 'ADMIN' AND d.designation IN ('ADMIN', 'TRANSACTIONS', 'OPERATIONS', 'VENDOR') THEN c.total_payin_commission 
          WHEN '${role}' = 'VENDOR' AND d.designation = 'VENDOR' THEN c.total_payin_commission 
          ELSE 0 
        END)::NUMERIC, 2) AS FLOAT) AS merdiator_commission
      FROM "${tableName.CALCULATION}" c
      JOIN "${tableName.USER}" u ON c.user_id = u.id AND u.is_obsolete = FALSE
      JOIN "${tableName.ROLE}" r ON u.role_id = r.id
      JOIN "${tableName.VENDOR}" v ON c.user_id = v.user_id
      LEFT JOIN "${tableName.DESIGNATION}" d ON u.designation_id = d.id
      WHERE c.created_at BETWEEN '${startDate}' AND '${endDate}'
      AND r.role = 'VENDOR'
    `;

    // Add role-based conditions
    if (role === Role.MERCHANT) {
      // Get user hierarchy to validate submerchant access
      const userHierarchys = await getUserHierarchysDao({
        user_id: effectiveUserId,
      }, null, null, null, null, null, conn);
      let userIds = [effectiveUserId];

      if (userCodes?.length > 0) {
        const allowedSubmerchants =
          userHierarchys?.[0]?.config?.siblings?.sub_merchants || [];
        const validUserIds = userCodes.filter((id) =>
          allowedSubmerchants.includes(id),
        );
        userIds = [...new Set([...userCodes, ...validUserIds])];
      }

      merchantTotalQuery += ` AND m.user_id = ANY(ARRAY['${userIds.join("','")}']) `;
      merchantTotalQuery += ` AND c.company_id = '${company_id}'`;
      vendorTotalQuery = null; // Merchant shouldn't see vendor totals
    } else if (role === Role.VENDOR) {
      // Get user hierarchy to validate sub-vendor access
      const userHierarchys = await getUserHierarchysDao({
        user_id: effectiveUserId,
      }, null, null, null, null, null, conn);
      let userIds = [effectiveUserId]; // Always include vendor's own ID

      // Include sub-vendors when available
      const subVendors =
        userHierarchys?.[0]?.config?.siblings?.sub_vendors || [];
      if (subVendors.length > 0) {
        userIds = [...new Set([...userIds, ...subVendors])];
      }

      // Add filter to vendor total query
      vendorTotalQuery += ` AND c.user_id = ANY(ARRAY['${userIds.join("','")}']) `;
      vendorTotalQuery += ` AND c.company_id = '${company_id}'`;
      merchantTotalQuery = null;
    } else if (role === Role.SUB_VENDOR) {
      vendorTotalQuery += ` AND c.user_id = '${effectiveUserId}'`;
      vendorTotalQuery += ` AND c.company_id = '${company_id}'`;
      merchantTotalQuery = null; // Sub-vendor shouldn't see merchant totals
    } else if (role === Role.ADMIN) {
      // Get user hierarchy to validate access
      let userIds = [];

      // Process each userCode if provided
      if (userCodes?.length > 0) {
        // Batch fetch hierarchies with limited concurrency to avoid connection pool exhaustion
        const batchSize = 5;
        const hierarchies = [];
        for (let i = 0; i < userCodes.length; i += batchSize) {
          const batch = userCodes.slice(i, i + batchSize);
          const batchResults = await Promise.all(
            batch.map(userCode => getUserHierarchysDao({ user_id: userCode }, null, null, null, null, null, conn))
          );
          hierarchies.push(...batchResults);
        }
        
        hierarchies.forEach((userHierarchys, index) => {
          const userCode = userCodes[index];
          if (userCode && userHierarchys) {
            const allowedSubmerchants =
              userHierarchys?.[0]?.config?.siblings?.sub_merchants || [];
            userIds.push(userCode);
            userIds.push(...allowedSubmerchants);
          }
        });

        userIds = [...new Set(userIds)]; // Remove duplicates

        // Add filters to queries using proper array syntax
        if (userIds.length > 0) {
          const userIdsFormatted = userIds.map((id) => `'${id}'`).join(',');
          merchantTotalQuery += ` AND m.user_id = ANY(ARRAY[${userIdsFormatted}]) `;
          // Fixed: Include sub-vendors for Admin role vendor total calculations
          const vendorUserIds = [];
          for (const userCode of userCodes) {
            if (userCode) {
              const userHierarchys = await getUserHierarchysDao({
                user_id: userCode,
              }, null, null, null, null, null, conn);
              const allowedSubvendors =
                userHierarchys?.[0]?.config?.siblings?.sub_vendors || [];
              vendorUserIds.push(userCode); // Add the main userCode
              vendorUserIds.push(...allowedSubvendors); // Add all sub-vendors
            }
          }
          const uniqueVendorUserIds = [...new Set(vendorUserIds)];
          if (uniqueVendorUserIds.length > 0) {
            vendorTotalQuery += ` AND v.user_id = ANY(ARRAY[${uniqueVendorUserIds.map((code) => `'${code}'`).join(',')}]) `;
          }
        }
      }

      merchantTotalQuery += ` AND c.company_id = '${company_id}'`;
      vendorTotalQuery += ` AND c.company_id = '${company_id}'`;
    }

    // Execute queries based on role
    const [merchantTotal, vendorTotal] = await Promise.all([
      merchantTotalQuery
        ? conn
          ? await conn.query(merchantTotalQuery)
          : await executeQuery(merchantTotalQuery, [], conn)
        : Promise.resolve({ rows: [{}] }),
      vendorTotalQuery
        ? conn
          ? await conn.query(vendorTotalQuery)
          : await executeQuery(vendorTotalQuery, [], conn)
        : Promise.resolve({ rows: [{}] }),
    ]);
    return {
      vendor: vendorData,
      merchant: merchantData,
      netBalance,
      merchantTotalCalculations: merchantTotal.rows[0] || {},
      vendorTotalCalculations: vendorTotal.rows[0] || {},
    };
  } catch (error) {
    logger.error('Error getting calculation data:', error);
    throw error;
  }
};

////for cron job to update net_balance
export const getCalculationforCronDao = async (userId, conn = null) => {
  try {
    const sql = `
      SELECT *
      FROM public."Calculation" 
      WHERE is_obsolete = false 
      AND user_id = $1
      ORDER BY created_at DESC 
      LIMIT 1
    `;
    // Ensure userId is correctly passed as an array
    const result = await executeQuery(sql, [userId], conn);
    return result.rows;
  } catch (error) {
    logger.error('Error fetching Calculation', error);
    throw error;
  }
};

// Batch fetch latest calculation for all users (for cron optimization)
export const getLatestCalculationsForAllUsersDao = async (conn = null) => {
  try {
    const sql = `
      SELECT DISTINCT ON (user_id)
        user_id,
        role_id,
        company_id,
        net_balance
      FROM public."Calculation" 
      WHERE is_obsolete = false
      ORDER BY user_id, created_at DESC
    `;
    const result = await executeQuery(sql, [], conn);
    return result.rows;
  } catch (error) {
    logger.error('Error fetching latest calculations for all users', error);
    throw error;
  }
};

export const getAllCalculationforCronDao = async (userId, conn = null) => {
  try {
    const sql = `
      SELECT *
      FROM public."Calculation" 
      WHERE is_obsolete = false 
      AND user_id = $1
      ORDER BY created_at DESC 
    `;
    // Ensure userId is correctly passed as an array
    const result = conn
      ? await conn.query(sql, [userId])
      : await executeQuery(sql, [userId], conn);
    return result.rows;
  } catch (error) {
    logger.error('Error fetching Calculation', error);
    throw error;
  }
};

export const checkTodayCalculationExistsDao = async (conn = null) => {
  try {
    const today = dayjs().tz(IST).format('YYYY-MM-DD');
    const sql = `
      SELECT COUNT(*) as count
      FROM public."Calculation" 
      WHERE is_obsolete = false 
      AND DATE(created_at) = $1
      LIMIT 1
    `;
    const result = conn
      ? await conn.query(sql, [today])
      : await executeQuery(sql, [today], conn);
    return parseInt(result.rows[0].count) > 0;
  } catch (error) {
    logger.error('Error checking today calculation exists:', error);
    throw error;
  }
};

const createCalculationDao = async (data, conn = null) => {
  try {
    const [sql, params] = buildInsertQuery(tableName.CALCULATION, data);
    const result = await executeQuery(sql, params, conn);
    return result.rows ? result.rows[0] : result[0]; // Return the first row or result based on the structure
  } catch (error) {
    logger.error('Error creating calculation:', error); // Log the error for debugging
    throw error;
  }
};

const updateCalculationDao = async (id, data, conn = null) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.CALCULATION, data, id);
    const result = await executeQuery(sql, params, conn);
    return result.rows ? result.rows[0] : result[0]; // Return the first row or result based on the structure
  } catch (error) {
    logger.error('Error updating calculation:', error); // Log the error for debugging
    throw error;
  }
};
const updateCalculationConfigDao = async (id, data, conn = null) => {
  return buildAndExecuteUpdateQuery(
    tableName.CALCULATION,
    data,
    id,
    {},
    { returnUpdated: true },
    conn,
  );
};

const deleteCalculationDao = async (id, data, conn = null) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.CALCULATION, data, id);

    const result = await executeQuery(sql, params, conn);

    return result.rows ? result.rows[0] : result[0]; // Return the first row or result based on the structure
  } catch (error) {
    logger.error('Error deleting calculation:', error);
    throw error;
  }
};

export const updateCalculationBalanceDao = async (
  filters,
  data,
  conn = null,
) => {
  try {
    const specialFields = {};
    Object.keys(data).forEach((el) => {
      specialFields[el] = '+';
    });
    const [sql, params] = buildUpdateQuery(
      tableName.CALCULATION,
      data,
      filters,
      specialFields,
    );
    const result = conn
      ? await conn.query(sql, params)
      : await executeQuery(sql, params, conn);
    return result.rows[0];
  } catch (error) {
    logger.error('Error updating calculation:', error);
    throw error;
  }
};

// Checks if any calculation entry exists for a given date (YYYY-MM-DD)
const checkCalculationEntryForDateDao = async (date, conn = null) => {
  try {
    // Compare only the date part, ignoring time and timezone
    const sql = `
      SELECT 1 FROM public."Calculation"
      WHERE is_obsolete = false
      AND to_char(created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') = $1
      LIMIT 1
    `;
    const result = conn
      ? await conn.query(sql, [date])
      : await executeQuery(sql, [date], conn);
    return result.rows.length > 0;
  } catch (error) {
    logger.error('Error checking calculation entry for date', error);
    throw error;
  }
};

const getMerchantNetBalanceDao = async (
  companyId,
  startDate,
  endDate,
  conn = null,
) => {
  try {
    // Base query to get merchant net balance data with latest records
    let sql = `
      SELECT 
        c.user_id, 
        c.net_balance, 
        m.code,
        c.created_at,
        ROW_NUMBER() OVER (PARTITION BY c.user_id ORDER BY c.created_at DESC) as rn
      FROM public."Calculation" c
      LEFT JOIN public."Role" r ON r.id = c.role_id
      LEFT JOIN public."Merchant" m ON m.user_id = c.user_id
      WHERE c.company_id = $1
      AND r.role = '${Role.MERCHANT}'
      AND DATE(c.created_at) BETWEEN DATE($2) AND DATE($3)
      AND m.is_obsolete = false
      AND c.is_obsolete = false
    `;

    const queryParams = [companyId, startDate, endDate];

    // Get the latest record for each merchant
    const wrappedSql = `
      SELECT user_id, net_balance, code
      FROM (${sql}) as latest_records
      WHERE rn = 1
    `;

    const result = conn
      ? await conn.query(wrappedSql, queryParams)
      : await executeQuery(wrappedSql, queryParams, conn);
    let merchantData = result.rows;

    // If no data, return empty array
    if (merchantData.length === 0) {
      return merchantData;
    }

    // Filter out inactive merchants (same net_balance in last 10 entries)
    const activeMerchants = [];
    for (const merchant of merchantData) {
      try {
        // Get last 10 calculation entries for this merchant
        const historyQuery = `
          SELECT net_balance
          FROM public."Calculation" c
          LEFT JOIN public."Role" r ON r.id = c.role_id
          WHERE c.user_id = $1
          AND c.company_id = $2
          AND r.role = '${Role.MERCHANT}'
          AND c.is_obsolete = false
          ORDER BY c.created_at DESC
          LIMIT 10
        `;

        const historyResult = conn
          ? await conn.query(historyQuery, [merchant.user_id, companyId])
          : await executeQuery(historyQuery, [merchant.user_id, companyId]);
        const netBalances = historyResult.rows.map((row) =>
          parseFloat(row.net_balance),
        );

        // Check if merchant is active (has different net_balance values in last 10 entries)
        // If less than 10 entries or has variation in net_balance, consider as active
        if (
          netBalances.length < 10 ||
          !netBalances.every((balance) => balance === netBalances[0])
        ) {
          activeMerchants.push(merchant);
          logger.info(
            `Merchant ${merchant.code} is active - balance variation found or less than 10 entries`,
          );
        } else {
          if (config.env === 'production') {
          logger.info(
            `Merchant ${merchant.code} is inactive - same balance ${netBalances[0]} in last 10 entries`,
          );
        }
        }
      } catch (error) {
        logger.warn(
          `Error checking merchant ${merchant.code} activity:`,
          error,
        );
        // Include merchant if there's an error checking activity
        activeMerchants.push(merchant);
      }
    }

    merchantData = activeMerchants;

    // Always process hierarchy to club parent and child data
    const clubbedData = new Map();
    const processedUsers = new Set();
    const hierarchyMap = new Map();

    // First, get hierarchy for all users
    for (const merchant of merchantData) {
      try {
        const userHierarchy = await getUserHierarchysDao({
          user_id: merchant.user_id,
        });
        hierarchyMap.set(merchant.user_id, userHierarchy);
      } catch (error) {
        logger.warn(
          `Failed to get hierarchy for user ${merchant.user_id}:`,
          error,
        );
        hierarchyMap.set(merchant.user_id, null);
      }
    }

    // Process each merchant
    for (const merchant of merchantData) {
      const userId = merchant.user_id;

      if (processedUsers.has(userId)) {
        continue;
      }

      const userHierarchy = hierarchyMap.get(userId);
      const hierarchyConfig = userHierarchy?.[0]?.config;

      // Check if this user is a parent - look for sub_merchants in the config
      const subMerchants = hierarchyConfig?.siblings?.sub_merchants || [];

      if (subMerchants && subMerchants.length > 0) {
        // This is a parent merchant - club data with children
        let totalNetBalance = parseFloat(merchant.net_balance || 0);
        const parentCode = merchant.code;

        // Add child merchants' net balances to parent
        for (const childUserId of subMerchants) {
          const childMerchant = merchantData.find(
            (m) => m.user_id === childUserId,
          );
          if (childMerchant) {
            const childBalance = parseFloat(childMerchant.net_balance || 0);
            totalNetBalance += childBalance;
            processedUsers.add(childUserId); // Mark child as processed
          }
        }

        // Store clubbed data under parent's code
        clubbedData.set(parentCode, {
          user_id: userId,
          net_balance: totalNetBalance,
          code: parentCode,
          is_parent: true,
          sub_merchants: subMerchants,
        });

        processedUsers.add(userId); // Mark parent as processed
      } else {
        // This might be a standalone merchant or child - check if already processed
        if (!processedUsers.has(userId)) {
          clubbedData.set(merchant.code, {
            user_id: userId,
            net_balance: parseFloat(merchant.net_balance || 0),
            code: merchant.code,
            is_parent: false,
          });
          processedUsers.add(userId);
        }
      }
    }

    const result_data = Array.from(clubbedData.values());

    // Convert Map to array and return
    return result_data;
  } catch (error) {
    logger.error('Error fetching merchant net balance:', error);
    throw error;
  }
};

const getVendorNetBalanceDao = async (
  companyId,
  startDate,
  endDate,
  conn = null,
) => {
  try {
    // Base query to get vendor net balance data with latest records
    let sql = `
      SELECT 
        c.user_id, 
        c.net_balance, 
        v.code,
        c.created_at,
        ROW_NUMBER() OVER (PARTITION BY c.user_id ORDER BY c.created_at DESC) as rn
      FROM public."Calculation" c
      LEFT JOIN public."Role" r ON r.id = c.role_id
      LEFT JOIN public."Vendor" v ON v.user_id = c.user_id
      WHERE c.company_id = $1
      AND r.role = '${Role.VENDOR}'
      AND DATE(c.created_at) BETWEEN DATE($2) AND DATE($3)
      AND v.is_obsolete = false
      AND c.is_obsolete = false
    `;

    const queryParams = [companyId, startDate, endDate];

    // Get the latest record for each vendor
    const wrappedSql = `
      SELECT user_id, net_balance, code
      FROM (${sql}) as latest_records
      WHERE rn = 1
    `;

    const result = conn
      ? await conn.query(wrappedSql, queryParams)
      : await executeQuery(wrappedSql, queryParams, conn);
    let vendorData = result.rows;

    // If no data, return empty array
    if (vendorData.length === 0) {
      return vendorData;
    }

    // Filter out inactive vendors (same net_balance in last 10 entries)
    const activeVendors = [];
    for (const vendor of vendorData) {
      try {
        // Get last 10 calculation entries for this vendor
        const historyQuery = `
          SELECT net_balance
          FROM public."Calculation" c
          LEFT JOIN public."Role" r ON r.id = c.role_id
          WHERE c.user_id = $1
          AND c.company_id = $2
          AND r.role = '${Role.VENDOR}'
          AND c.is_obsolete = false
          ORDER BY c.created_at DESC
          LIMIT 10
        `;

        const historyResult = conn
          ? await conn.query(historyQuery, [vendor.user_id, companyId])
          : await executeQuery(historyQuery, [vendor.user_id, companyId]);
        const netBalances = historyResult.rows.map((row) =>
          parseFloat(row.net_balance),
        );

        // Check if vendor is active (has different net_balance values in last 10 entries)
        // If less than 10 entries or has variation in net_balance, consider as active
        if (
          netBalances.length < 10 ||
          !netBalances.every((balance) => balance === netBalances[0])
        ) {
          activeVendors.push(vendor);
          logger.info(
            `Vendor ${vendor.code} is active - balance variation found or less than 10 entries`,
          );
        } else {
          if (config.env === 'production') {
          logger.info(
            `Vendor ${vendor.code} is inactive - same balance ${netBalances[0]} in last 10 entries`,
          );
        }
        }
      } catch (error) {
        logger.warn(`Error checking vendor ${vendor.code} activity:`, error);
        // Include vendor if there's an error checking activity
        activeVendors.push(vendor);
      }
    }

    vendorData = activeVendors;

    // Always process hierarchy to club parent and child data
    const clubbedData = new Map();
    const processedUsers = new Set();
    const hierarchyMap = new Map();

    // First, get hierarchy for all users
    for (const vendor of vendorData) {
      try {
        const userHierarchy = await getUserHierarchysDao({
          user_id: vendor.user_id,
        });
        hierarchyMap.set(vendor.user_id, userHierarchy);
      } catch (error) {
        logger.warn(
          `Failed to get hierarchy for user ${vendor.user_id}:`,
          error,
        );
        hierarchyMap.set(vendor.user_id, null);
      }
    }

    // Process each vendor
    for (const vendor of vendorData) {
      const userId = vendor.user_id;

      if (processedUsers.has(userId)) {
        continue;
      }

      const userHierarchy = hierarchyMap.get(userId);
      const hierarchyConfig = userHierarchy?.[0]?.config;

      // Check if this user is a parent - look for sub_vendors in the config
      const subVendors = hierarchyConfig?.siblings?.sub_vendors || [];

      if (subVendors && subVendors.length > 0) {
        // This is a parent vendor - club data with children
        let totalNetBalance = parseFloat(vendor.net_balance || 0);
        const parentCode = vendor.code;

        // Add child vendors' net balances to parent
        for (const childUserId of subVendors) {
          const childVendor = vendorData.find((v) => v.user_id === childUserId);
          if (childVendor) {
            const childBalance = parseFloat(childVendor.net_balance || 0);
            totalNetBalance += childBalance;
            processedUsers.add(childUserId); // Mark child as processed
          }
        }

        // Store clubbed data under parent's code
        clubbedData.set(parentCode, {
          user_id: userId,
          net_balance: totalNetBalance,
          code: parentCode,
          is_parent: true,
          sub_vendors: subVendors,
        });

        processedUsers.add(userId); // Mark parent as processed
      } else {
        // This might be a standalone vendor or child - check if already processed
        if (!processedUsers.has(userId)) {
          clubbedData.set(vendor.code, {
            user_id: userId,
            net_balance: parseFloat(vendor.net_balance || 0),
            code: vendor.code,
            is_parent: false,
          });
          processedUsers.add(userId);
        }
      }
    }

    const result_data = Array.from(clubbedData.values());

    // Convert Map to array and return
    return result_data;
  } catch (error) {
    logger.error('Error fetching vendor net balance:', error);
    throw error;
  }
};

// Helper function to get user's role from user_id
const getUserRoleDao = async (user_id, conn = null) => {
  try {
    const query = `
      SELECT r.role
      FROM "${tableName.USER}" u
      JOIN "${tableName.ROLE}" r ON u.role_id = r.id
      WHERE u.id = $1 AND u.is_obsolete = false
    `;

    const result = conn
      ? await conn.query(query, [user_id])
      : await executeQuery(query, [user_id], conn);
    return result.rows[0]?.role || null;
  } catch (error) {
    logger.error('Error getting user role:', error);
    throw error;
  }
};

// Helper function to calculate payin data for a user and date range
const calculatePayinDataDao = async (
  user_id,
  company_id,
  startDate,
  additionalPayinData = null,
  conn = null,
) => {
  try {
    // Get user's role to determine which commission field to use and which table to join
    const userRole = await getUserRoleDao(user_id);
    const commissionField =
      userRole === Role.MERCHANT
        ? 'payin_merchant_commission'
        : 'payin_vendor_commission';

    let query, queryParams;

    if (userRole === Role.MERCHANT) {
      // For merchant role, join with Merchant table to get merchant_id
      // Use IST timezone conversion for approved_at field
      query = `
        SELECT 
          p.status,
          COUNT(*) as count,
          COALESCE(SUM(p.amount), 0) as total_amount,
          COALESCE(SUM(p.${commissionField}), 0) as total_commission
        FROM "${tableName.PAYIN}" p
        JOIN "${tableName.MERCHANT}" m ON p.merchant_id = m.id
        WHERE m.user_id = $1
          AND m.is_enabled = true
          AND p.company_id = $2
          AND p.is_obsolete = false
          AND (p.approved_at)::date = $3::date
          AND p.status = 'SUCCESS'
        GROUP BY p.status
      `;
      queryParams = [user_id, company_id, startDate];
    } else {
      // Use IST timezone conversion for created_at field
      query = `
        SELECT 
          br.status,
          COUNT(*) as count,
          COALESCE(SUM(br.amount), 0) as total_amount,
          -- Calculate commission based on vendor's payin commission rate
          COALESCE(SUM(br.amount * COALESCE(v.payin_commission, 0) / 100), 0) as total_commission
        FROM "${tableName.BANK_RESPONSE}" br
        JOIN "${tableName.BANK_ACCOUNT}" ba ON br.bank_id = ba.id
        JOIN "${tableName.VENDOR}" v ON ba.user_id = v.user_id
        WHERE ba.user_id = $1
          AND br.company_id = $2
          AND br.is_obsolete = false
          AND (br.created_at)::date = $3::date
          AND br.status = '/success'
        GROUP BY br.status
      `;
      queryParams = [user_id, company_id, startDate];
    }

    const result = conn
      ? await conn.query(query, queryParams)
      : await executeQuery(query, queryParams, conn);

    const payinData = {
      total_payin_count: 0,
      total_payin_amount: 0,
      total_payin_commission: 0,
    };

    result.rows.forEach((row) => {
      if (row.status === Status.SUCCESS || row.status === Status.BOT) {
        payinData.total_payin_count = parseInt(row.count);
        payinData.total_payin_amount = parseFloat(row.total_amount);
        payinData.total_payin_commission = parseFloat(row.total_commission);
      }
    });

    // Add reversed internal settlements to payin data
    if (additionalPayinData && additionalPayinData.count > 0) {
      payinData.total_payin_count += additionalPayinData.count;
      payinData.total_payin_amount += additionalPayinData.amount;
      payinData.total_payin_commission += additionalPayinData.commission;
    }

    return payinData;
  } catch (error) {
    logger.error('Error calculating payin data:', error);
    throw error;
  }
};

// Helper function to calculate payout data for a user and date range
const calculatePayoutDataDao = async (
  user_id,
  company_id,
  startDate,
  conn = null,
) => {
  try {
    // Get user's role to determine which commission field to use and which table to join
    const userRole = await getUserRoleDao(user_id, conn);
    const commissionField =
      userRole === Role.MERCHANT
        ? 'payout_merchant_commission'
        : 'payout_vendor_commission';

    let query, queryParams;

    if (userRole === Role.MERCHANT) {
      // For merchant role, join with Merchant table to get merchant_id
      // Use IST timezone conversion for approved_at and rejected_at fields
      query = `
        SELECT 
          p.status,
          COUNT(*) as count,
          COALESCE(SUM(p.amount), 0) as total_amount,
          COALESCE(SUM(p.${commissionField}), 0) as total_commission
        FROM "${tableName.PAYOUT}" p
        JOIN "${tableName.MERCHANT}" m ON p.merchant_id = m.id
        WHERE m.user_id = $1
          AND m.is_enabled = true
          AND p.company_id = $2
          AND p.is_obsolete = false
          AND (
            (p.status = 'APPROVED' AND (p.approved_at)::date = $3::date) OR
            (p.status = 'REVERSED' AND (p.updated_at)::date = $3::date)
          )
        GROUP BY p.status
      `;
      queryParams = [user_id, company_id, startDate];
    } else {
      // For vendor role, use user_id directly (as per schema, payout.user_id refers to vendor's user_id)
      // Use IST timezone conversion for approved_at and updated_at fields
      query = `
        SELECT 
          p.status,
          COUNT(*) as count,
          COALESCE(SUM(p.amount), 0) as total_amount,
          COALESCE(SUM(p.${commissionField}), 0) as total_commission
        FROM "${tableName.PAYOUT}" p
        JOIN "${tableName.VENDOR}" v ON p.vendor_id = v.id
        WHERE v.user_id = $1
          AND p.company_id = $2
          AND p.is_obsolete = false
          AND (
            (p.status = 'APPROVED' AND (p.approved_at)::date = $3::date) OR
            (p.status = 'REVERSED' AND (p.updated_at)::date = $3::date)
          )
        GROUP BY p.status
      `;
      queryParams = [user_id, company_id, startDate];
    }

    const result = conn
      ? await conn.query(query, queryParams)
      : await executeQuery(query, queryParams, conn);

    const payoutData = {
      total_payout_count: 0,
      total_payout_amount: 0,
      total_payout_commission: 0,
      total_reverse_payout_count: 0,
      total_reverse_payout_amount: 0,
      total_reverse_payout_commission: 0,
    };

    result.rows.forEach((row) => {
      if (row.status === Status.APPROVED) {
        payoutData.total_payout_count = parseInt(row.count);
        payoutData.total_payout_amount = parseFloat(row.total_amount);
        payoutData.total_payout_commission = parseFloat(row.total_commission);
      }
      // Handle reverse payouts (status might be REVERSED or similar)
      if (row.status === Status.REVERSED) {
        payoutData.total_reverse_payout_count += parseInt(row.count);
        payoutData.total_reverse_payout_amount += parseFloat(row.total_amount);
        payoutData.total_reverse_payout_commission += parseFloat(
          row.total_commission,
        );
      }
    });

    return payoutData;
  } catch (error) {
    logger.error('Error calculating payout data:', error);
    throw error;
  }
};

// Helper function to calculate settlement data for a user and date range
const calculateSettlementDataDao = async (
  user_id,
  company_id,
  startDate,
  role = null,
  conn = null,
) => {
  try {
    let query;
    // Get detailed settlement data including transaction IDs and config to handle same-date reversals
    if (role === Role.MERCHANT) {
      query = `
      SELECT 
        s.id,
        s.status,
        s.method,
        s.amount,
        s.config,
        (s.created_at)::date as created_date,
        (s.approved_at)::date as approved_date,
        (s.rejected_at)::date as updated_date
      FROM "${tableName.SETTLEMENT}" s
      WHERE s.user_id = $1 
        AND s.company_id = $2
        AND s.is_obsolete = false
        AND (
            (s.status = 'SUCCESS' AND (s.approved_at)::date = $3::date) OR
            (s.status = 'REVERSED' AND (s.rejected_at)::date = $3::date)
          )
      ORDER BY s.id, s.status
    `;
    } else if (role === Role.VENDOR) {
      query = `
        SELECT 
          s.id,
          s.status,
          s.method,
          s.amount,
          s.config,
          (s.created_at)::date as created_date,
          (s.approved_at)::date as approved_date,
          (s.rejected_at)::date as updated_date
        FROM "${tableName.SETTLEMENT}" s
        WHERE s.user_id = $1 
          AND s.company_id = $2
          AND s.is_obsolete = false
          AND (
              (s.status = 'SUCCESS' AND (s.approved_at)::date = $3::date) OR
              (s.status = 'REVERSED' AND (s.rejected_at)::date = $3::date)
            )
        ORDER BY s.id, s.status
      `;
    }

    const result = conn
      ? await conn.query(query, [user_id, company_id, startDate])
      : await executeQuery(query, [user_id, company_id, startDate]);

    const settlementData = {
      total_settlement_count: 0,
      total_settlement_amount: 0,
      total_settlement_commission: 0,
      // Track reversed internal settlements to be added to payin
      reversed_internal_settlements: {
        count: 0,
        amount: 0,
        commission: 0,
      },
      settlement_details: {
        total_bankSettlement_amount: 0,
        total_aedSentSettlement_amount: 0,
        total_bankSentSettlement_amount: 0,
        total_cashSentSettlement_amount: 0,
        total_internalSettlement_amount: 0,
        total_aedReceivedSettlement_amount: 0,
        total_bankReceivedSettlement_amount: 0,
        total_cashReceivedSettlement_amount: 0,
        total_internalBankSettlement_amount: 0,
        total_cryptoReceivedSettlement_amount: 0,
      },
    };

    // Process all settlements individually (standalone entries)
    result.rows.forEach((settlement) => {
      const amount = parseFloat(settlement.amount || 0);
      const commission = parseFloat(settlement.commission || 0);
      const debitCredit = settlement.config?.debit_credit;
      const status = settlement.status;

      let finalAmount = 0;
      let shouldProcess = true;

      if (status === Status.SUCCESS) {
        // Always process SUCCESS entries with standard logic
        if (debitCredit) {
          if (debitCredit.toLowerCase() === 'sent') {
            finalAmount = Math.abs(amount); // ADD for SENT
          } else if (debitCredit.toLowerCase() === 'received') {
            finalAmount = -Math.abs(amount); // DEDUCT for RECEIVED
          }
        }
        logger.info(
          `Processing SUCCESS settlement: ID=${settlement.id}, amount=${finalAmount}`,
        );
      } else if (status === Status.REVERSED) {
        // Date-based logic for REVERSED entries only
        const createdDate = settlement.created_date;
        const updatedDate = settlement.updated_date;

        if (createdDate === updatedDate) {
          // Same date - NEGLECT the entry
          shouldProcess = false;
          logger.info(
            `NEGLECTING REVERSED settlement: ID=${settlement.id}, amount=${amount} (created_date = updated_date)`,
          );
        } else {
          // Different dates - apply calculation logic
          if (debitCredit) {
            if (role === Role.MERCHANT) {
              // For merchant: SENT = DEDUCT, RECEIVED = ADD (opposite of SUCCESS)
              if (debitCredit.toLowerCase() === 'sent') {
                finalAmount = -Math.abs(amount); // DEDUCT for SENT
              } else if (debitCredit.toLowerCase() === 'received') {
                finalAmount = Math.abs(amount); // ADD for RECEIVED
              }
            } else if (role === Role.VENDOR) {
              // For vendor: opposite of merchant logic
              if (debitCredit.toLowerCase() === 'sent') {
                finalAmount = Math.abs(amount); // ADD for SENT
              } else if (debitCredit.toLowerCase() === 'received') {
                finalAmount = -Math.abs(amount); // DEDUCT for RECEIVED
              }
            }
          }
          logger.info(
            `Processing REVERSED settlement: ID=${settlement.id}, amount=${finalAmount}, role=${role} (created_date ≠ updated_date)`,
          );
        }
      }

      // Apply the settlement if it should be processed
      if (shouldProcess && finalAmount !== 0) {
        // Handle internal method for vendor role specially
        if (
          settlement.method?.toLowerCase() === 'internal' &&
          role === Role.VENDOR &&
          status === Status.REVERSED
        ) {
          // For vendor role with internal reversals, keep them in settlements
          settlementData.total_settlement_count += 1;
          settlementData.total_settlement_amount += finalAmount;
          settlementData.total_settlement_commission += commission;
        } else if (
          settlement.method?.toLowerCase() === 'internal' &&
          status === Status.REVERSED
        ) {
          // For non-vendor roles, add internal reversals to payin
          settlementData.reversed_internal_settlements.count += 1;
          settlementData.reversed_internal_settlements.amount +=
            Math.abs(amount);
          settlementData.reversed_internal_settlements.commission += commission;
        } else {
          // Standard settlement processing
          settlementData.total_settlement_count += 1;
          settlementData.total_settlement_amount += finalAmount;
          settlementData.total_settlement_commission += commission;

          // Map settlement amounts by method type
          const methodKey = settlement.method?.toLowerCase();
          switch (methodKey) {
            case 'bank':
              settlementData.settlement_details.total_bankSettlement_amount +=
                finalAmount;
              break;
            case 'aed_sent':
              settlementData.settlement_details.total_aedSentSettlement_amount +=
                finalAmount;
              break;
            case 'bank_sent':
              settlementData.settlement_details.total_bankSentSettlement_amount +=
                finalAmount;
              break;
            case 'cash_sent':
              settlementData.settlement_details.total_cashSentSettlement_amount +=
                finalAmount;
              break;
            case 'internal':
              settlementData.settlement_details.total_internalSettlement_amount +=
                finalAmount;
              break;
            case 'aed_received':
              settlementData.settlement_details.total_aedReceivedSettlement_amount +=
                finalAmount;
              break;
            case 'bank_received':
              settlementData.settlement_details.total_bankReceivedSettlement_amount +=
                finalAmount;
              break;
            case 'cash_received':
              settlementData.settlement_details.total_cashReceivedSettlement_amount +=
                finalAmount;
              break;
            case 'internal_bank':
              settlementData.settlement_details.total_internalBankSettlement_amount +=
                finalAmount;
              break;
            case 'crypto_received':
              settlementData.settlement_details.total_cryptoReceivedSettlement_amount +=
                finalAmount;
              break;
          }
        }
      }
    });

    return settlementData;
  } catch (error) {
    logger.error('Error calculating settlement data:', error);
    throw error;
  }
};

// Helper function to calculate chargeback data for a user and date range
const calculateChargebackDataDao = async (
  user_id,
  company_id,
  startDate,
  conn = null,
) => {
  try {
    // Get user's role to determine which user_id field to use
    const userRole = await getUserRoleDao(user_id, conn);

    let whereClause;
    if (userRole === Role.MERCHANT) {
      whereClause = `merchant_user_id = $1`;
    } else {
      whereClause = `vendor_user_id = $1`;
    }

    // Use IST timezone conversion for created_at field
    const query = `
      SELECT 
        COUNT(*) as count,
        COALESCE(SUM(amount), 0) as total_amount
      FROM "${tableName.CHARGE_BACK}"
      WHERE ${whereClause}
        AND company_id = $2
        AND is_obsolete = false
        AND (created_at)::date = $3::date
    `;

    const result = conn
      ? await conn.query(query, [user_id, company_id, startDate])
      : await executeQuery(query, [user_id, company_id, startDate]);
    const row = result.rows[0];

    return {
      total_chargeback_count: parseInt(row?.count || 0),
      total_chargeback_amount: parseFloat(row?.total_amount || 0),
    };
  } catch (error) {
    logger.error('Error calculating chargeback data:', error);
    throw error;
  }
};

// Helper function to calculate adjustment data for a user and date range
// Only counts entries where specific field amounts are changed on the processing date
// Returns the difference between current and previous amounts from config.history
const calculateAdjustmentDataDao = async (
  user_id,
  company_id,
  startDate,
  conn = null,
) => {
  try {
    // Get user's role to determine which table to query
    const userRole = await getUserRoleDao(user_id, conn);

    let query, queryParams;

    if (userRole === Role.MERCHANT) {
      // Get all payin records that have history entries for the calculation date
      const getPayinRecordsQuery = `
        SELECT 
          p.id,
          p.amount as current_amount,
          p.payin_merchant_commission as current_commission,
          p.config->'history' as history
        FROM "${tableName.PAYIN}" p
        JOIN "${tableName.MERCHANT}" m ON p.merchant_id = m.id
        WHERE m.user_id = $1
          AND m.is_enabled = true
          AND p.company_id = $2
          AND p.is_obsolete = false
          AND p.status = 'SUCCESS'
          AND p.config->'history' IS NOT NULL
          AND jsonb_array_length((p.config->'history')::jsonb) > 0
          AND EXISTS (
            SELECT 1 FROM jsonb_array_elements((p.config->'history')::jsonb) AS entry
            WHERE DATE((entry->>'updated_at')::timestamp) = $3::date
          )
      `;

      const payinRecords = conn
        ? await conn.query(getPayinRecordsQuery, [
            user_id,
            company_id,
            startDate,
          ])
        : await executeQuery(getPayinRecordsQuery, [
            user_id,
            company_id,
            startDate,
          ], conn);

      let totalAdjustmentCount = 0;
      let totalAmountDifference = 0;
      let totalCommissionDifference = 0;

      // Process each payin record individually
      for (const record of payinRecords.rows) {
        const history = record.history || [];

        // Sort history by updated_at
        const sortedHistory = history.sort(
          (a, b) => new Date(a.updated_at) - new Date(b.updated_at),
        );

        // Find entries for the calculation date
        const entriesForDate = sortedHistory.filter((entry) => {
          const entryDate = new Date(entry.updated_at)
            .toISOString()
            .split('T')[0];
          const calcDate = new Date(startDate).toISOString().split('T')[0];
          return entryDate === calcDate;
        });

        if (entriesForDate.length === 0) continue;

        // Find the most recent entry before the calculation date
        const prevEntries = sortedHistory.filter((entry) => {
          const entryDate = new Date(entry.updated_at)
            .toISOString()
            .split('T')[0];
          const calcDate = new Date(startDate).toISOString().split('T')[0];
          return entryDate < calcDate;
        });

        const mostRecentPrevEntry =
          prevEntries.length > 0 ? prevEntries[prevEntries.length - 1] : null;

        // Calculate differences for each entry on the calculation date
        for (let i = 0; i < entriesForDate.length; i++) {
          const currentEntry = entriesForDate[i];
          let prevAmount, prevCommission;

          if (i === 0) {
            // First entry for the day: compare with most recent previous day entry or current values
            if (mostRecentPrevEntry) {
              prevAmount = parseFloat(mostRecentPrevEntry.amount || 0);
              prevCommission = parseFloat(
                mostRecentPrevEntry.payin_merchant_commission || 0,
              );
            } else {
              prevAmount = parseFloat(record.current_amount || 0);
              prevCommission = parseFloat(record.current_commission || 0);
            }
          } else {
            // Subsequent entries: compare with previous entry in same day
            prevAmount = parseFloat(entriesForDate[i - 1].amount || 0);
            prevCommission = parseFloat(
              entriesForDate[i - 1].payin_merchant_commission || 0,
            );
          }

          const currentAmount = parseFloat(currentEntry.amount || 0);
          const currentCommission = parseFloat(
            currentEntry.payin_merchant_commission || 0,
          );

          const amountDiff = currentAmount - prevAmount;
          const commissionDiff = currentCommission - prevCommission;

          if (amountDiff !== 0 || commissionDiff !== 0) {
            totalAdjustmentCount++;
            totalAmountDifference += amountDiff;
            totalCommissionDifference += commissionDiff;
          }
        }
      }

      return {
        total_adjustment_count: totalAdjustmentCount,
        total_adjustment_amount: totalAmountDifference,
        total_adjustment_commission: totalCommissionDifference,
      };
    } else {
      // Query for vendor role - extract amount differences from config.previousAmount and calculate commission manually
      query = `
        SELECT 
          COUNT(*) as count,
          COALESCE(SUM(
            CASE 
              WHEN br.config->>'previousAmount' IS NOT NULL THEN
                br.amount - COALESCE((br.config->>'previousAmount')::NUMERIC, 0)
              ELSE 
                0
            END
          ), 0) as amount_difference,
          COALESCE(SUM(
            CASE 
              WHEN br.config->>'previousAmount' IS NOT NULL THEN
                (br.amount * COALESCE(v.payin_commission, 0) / 100) - 
                (COALESCE((br.config->>'previousAmount')::NUMERIC, 0) * COALESCE(v.payin_commission, 0) / 100)
              ELSE 
                0
            END
          ), 0) as commission_difference
        FROM "${tableName.BANK_RESPONSE}" br
        JOIN "${tableName.BANK_ACCOUNT}" ba ON br.bank_id = ba.id
        JOIN "${tableName.VENDOR}" v ON ba.user_id = v.user_id
        WHERE ba.user_id = $1
          AND br.company_id = $2
          AND br.is_obsolete = false
          AND DATE(br.updated_at) = $3::date
          AND DATE(br.created_at) < $3::date
          AND br.status = '/success'
          AND br.config->>'previousAmount' IS NOT NULL
      `;
      queryParams = [user_id, company_id, startDate];

      const result = conn
        ? await conn.query(query, queryParams)
        : await executeQuery(query, queryParams, conn);
      const row = result.rows[0];

      return {
        total_adjustment_count: parseInt(row?.count || 0),
        total_adjustment_amount: parseFloat(row?.amount_difference || 0),
        total_adjustment_commission: parseFloat(
          row?.commission_difference || 0,
        ),
      };
    }
  } catch (error) {
    logger.error('Error calculating adjustment data:', error);
    logger.error('Error details:', {
      user_id,
      company_id,
      startDate,
      error: error.message,
      stack: error.stack,
    });
    // Return default values if there's an error
    return {
      total_adjustment_count: 0,
      total_adjustment_amount: 0,
      total_adjustment_commission: 0,
    };
  }
};

/**
 * Batch update net_balance for multiple calculation entries in a single query.
 * @param {Array<{id: string, net_balance: number}>} updates - Array of {id, net_balance} objects
 * @param {Object} conn - Database connection
 * @returns {Promise<number>} - Number of rows updated
 */
export const batchUpdateTodayNetBalanceDao = async (updates, conn = null) => {
  if (!updates || updates.length === 0) return 0;

  try {
    // Build VALUES clause for batch update
    const values = updates
      .map((u, i) => `($${i * 2 + 1}::text, $${i * 2 + 2}::numeric)`)
      .join(', ');

    const params = updates.flatMap((u) => [u.id, u.net_balance]);

    const sql = `
      UPDATE "${tableName.CALCULATION}" AS c
      SET net_balance = v.net_balance + c.current_balance
      FROM (VALUES ${values}) AS v(id, net_balance)
      WHERE c.id = v.id
    `;

    const result = await executeQuery(sql, params, conn);
    return result.rowCount || updates.length;
  } catch (error) {
    logger.error('Failed to batch update net_balance:', error.message);
    throw error;
  }
};

/**
 * Batch insert calculation entries in a single query.
 * @param {Array<Object>} entries - Array of calculation data objects
 * @param {Object} conn - Database connection
 * @returns {Promise<number>} - Number of rows inserted
 */
export const batchCreateCalculationDao = async (entries, conn = null) => {
  if (!entries || entries.length === 0) return 0;

  try {
    const columns = ['user_id', 'role_id', 'company_id', 'net_balance', 'created_at'];
    const placeholders = entries
      .map((_, i) => `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`)
      .join(', ');

    const params = entries.flatMap((e) => [
      e.user_id,
      e.role_id,
      e.company_id,
      e.net_balance,
      e.created_at,
    ]);

    const sql = `
      INSERT INTO "${tableName.CALCULATION}" (${columns.join(', ')})
      VALUES ${placeholders}
    `;

    const result = await executeQuery(sql, params, conn);
    return result.rowCount || entries.length;
  } catch (error) {
    logger.error('Failed to batch create calculations:', error.message);
    throw error;
  }
};

export {
  getCalculationDao,
  createCalculationDao,
  updateCalculationDao,
  deleteCalculationDao,
  checkCalculationEntryForDateDao,
  updateCalculationConfigDao,
  getMerchantNetBalanceDao,
  getVendorNetBalanceDao,
  calculatePayinDataDao,
  calculatePayoutDataDao,
  calculateSettlementDataDao,
  calculateChargebackDataDao,
  calculateAdjustmentDataDao,
  getUserRoleDao,
};
