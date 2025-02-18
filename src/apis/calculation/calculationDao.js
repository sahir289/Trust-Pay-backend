import { executeQuery, buildSelectQuery, buildInsertQuery, buildUpdateQuery } from "../../utils/db.js";
import { columns,tableName } from "../../constants/index.js";

const getCalculationDao = async (
  search,
  page,
  pageSize,
  sortBy,
  sortOrder
) => {
  const baseQuery = `SELECT * FROM "${tableName.CALCULATION}" WHERE 1=1`;
  const [sql, queryParams] = buildSelectQuery(baseQuery, search, columns.CALCULATION, page, pageSize, sortBy, sortOrder, typeof search != 'string');
  // Execute query
  const result = await executeQuery(sql, queryParams);
  return result.rows;
};

const createCalculationDao = async (data) => {
  const [sql, params] = buildInsertQuery(tableName.CALCULATION, data)
  const result = await executeQuery(sql, params);
  return result.rows[0];
}


const updateCalculationDao = async (user_id, data) => {
    const [sql, params] = buildUpdateQuery(tableName.CALCULATION, data, { user_id });
    const result = await executeQuery(sql, params);
    return result.rows[0]; 
};

const deleteCalculationDao = async (id, data) => {
  const [sql, params] = buildUpdateQuery(tableName.CALCULATION, data, { id });
  const result = await executeQuery(sql, params);
  return result.rows[0];
}


export { getCalculationDao, createCalculationDao, updateCalculationDao, deleteCalculationDao };
