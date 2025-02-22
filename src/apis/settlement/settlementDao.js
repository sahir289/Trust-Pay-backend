import { buildInsertQuery, buildSelectQuery, buildUpdateQuery, executeQuery } from '../../utils/db.js';
import { columns, tableName } from "../../constants/index.js";

const getSettlementDao = async (
  search,user,
  page,
  pageSize,
  sortBy,
  sortOrder,
) => {
  const baseQuery = `SELECT * FROM "${tableName.SETTLEMENT}" WHERE 1=1`;
  const [sql, queryParams] = buildSelectQuery(baseQuery, search, columns.SETTLEMENT, page, pageSize, sortBy, sortOrder, typeof search != 'string', user);
  const result = await executeQuery(sql, queryParams);
  return result.rows[0];
};

const getSettlementDaoAll = async (
  search,user,
  page,
  pageSize,
  sortBy,
  sortOrder,
) => {
  const baseQuery = `SELECT * FROM "${tableName.SETTLEMENT}" WHERE 1=1`;
  const [sql, queryParams] = buildSelectQuery(baseQuery, search, columns.SETTLEMENT, page, pageSize, sortBy, sortOrder, typeof search != 'string', user);
  const result = await executeQuery(sql, queryParams);
  return result.rows;
};

const createSettlementDao = async (payload) => {
  const [sql, params] = buildInsertQuery(tableName.SETTLEMENT, payload)
  const result = await executeQuery(sql, params);
  return result.rows[0];
};

const updateSettlementDao = async (id, data) => {
  const [sql, params] = buildUpdateQuery(tableName.SETTLEMENT, data, { id});
  const result = await executeQuery(sql, params);
  return result.rows[0];
};

const deleteSettlementDao = async (id, data) => {
  const [sql, params] = buildUpdateQuery(tableName.SETTLEMENT, data, { id });
  const result = await executeQuery(sql, params); 
 
  return result.rows[0];

};


export { getSettlementDao,getSettlementDaoAll, createSettlementDao, updateSettlementDao, deleteSettlementDao };
