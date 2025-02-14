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


const createDesignationByIdDao = async (payload) => {
  const [sql, params] = buildInsertQuery(tableName.DESIGNATION, payload)
  const result = await executeQuery(sql, params);
  return result.rows[0];
};

const updateDesignationByIdDao = async (id, data) => {

  const [sql, params] = buildUpdateQuery(tableName.DESIGNATION, data, { id });
  const result = await executeQuery(sql, params);
  return result.rows[0];

};

const deleteDesignationByIdDao = async (id, data) => {
  const [sql, params] = buildUpdateQuery(tableName.DESIGNATION, data, { id });
  const result = await executeQuery(sql, params);
  return result.rows[0];


};

export { getDesignationDao, createDesignationByIdDao, updateDesignationByIdDao, deleteDesignationByIdDao };
