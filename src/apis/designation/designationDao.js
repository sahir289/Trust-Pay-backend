import { columns, tableName } from '../../constants/index.js';
import { buildInsertQuery, buildSelectQuery, buildUpdateQuery, executeQuery } from '../../utils/db.js';

const getDesignationDao = async (
  search,
  page,
  pageSize,
  sortBy,
  sortOrder
) => {
  const baseQuery = `SELECT * FROM "${tableName.DESIGNATION}" WHERE 1=1`;
  const [sql, queryParams] = buildSelectQuery(baseQuery, search, columns.DESIGNATION, page, pageSize, sortBy, sortOrder, typeof search != 'string');
  // Execute query
  const result = await executeQuery(sql, queryParams);
  return result.rows;
};


const createDesignationDao = async (payload) => {
  const [sql, params] = buildInsertQuery(tableName, payload)
  const result = await executeQuery(sql, params);
  return result.rows[0];
};

const updateDesignationDao = async (id, data) => {

  const [sql, params] = buildUpdateQuery(tableName.DESIGNATION, data, { id });
  const result = await executeQuery(sql, params);
  return result.rows[0];

};

const deleteDesignationDao = async (id, data) => {
  const [sql, params] = buildUpdateQuery(tableName, data, { id });
  const result = await executeQuery(sql, params);
  return result.rows[0];


};

export { getDesignationDao, createDesignationDao, updateDesignationDao, deleteDesignationDao };
