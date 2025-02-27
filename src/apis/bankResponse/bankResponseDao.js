
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
  console.log(sql, queryParams, "sdhjgdiuygbjchb")

  const result = await executeQuery(sql, queryParams);
  console.log(result, "sdhjgdsjchb")
  return result.rows;

};



const createBankResponseDao = async (data) => {
  data.id = generateUUID();
  const [sql, params] = buildInsertQuery(tableName.BANK_RESPONSE, data)
  const result = await executeQuery(sql, params);
  return result.rows[0];
};


const getBankMessageDao = async (bank_id, startDate, endDate, company_id,
  page,
  pageSize,
  sortBy,
  sortOrder) => {

  const query = `SELECT * FROM "BankResponse" 
WHERE 1=1 
AND "bank_id" = $1 
AND is_obsolete = false 
AND "created_at" BETWEEN $2 AND $3 
AND "company_id" = $6
ORDER BY "created_at" DESC 
LIMIT $4 OFFSET $5`
  const values = [bank_id, startDate, endDate, 10, 0, company_id]
  const result = await executeQuery(query, values);
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
