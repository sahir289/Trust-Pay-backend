import {
  buildInsertQuery,
  buildJoinQuery,
  buildSelectQuery,
  buildUpdateQuery,
  executeQuery,
} from '../../utils/db.js';
import { tableName } from '../../constants/index.js';
import { buildSearchFilterObj } from '../../utils/searchBuilder.js';

const getSettlementDao = async (
  filters,
  page,
  pageSize,
  sortBy,
  sortOrder,
  // columns to select from db (optional)
  columns = [],
) => {
  try {
    const { USER, SETTLEMENT, ROLE } = tableName;
    const joins = [
      {
        table: USER,
        keys: ['user_id', 'id'],
        type: 'JOIN',
        columns: ['role_id', 'designation_id'],
        columnAs: [`"${USER}".id AS user_table_id`],
      },
      {
        table: ROLE,
        keys: [`role_id`, 'id'],
        type: 'LEFT JOIN',
        columns : ['role'],
        referenceTable: USER,
      },
    ];
    let baseQuery = buildJoinQuery(
      SETTLEMENT,
      columns,
      joins,
    );
    if (filters.search) {
      filters.or = buildSearchFilterObj(filters.search, SETTLEMENT);
      delete filters.search;
    }
    if (filters.role) {
      baseQuery += ` AND "${ROLE}".role = '${filters.role}'`
      delete filters.role; 
    }
    let [sql, queryParams] = buildSelectQuery(
      baseQuery,
      filters,
      page,
      pageSize,
      sortBy,
      sortOrder,
      tableName.SETTLEMENT,
    );
    // Execute query
    const result = await executeQuery(sql, queryParams);
    return result.rows;
  } catch (error) {
    console.error('Error in getMerchantsDao:', error);
    throw error.message;
  }
};
// const settlementJoindao = async (
//   baseTable,
//   filters,
//   page,
//   pageSize,
//   sortBy,
//   sortOrder,
//   columns = [],
// ) => {
//   const baseQuery = `SELECT ${columns.length ? columns.join(', ') : "*"} FROM "${tableName.MERCHANT}" WHERE 1=1`;
//   const [sql, queryParams] = await buildJoinQuery(baseTable, filters, baseQuery, page, pageSize, sortBy, sortOrder);
//   const result = await executeQuery(sql, queryParams);
//   return result.rows;
// };

const getSettlementDaoforInternalTransfer = async (utr, method) => {
  try {
    let baseQuery = `SELECT id, user_id, status, amount, method, config, approved_at, rejected_at, created_by, created_at, updated_at, company_id, is_obsolete, updated_by FROM "${tableName.SETTLEMENT}"
 WHERE config->>'reference_id' = $1 AND method = ANY($2)`;

    const queryParams = [utr, method];
    const result = await executeQuery(baseQuery, queryParams);
    return result.rows.length > 0 ? result.rows : result.rows[0];
  } catch (error) {
    console.error(error);
    throw error.message;
  }
};

const createSettlementDao = async (payload) => {
  try {
    const [sql, params] = buildInsertQuery(tableName.SETTLEMENT, payload);
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    console.error(error);
    throw error.message;
  }
};

const updateSettlementDao = async (conn, id, data) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.SETTLEMENT, data, id);
    let result;
    if (conn && conn.query) {
      result = await conn.query(sql, params); // Use connection to execute query
    } else {
      result = await executeQuery(sql, params); // Use executeQuery if no connection
    }

    return result.rows[0];
  } catch (error) {
    console.error(error);
    throw error.message;
  }
};

const deleteSettlementDao = async (conn, id, data) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.SETTLEMENT, data, id);
    let result;
    if (conn && conn.query) {
      result = await conn.query(sql, params); // Use connection to execute query
    } else {
      result = await executeQuery(sql, params); // Use executeQuery if no connection
    }

    return result.rows[0];
  } catch (error) {
    console.error(error);
    throw error.message;
  }
};

export {
  getSettlementDao,
  createSettlementDao,
  getSettlementDaoforInternalTransfer,
  updateSettlementDao,
  deleteSettlementDao,
};
