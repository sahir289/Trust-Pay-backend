import { buildInsertQuery, buildSelectQuery, buildUpdateQuery, executeQuery } from '../../utils/db.js';
import { columns, tableName } from "../../constants/index.js";

const getSettlementDao = async (
  search, user,
  page,
  pageSize,
  sortBy,
  sortOrder,
) => {
  try {
    const baseQuery = `SELECT * FROM "${tableName.SETTLEMENT}" WHERE 1=1`;
    const [sql, queryParams] = buildSelectQuery(baseQuery, search, columns.SETTLEMENT, page, pageSize, sortBy, sortOrder, typeof search !== 'string', user);
    const result = await executeQuery(sql, queryParams);
    return result.rows[0];
  } catch (error) {
    console.error(error);
    throw error;
  }
};

const getSettlementDaoAll = async (
  search, user,
  page,
  pageSize,
  sortBy,
  sortOrder,
) => {
  try {
    const baseQuery = `SELECT * FROM "${tableName.SETTLEMENT}" WHERE 1=1`;
    const [sql, queryParams] = buildSelectQuery(baseQuery, search, columns.SETTLEMENT, page, pageSize, sortBy, sortOrder, typeof search !== 'string', user);
    const result = await executeQuery(sql, queryParams);
    return result.rows;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

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

const updateSettlementDao = async (id, data) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.SETTLEMENT, data, { id });
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    console.error(error);
    throw error;
  }
};

const deleteSettlementDao = async (id, data) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.SETTLEMENT, data, { id });
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    console.error(error);
    throw error;
  }
};

export { getSettlementDao, getSettlementDaoAll, createSettlementDao, updateSettlementDao, deleteSettlementDao };
