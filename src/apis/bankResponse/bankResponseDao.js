import { tableName } from '../../constants/index.js';
import { InternalServerError } from '../../utils/appErrors.js';
// import { generateUUID } from '../utils/generateUUID.js';

import {
  executeQuery,
  buildSelectQuery,
  buildInsertQuery,
  buildUpdateQuery,
  buildJoinQuery,
} from '../../utils/db.js';
import { generateUUID } from '../../utils/generateUUID.js';
import { buildSearchFilterObj } from '../../utils/searchBuilder.js';

const getBankResponseDao = async (
  filters,
  startDate,
  endDate,
  page,
  pageSize,
  // sortBy,
  // sortOrder,
  columns = [],
) => {
  try {
    let baseQuery = `SELECT ${columns.length ? columns.join(', ') : '*'} FROM "${tableName.BANK_RESPONSE}" WHERE 1=1`;
    if (filters.search) {
      filters.or = buildSearchFilterObj(
        filters.search,
        tableName.BANK_RESPONSE,
      );
      delete filters.search;
    }
    const [sql, queryParams] = buildSelectQuery(
      baseQuery,
      filters,
      page,
      pageSize
    );
    if (startDate && endDate) {
      baseQuery += ` AND created_at BETWEEN $${Object.keys(queryParams).length + 1} AND $${Object.keys(queryParams).length + 2}`;
      queryParams[`created_at_start`] = startDate;
      queryParams[`created_at_end`] = endDate;
    }
    const result = await executeQuery(sql, queryParams);
    return result.rows[0];
  } catch {
    throw new InternalServerError('Error executing query');
  }
};

const getBankResponseDaoAll = async (
  filters,
  page,
  pageSize,
  sortBy,
  sortOrder,
  columns = [],
) => {
  try {
    const { BANK_ACCOUNT, BANK_RESPONSE, VENDOR } = tableName;
    const joins = [
      {
        table: BANK_ACCOUNT,
        // first is source key
        // second is target key
        keys: ['bank_id', 'id'],
        type: 'JOIN',
        columns: ['user_id', 'nick_name', 'bank_name'],
      },
      {
        table: VENDOR,
        // first is source key
        // second is target key
        keys: [`user_id`, 'user_id'],
        columns: ['code'],
        type: 'LEFT JOIN',
        referenceTable: BANK_ACCOUNT,
      },
    ];
    const baseQuery = buildJoinQuery(
      BANK_RESPONSE,
      columns.length ? columns : '*',
      joins,
    );
    console.log(baseQuery, 'baseQueryfiltersfilters');
    if (filters.search) {
      filters.or = buildSearchFilterObj(filters.search, BANK_ACCOUNT);
      delete filters.search;
    }
    const [sql, queryParams] = buildSelectQuery(
      baseQuery,
      filters,
      page,
      pageSize,
      sortBy,
      sortOrder,
      tableName.BANK_RESPONSE,
    );
    console.log(sql, queryParams, 'sqlqueryParams');
    const result = await executeQuery(sql, queryParams);
    return { totalCount: result.rows.length, rows: result.rows };
  } catch {
    throw new InternalServerError('Error executing query');
  }
};

const createBankResponseDao = async (conn, data) => {
  try {
    data.id = generateUUID();

    const [sql, params] = buildInsertQuery(tableName.BANK_RESPONSE, data);
    let result;
    if (conn && conn.query) {
      result = await conn.query(sql, params); // Use connection to execute query
    } else {
      result = await executeQuery(sql, params); // Use executeQuery if no connection
    }
    return result.rows[0];
  } catch {
    throw new InternalServerError('Error executing query');
  }
};

const getBankMessageDao = async (
  bank_id,
  startDate,
  endDate,
  company_id,
  // page,
  // pageSize,
  // sortBy,
  // sortOrder
) => {
  try {
    const query = `SELECT * FROM "BankResponse" 
      WHERE 1=1 
      AND "bank_id" = $1 
      AND is_obsolete = false 
      AND "created_at" BETWEEN $2 AND $3 
      AND "company_id" = $6
      ORDER BY "created_at" DESC 
      LIMIT $4 OFFSET $5`;
    const values = [bank_id, startDate, endDate, 10, 0, company_id];
    const result = await executeQuery(query, values);
    return result.rows;
  } catch {
    throw new InternalServerError('Error executing query');
  }
};

const resetBankResponseDao = async (id, data) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.BANK_RESPONSE, data, {
      id,
    });
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch {
    throw new InternalServerError('Error executing query');
  }
};

const updateBotResponseDao = async (id, data, conn) => {
  console.log(data,id);
  try {
    const [sql, params] = buildUpdateQuery(tableName.BANK_RESPONSE, data, {
      id,
    });
    let result;
    console.log(sql, params);
    if (conn && conn.query) {
      result = await conn.query(sql, params); // Use connection to execute query
    } else {
      result = await executeQuery(sql, params); // Use executeQuery if no connection
    }
    return result.rows[0];
  } catch {
    throw new InternalServerError('Error executing query');
  }
};

export {
  getBankResponseDao,
  createBankResponseDao,
  getBankResponseDaoAll,
  getBankMessageDao,
  resetBankResponseDao,
  updateBotResponseDao,
};
