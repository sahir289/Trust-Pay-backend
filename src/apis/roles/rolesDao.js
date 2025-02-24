import {
  buildInsertQuery,
  buildSelectQuery,
  executeQuery,
  buildUpdateQuery,
} from '../../utils/db.js';
import { columns, tableName } from '../../constants/index.js';

const getRoleDao = async (search, user, page, pageSize, sortBy, sortOrder) => {
  try {
    const baseQuery = `SELECT id,role FROM "${tableName.ROLE}" WHERE 1=1`;
    const [sql, queryParams] = buildSelectQuery(
      baseQuery,
      search,
      columns.ROLE,
      page,
      pageSize,
      sortBy,
      sortOrder,
      typeof search !== 'string',
      user
    );
    // Execute query
    const result = await executeQuery(sql, queryParams);
    return result.rows;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

const createRoleDao = async (conn, data) => {
  try {
    const [sql, params] = buildInsertQuery(tableName.ROLE, data);
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    console.error(error);
    throw error;
  }
};

const updateRoleDao = async (conn, id, company_id, data) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.ROLE, data, { id, company_id });
    if (conn && conn.query) {
      const result = await conn.query(sql, params);
      return result.rows[0];
    }
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    console.error(error);
    throw error;
  }
};

const deleteRoleDao = async (conn, id, company_id, data) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.ROLE, data, { id, company_id });
    if (conn && conn.query) {
      const result = await conn.query(sql, params);
      return result.rows[0];
    }
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    console.error(error);
    throw error;
  }
};

export { getRoleDao, createRoleDao, updateRoleDao, deleteRoleDao };
