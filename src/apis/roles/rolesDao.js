import {
  buildInsertQuery,
  buildSelectQuery,
  executeQuery,
  buildUpdateQuery,
} from '../../utils/db.js';
import { tableName } from '../../constants/index.js';


const getRoleDao = async (filters, page, pageSize, sortBy, sortOrder) => {
  const baseQuery = `SELECT id,role FROM "${tableName.ROLE}" WHERE 1=1`;
  //TODO: columns.ROLE dynamic search
  const [sql, queryParams] = buildSelectQuery(
    baseQuery,
    filters,
    page,
    pageSize,
    sortBy,
    sortOrder
  );
  // Execute query
  const result = await executeQuery(sql, queryParams)
  return result.rows;
};

const createRoleDao = async (conn,data) => {
  const [sql, params] = buildInsertQuery(tableName.ROLE, data);
  const result = await executeQuery(sql, params);
  return result.rows[0];
};

const updateRoleDao = async (conn, id,company_id, data) => {
  const [sql, params] = buildUpdateQuery(tableName.ROLE, data, {id ,company_id});
  if (conn && conn.query) {
    const result = await conn.query(sql, params);
    return result.rows[0];
  }
  const result = await executeQuery(sql, params);
  return result.rows[0];
};

const deleteRoleDao = async (conn, id,company_id, data) => {
  const [sql, params] = buildUpdateQuery(tableName.ROLE, data, { id,company_id });
  if (conn && conn.query) {
    const result = await conn.query(sql, params);
    return result.rows[0];
  }
  const result = await executeQuery(sql, params);
  return result.rows[0];
};

export { getRoleDao, createRoleDao, updateRoleDao, deleteRoleDao };
