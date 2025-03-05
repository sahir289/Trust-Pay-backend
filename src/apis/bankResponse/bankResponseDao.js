import { tableName } from '../../constants/index.js';
import { DbError } from '../../utils/appErrors.js';
// import { generateUUID } from '../utils/generateUUID.js';

import {
  executeQuery,
  buildSelectQuery,
  buildInsertQuery,
  buildUpdateQuery,
} from '../../utils/db.js';
import { generateUUID } from '../../utils/generateUUID.js';
import { buildSearchFilterObj } from '../../utils/searchBuilder.js';

const getBankResponseDao = async (
  filters,
  startDate,
  endDate,
  page,
  pageSize,
  sortBy,
  sortOrder,
  columns = [],
) => {
  try
  {  
    let baseQuery = `SELECT ${columns.length ? columns.join(', ') : '*'} FROM "${tableName.BANK_RESPONSE}" WHERE 1=1`;
    if (filters.search) {
      filters.or = buildSearchFilterObj(filters.search, tableName.BANK_RESPONSE);
      delete filters.search;
    }
    const [sql, queryParams] = buildSelectQuery(
      baseQuery,
      filters,
      page,
      pageSize,
      sortBy,
      sortOrder,
    );
  if (startDate && endDate) {
    baseQuery += ` AND created_at BETWEEN $${Object.keys(queryParams).length + 1} AND $${Object.keys(queryParams).length + 2}`;
    queryParams[`created_at_start`] = startDate;
    queryParams[`created_at_end`] = endDate;
  }
  const result = await executeQuery(sql, queryParams);
  return result.rows[0];
}
  catch{
    DbError("Error executing query")
  }
};
const getBankResponseDaoAll = async (
  filters,
  page,
  pageSize,
  sortBy,
  sortOrder,
  columns = []
) => {
  try
  {
    let baseQuery = `SELECT ${columns.length ? columns.join(', ') : '*'} FROM "${tableName.BANK_RESPONSE}" WHERE 1=1`;
  //TODO: columns.BANK_RESPONSE dynamic search
  const [sql, queryParams] = buildSelectQuery(
    baseQuery,
    filters,
    page,
    pageSize,
    sortBy,
    sortOrder,
    "BankResponse"
  );
  const result = await executeQuery(sql, queryParams);
  return result.rows;
}
  catch{
    DbError("Error executing query")
  }
};

const createBankResponseDao = async (data) => {
  try {
    data.id = generateUUID();
    const [sql, params] = buildInsertQuery(tableName.BANK_RESPONSE, data);
    const result = await executeQuery(sql, params);
    return result.rows[0];
  }

  catch {
    DbError("Error executing query")
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
  }
  catch {
    DbError("Error executing query")
  }
};

const resetBankResponseDao = async (id, data) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.BANK_RESPONSE, data, { id });
    const result = await executeQuery(sql, params);
    return result.rows[0];
  }
  catch {
    DbError("Error executing query")
  }
};

const updateBotResponseDao = async (id, data) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.BANK_RESPONSE, data, { id });
    const result = await executeQuery(sql, params);
    return result.rows[0];
  }
  catch {
    DbError("Error executing query")
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
