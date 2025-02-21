
import { columns, tableName } from "../../constants/index.js";
// import { generateUUID } from '../utils/generateUUID.js';

import { executeQuery, buildSelectQuery, buildInsertQuery, buildUpdateQuery } from "../../utils/db.js";
import { generateUUID } from "../../utils/generateUUID.js";




const getBankResponseDao = async (search,
  page,
  pageSize,
  sortBy,
  sortOrder) => {

  const baseQuery = `SELECT * FROM "${tableName.BANK_RESPONSE}" WHERE 1=1`;
  const [sql, queryParams] = buildSelectQuery(baseQuery, search, columns.BANK_RESPONSE, page, pageSize, sortBy, sortOrder, typeof search != 'string');
  // Execute query
  const result = await executeQuery(sql, queryParams);
  return result.rows[0];

};
const getBankResponseDaoAll = async (search,
  page,
  pageSize,
  sortBy,
  sortOrder) => {

  const baseQuery = `SELECT * FROM "${tableName.BANK_RESPONSE}" WHERE 1=1`;
  const [sql, queryParams] = buildSelectQuery(baseQuery, search, columns.BANK_RESPONSE, page, pageSize, sortBy, sortOrder, typeof search != 'string');
  // Execute query
  const result = await executeQuery(sql, queryParams);
  return result.rows;

};





const createBankResponseDao = async (data) => {
  data.id = generateUUID();
  const [sql, params] = buildInsertQuery(tableName.BANK_RESPONSE, data)
  const result = await executeQuery(sql, params);
  console.log(sql, params, "0987654e4wsxrctvjknm")
  return result.rows[0];
};


const getBankMessageDao = async (search,
  page,
  pageSize,
  sortBy,
  sortOrder) => {

  const baseQuery = `SELECT * FROM "${tableName}" WHERE 1=1`;
  const [sql, queryParams] = buildSelectQuery(baseQuery, search, columns.BANK_RESPONSE, page, pageSize, sortBy, sortOrder, typeof search != 'string');
  // Execute query
  const result = await executeQuery(sql, queryParams);
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
