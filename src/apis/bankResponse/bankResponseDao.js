
import { tableName } from "../../constants/index.js";
// import { generateUUID } from '../utils/generateUUID.js';

import { executeQuery, buildSelectQuery, buildInsertQuery, buildUpdateQuery } from "../../utils/db.js";
import { generateUUID } from "../../utils/generateUUID.js";




const getBankResponseDao = async (
  filters,
  page,
  pageSize,
  sortBy,
  sortOrder) => {

  const baseQuery = `SELECT * FROM "${tableName.BANK_RESPONSE}" WHERE 1=1`;
  //TODO: columns.BANK_RESPONSE dynamic search
  const [sql, queryParams] = buildSelectQuery(baseQuery, filters, page, pageSize, sortBy, sortOrder);
  // Execute query
  const result = await executeQuery(sql, queryParams);
  return result.rows[0];

};
const getBankResponseDaoAll = async (
  filters,
  page,
  pageSize,
  sortBy,
  sortOrder) => {

  const baseQuery = `SELECT * FROM "${tableName.BANK_RESPONSE}" WHERE 1=1`;
  //TODO: columns.BANK_RESPONSE dynamic search
  const [sql, queryParams] = buildSelectQuery(baseQuery, filters, page, pageSize, sortBy, sortOrder);
  // Execute query
  const result = await executeQuery(sql, queryParams);
  return result.rows;

};



const createBankResponseDao = async (data) => {
  data.id = generateUUID();
  const [sql, params] = buildInsertQuery(tableName.BANK_RESPONSE, data)
  const result = await executeQuery(sql, params);
  return result.rows[0];
};


const getBankMessageDao = async ({ bank_id, startDate, endDate,
  page,
  pageSize,
  sortBy,
  sortOrder }) => {

  const baseQuery = `SELECT * FROM "${tableName.BANK_RESPONSE}" WHERE 1=1`;
  const filters = { bank_id };

  if (startDate && endDate) {
    filters["created_at"] = [startDate, endDate];
  }

  // TODO: i guess this API was only getting bank_id and created_at
  const [query, values] = buildSelectQuery(baseQuery, filters, page, pageSize, sortBy, sortOrder);  // Execute query
  const result = await executeQuery(query, values);
  console.log(result.rows, "123456789")
  return result.rows;

};



const resetBankResponseDao = async (id, data) => {
  const [sql, params] = buildUpdateQuery(tableName.BANK_RESPONSE, data, { id });
  const result = await executeQuery(sql, params);
  return result.rows[0];
}


const updateBotResponseDao = async (id, data) => {
  const [sql, params] = buildUpdateQuery(tableName.BANK_RESPONSE, data, { id });
  const result = await executeQuery(sql, params);

  return result.rows[0];
}


export { getBankResponseDao, createBankResponseDao, getBankResponseDaoAll, getBankMessageDao, resetBankResponseDao, updateBotResponseDao }
