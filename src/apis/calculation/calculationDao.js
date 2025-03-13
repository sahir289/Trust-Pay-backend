import {
  executeQuery,
  buildSelectQuery,
  buildInsertQuery,
  buildUpdateQuery,
  buildJoinQuery,
} from '../../utils/db.js';
import { Role, tableName } from '../../constants/index.js';
import { getUserHierarchysDao } from '../userHierarchy/userHierarchyDao.js';
import { NotFoundError } from '../../utils/appErrors.js';

const getCalculationDao = async (
  filters,
  page,
  pageSize,
  sortBy,
  sortOrder,
  columns = [],
) => {
  try {

    // if simple user is querying then filter object must have user_id to bind result
    let baseQuery = `SELECT ${columns.length ? columns.join(', ') : '*'} FROM "${tableName.CALCULATION}" WHERE 1=1`;
    const { role, designation, startDate, endDate, includeSubVendors, includeSubMerchant, user_id } = filters;
    let users = filters.users || "";
    delete filters.designation;
    delete filters.users;
    delete filters.role;
    delete filters.startDate;
    delete filters.endDate;
    users = users.split(",");

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
    if (role && designation && [Role.MERCHANT_ADMIN, Role.VENDOR_ADMIN].includes(designation) && (includeSubMerchant || includeSubVendors)) {
      delete filters.user_id;
      const roleToMatch = role === Role.MERCHANT_ADMIN ? Role.MERCHANT : Role.VENDOR;

      baseQuery = buildJoinQuery(tableName.CALCULATION, columns.length ? columns : "*", [
        {
          table: tableName.USER,
          keys: ['user_id', 'id'],
          columns: ['role_id']
        },
        {
          table: tableName.ROLE,
          keys: ['role_id', 'id'],
          columns: ['role'],
          referenceTable: tableName.USER,
        }
      ])

      baseQuery += ` AND "${tableName.ROLE}".role = '${roleToMatch}'`;

      if (includeSubMerchant || includeSubVendors || users.length) {
        const heirarchy = await getUserHierarchysDao({ user_id });
        if (!heirarchy) {
          throw NotFoundError('Sub Merchants not found!');
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
      baseQuery += ` AND created_at BETWEEN '${new Date(startDate).toISOString()}'::TIMESTAMPTZ AND '${new Date(endDate).toISOString()}'::TIMESTAMPTZ`
    }

    console.log(baseQuery, startDate, endDate)

    const [sql, queryParams] = buildSelectQuery(
      baseQuery,
      filters,
      page,
      pageSize,
      sortBy,
      sortOrder,
      tableName.CALCULATION
    );
    // Execute query
    const result = await executeQuery(sql, queryParams);
    return result.rows;
  } catch (error) {
    console.error('Error fetching Calculation', error);
    throw error.message;
  }
};

export const getCalculationsSumDao = async (filters) => {
  const {
    role,
    designation,
    startDate,
    endDate,
    includeSubVendors,
    includeSubMerchant,
    user_id,
    users,
    company_id
  } = filters;

  let vendorData = {}, merchantData = {}, latestCalculation = {};
  let hierarchyUsers = [], userCodes = users ? users.split(", ") : [];
  const checkForHierarchy = [Role.MERCHANT_ADMIN, Role.VENDOR_ADMIN].includes(designation);

  // Fetch hierarchy users if applicable
  if (designation && checkForHierarchy && (includeSubMerchant || includeSubVendors)) {
    const hierarchy = await getUserHierarchysDao({ user_id });
    if (!hierarchy) throw NotFoundError('Sub Merchants not found!');
    hierarchyUsers = hierarchy.config[user_id] || [];
  }

  // Base Query for Aggregated Calculations
  let baseQuery = `
    SELECT 
      COALESCE(SUM(c.total_payin_count), 0) AS total_payin_count,
      COALESCE(SUM(c.total_payin_amount), 0) AS total_payin_amount,
      COALESCE(SUM(c.total_payin_commission), 0) AS total_payin_commission,
      COALESCE(SUM(c.total_payout_count), 0) AS total_payout_count,
      COALESCE(SUM(c.total_payout_amount), 0) AS total_payout_amount,
      COALESCE(SUM(c.total_payout_commission), 0) AS total_payout_commission,
      COALESCE(SUM(c.total_settlement_count), 0) AS total_settlement_count,
      COALESCE(SUM(c.total_settlement_amount), 0) AS total_settlement_amount,
      COALESCE(SUM(c.total_chargeback_count), 0) AS total_chargeback_count,
      COALESCE(SUM(c.total_chargeback_amount), 0) AS total_chargeback_amount,
      COALESCE(SUM(c.total_reverse_payout_count), 0) AS total_reverse_payout_count,
      COALESCE(SUM(c.total_reverse_payout_amount), 0) AS total_reverse_payout_amount,
      COALESCE(SUM(c.total_reverse_payout_commission), 0) AS total_reverse_payout_commission,
      COALESCE(SUM(c.current_balance), 0) AS current_balance
    FROM "${tableName.CALCULATION}" c
    JOIN "${tableName.USER}" u ON c.user_id = u.id AND u.is_obsolete = FALSE
    JOIN "${tableName.ROLE}" r ON u.role_id = r.id
    WHERE c.is_obsolete = FALSE
  `;

  // Add Date Filter
  if (startDate && endDate) {
    baseQuery += ` AND c.created_at BETWEEN '${startDate}' AND '${endDate}' `;
  }

  // Queries for Different Roles
  let merchantQuery = `${baseQuery} AND r.role = 'MERCHANT' `;
  let vendorQuery = `${baseQuery} AND r.role = 'VENDOR' `;

  // Include hierarchy filtering (match against `code` column)
  if (hierarchyUsers.length ) {
    merchantQuery += `
      AND EXISTS (
        SELECT 1 FROM merchant m
        WHERE m.user_id = ANY(${hierarchyUsers})
      )`;

    vendorQuery += `
      AND EXISTS (
        SELECT 1 FROM vendor v
        WHERE v.user_id = ANY(${hierarchyUsers})
      )`;
  }

  if (userCodes.length) {
    merchantQuery += ` AND v.code = ANY(${userCodes}) `;
    vendorQuery += ` AND v.code = ANY(${userCodes}) `;
  }

  // Role-Based Execution
  if (Role.ADMIN === role) {
    merchantData = (await executeQuery(`${merchantQuery}  AND c.company_id = '${company_id}' AND u.company_id = '${company_id}'`, [])).rows[0];
    vendorData = (await executeQuery(`${vendorQuery}  AND c.company_id = '${company_id}' AND u.company_id = '${company_id}'`, [])).rows[0];
  }

  // Role-Based Execution
  if (Role.ADMIN === role) {
    merchantData = (await executeQuery(merchantQuery, [])).rows[0];
    vendorData = (await executeQuery(vendorQuery, [])).rows[0];
  }

  if (role === Role.MERCHANT) {
    merchantData = (await executeQuery(`${merchantQuery}  AND c.user_id = $1  AND c.company_id = $2`, [user_id, company_id])).rows[0];
  }

  if (role === Role.VENDOR) {
    vendorData = (await executeQuery(`${vendorQuery}  AND c.user_id = $1  AND c.company_id = $2`, [user_id, company_id])).rows[0];
  }

  // Fetch Latest Calculation Entry for Vendors & Merchants
  const endDateConditon = endDate ? ` AND DATE(created_at) = '${endDate}' ` : "";
  let vendorCalQuery = `
      SELECT net_balance AS net_balance_sum
      FROM "${tableName.CALCULATION}" c
      JOIN "${tableName.USER}" u ON c.user_id = u.id AND u.is_obsolete = FALSE
      JOIN "${tableName.ROLE}" r ON u.role_id = r.id AND r.role = '${Role.VENDOR}'
      WHERE c.is_obsolete = FALSE 
      AND c.user_id = '${user_id}'
      AND c.company_id = '${company_id}'
      ${endDateConditon}
      ORDER BY c.created_at DESC LIMIT 1
    `,
    merchantCalQuery = `
      SELECT net_balance AS net_balance_sum
      FROM "${tableName.CALCULATION}" c
      JOIN "${tableName.USER}" u ON c.user_id = u.id AND u.is_obsolete = FALSE
      JOIN "${tableName.ROLE}" r ON u.role_id = r.id AND r.role = '${Role.MERCHANT}'
      WHERE c.is_obsolete = FALSE 
      AND c.user_id = '${user_id}'
      AND c.company_id = '${company_id}'
      ${endDateConditon}
      ORDER BY c.created_at DESC LIMIT 1
    `;

  if ([Role.SUPER_ADMIN, Role.ADMIN].includes(role)) {
    const condition = role === Role.ADMIN ? ` AND c.company_id = '${company_id}' ${endDateConditon} ` : ` ${endDateConditon} `;
    vendorCalQuery = `
    WITH LatestEntries AS (
      SELECT DISTINCT ON (user_id) *
      FROM "Calculation" c
      JOIN "${tableName.USER}" u ON c.user_id = u.id AND u.is_obsolete = FALSE
      JOIN "${tableName.ROLE}" r ON u.role_id = r.id AND r.role = '${Role.VENDOR}'
      WHERE c.is_obsolete = FALSE
      ${condition}
      ORDER BY c.user_id, c.created_at DESC
    )
    SELECT 
        SUM(net_balance) AS net_balance_sum
    FROM LatestEntries;`;

    merchantCalQuery = `
    WITH LatestEntries AS (
      SELECT DISTINCT ON (user_id) *
      FROM "Calculation" c
      JOIN "${tableName.USER}" u ON c.user_id = u.id AND u.is_obsolete = FALSE
      JOIN "${tableName.ROLE}" r ON u.role_id = r.id AND r.role = '${Role.MERCHANT}'
      WHERE c.is_obsolete = FALSE
      ${condition}
      ORDER BY c.user_id, c.created_at DESC
    )
    SELECT 
        SUM(net_balance) AS net_balance_sum
    FROM LatestEntries;`;
  }

  vendorData.sum_net_balance = (await executeQuery(vendorCalQuery)).rows[0]?.net_balance_sum || 0;
  merchantData.sum_net_balance = (await executeQuery(merchantCalQuery)).rows[0]?.net_balance_sum || 0;

  return {
    vendor: vendorData,
    merchant: merchantData,
    calculation: latestCalculation,
  };
};

////for cron job to update net_balance
export const getCalculationforCronDao = async (userId) => {
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
    const result = await executeQuery(sql, [userId]);
    return result.rows;
  } catch (error) {
    console.error('Error fetching Calculation', error);
    throw error.message;
  }
};

const createCalculationDao = async (conn, data) => {
  try {
    const [sql, params] = buildInsertQuery(tableName.CALCULATION, data);
    let result;
    if (conn && conn.query) {
      result = await conn.query(sql, params);
    } else {
      result = await executeQuery(sql, params);
    }
    return result.rows ? result.rows[0] : result[0]; // Return the first row or result based on the structure
  } catch (error) {
    console.error('Error creating calculation:', error); // Log the error for debugging
    throw error.message;
  }
};

// if (data.chargeback_amount) {
//   updatedData.total_chargeback_count = Number(previousData.total_chargeback_count) + 1;
//   updatedData.total_chargeback_amount = Number(previousData.total_chargeback_amount) + Number(data.chargeback_amount);
//   updatedData.current_balance = Number(previousData.current_balance) - Number(data.chargeback_amount);
// }
const updateCalculationDao = async (conn, id, data) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.CALCULATION, data, id);
    let result;
    if (conn && conn.query) {
      result = await conn.query(sql, params); // Use connection to execute query
    } else {
      result = await executeQuery(sql, params); // Use executeQuery if no connection
    }

    return result.rows ? result.rows[0] : result[0]; // Return the first row or result based on the structure
  } catch (error) {
    console.error('Error updating calculation:', error); // Log the error for debugging
    throw error.message;
  }
};

const deleteCalculationDao = async (conn, id, data) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.CALCULATION, data, id);

    let result;
    if (conn && conn.query) {
      result = await conn.query(sql, params); // Use connection to execute query
    } else {
      result = await executeQuery(sql, params); // Use executeQuery if no connection
    }

    return result.rows ? result.rows[0] : result[0]; // Return the first row or result based on the structure
  } catch (error) {
    console.error('Error deleting calculation:', error);
    throw error.message;
  }
};

export const updateCalculationBalanceDao = async (filters, data, conn) => {
  try {
    const specialFields = {};
    Object.keys(data).forEach((el) => {
      specialFields[el] = '+';
    });
    const [sql, params] = buildUpdateQuery(
      tableName,
      data,
      filters,
      specialFields,
    );
    if (conn && conn.query) {
      const result = await conn.query(sql, params);
      return result.rows[0];
    }
    const result = await executeQuery(sql, params);
    return result[0];
  } catch (error) {
    console.error('Error updating calculation:', error);
    throw error.message;
  }
};

export {
  getCalculationDao,
  createCalculationDao,
  updateCalculationDao,
  deleteCalculationDao,
};
