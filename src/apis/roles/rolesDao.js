import {
  buildInsertQuery,
  buildSelectQuery,
  executeQuery,
  buildUpdateQuery,
} from '../../utils/db.js';
import { columns, tableName } from '../../constants/index.js';

// const getRoleByIdDao = async (id) => {
// const query = `SELECT *  FROM  "${tableName.ROLE}" WHERE 1=1`;
//    const [sql, parameters] = buildSelectQuery(query, {id} );
//    const result = await executeQuery(sql, parameters);
//    return result.rows[0];
// };

const getRoleDao = async (search, page, pageSize, sortBy, sortOrder) => {
  const baseQuery = `SELECT * FROM "${tableName.ROLE}" WHERE 1=1 AND "company_id" = $1`;
  const [sql, queryParams] = buildSelectQuery(
    baseQuery,
    search,
    columns.ROLE,
    page,
    pageSize,
    sortBy,
    sortOrder,
    typeof search != 'string',
  );
  // Execute query
  const result = await executeQuery(sql, queryParams)
  return result.rows;
};

const createRoleDao = async (data) => {
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
