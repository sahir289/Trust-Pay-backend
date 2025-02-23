import { columns, tableName } from '../../constants/index.js';
import { buildInsertQuery, buildSelectQuery, buildUpdateQuery, executeQuery } from '../../utils/db.js';

const getDesignationDao = async (
  search,user,
  page,
  pageSize,
  sortBy,
  sortOrder
) => {
  try {
    const baseQuery = `SELECT id,designation FROM "${tableName.DESIGNATION}" WHERE 1=1`;
    const [sql, queryParams] = buildSelectQuery(baseQuery, search, columns.DESIGNATION, page, pageSize, sortBy, sortOrder, typeof search != 'string',user);
    
    const result = await executeQuery(sql, queryParams);
    return result.rows;
  } catch (error) {
    console.error('Error in getDesignationDao:', error);
    throw new Error('Database query failed');
  }
};

const createDesignationDao = async (payload) => {
  try {
    const [sql, params] = buildInsertQuery(tableName.DESIGNATION, payload);
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    console.error('Error in createDesignationDao:', error);
    throw new Error('Failed to create designation');
  }
};

const updateDesignationDao = async (id,company_id,role_id, data) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.DESIGNATION, data, { id,company_id,role_id });
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    console.error('Error in updateDesignationDao:', error);
    throw new Error('Failed to update designation');
  }
};

const deleteDesignationDao = async (id,company_id,role_id, data) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.DESIGNATION, data, { id,company_id,role_id });
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    console.error('Error in deleteDesignationDao:', error);
    throw new Error('Failed to delete designation');
  }
};

export { getDesignationDao, createDesignationDao, updateDesignationDao, deleteDesignationDao };
