import { buildInsertQuery, buildJoinQuery, buildSelectQuery, buildUpdateQuery, executeQuery, getConnection } from '../../utils/db.js';
import { tableName } from "../../constants/index.js";

const getSettlementDao = async (
  filters,
  page,
  pageSize,
  sortBy,
  sortOrder,
) => {
  const baseQuery = `SELECT id, user_id, status, amount, method, config, approved_at, rejected_at, created_by, created_at, updated_at, company_id, is_obsolete, updated_by FROM "${tableName.SETTLEMENT}" WHERE 1=1`;
  const [sql, queryParams] = buildSelectQuery(baseQuery, filters, page, pageSize, sortBy, sortOrder);
  const result = await executeQuery(sql, queryParams);
    return result.rows.length > 0 ? result.rows : result.rows[0];

};

const settlementJoindao = async (
  baseTable,
  filters,
  page,
  pageSize,
  sortBy,
  sortOrder
) => {
  const baseQuery = `SELECT id, user_id, status, amount, method, config FROM public."${baseTable}"`;
  const [sql, queryParams] = await buildJoinQuery(baseTable, filters, baseQuery, page, pageSize, sortBy, sortOrder);
  const result = await executeQuery(sql, queryParams);
  return result.rows;
};


const getSettlementDaoforInternalTransfer = async (utr, method) => {
  let conn;
  conn = await getConnection();
  let baseQuery = `SELECT id, user_id, status, amount, method, config, approved_at, rejected_at, created_by, created_at, updated_at, company_id, is_obsolete, updated_by FROM "${tableName.SETTLEMENT}"
 WHERE config->>'reference_id' = $1 AND method = ANY($2)`

  const queryParams = [utr, method];
  const result = await conn.query(baseQuery, queryParams);
  return result.rows.length > 0 ? result.rows : result.rows[0];}



const createSettlementDao = async (payload) => {
  try {
    const [sql, params] = buildInsertQuery(tableName.SETTLEMENT, payload);
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    console.error(error);
    throw error;
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

    return result;
  } catch (error) {
    console.error(error);
    throw error;
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

    return result.rows[0] ;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

export { getSettlementDao,  settlementJoindao, createSettlementDao, getSettlementDaoforInternalTransfer, updateSettlementDao, deleteSettlementDao };
