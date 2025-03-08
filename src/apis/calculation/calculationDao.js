import {
  executeQuery,
  buildSelectQuery,
  buildInsertQuery,
  buildUpdateQuery,
  buildJoinQuery,
} from '../../utils/db.js';
import { Role, tableName } from '../../constants/index.js';
// import { buildSearchFilterObj } from '../../utils/searchBuilder.js';
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
    const role = filters.role;

    // scenarios for super admin
    if(role && role === Role.SUPER_ADMIN){
      delete filters.company_id;
      delete filters.user_id;
    }

    // scenarios for admin
    if(role && role === Role.ADMIN){
      // filter object must have company_id to bind the result
      delete filters.user_id;
    }
    
    // scenarios for merchant admin
    if (role && [Role.MERCHANT_ADMIN].includes(role)) {
      
      delete filters.user_id;
      
      if(filters.users){
        filters.user_id = filters.users;
        delete filters.users;
      }

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

      baseQuery += ` AND "${tableName.ROLE}".role = '${Role.MERCHANT}'`;

      // edge case merhcant can only see its sub merchants and its own calculations
    }

    // don't think so we can search this
    // if (filters.search) {
    //   filters.or = buildSearchFilterObj(filters.search, tableName.MERCHANT);
    //   delete filters.search;
    // }
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
