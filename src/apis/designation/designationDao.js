import { tableName } from '../../constants/index.js';
import {
  buildInsertQuery,
  buildSelectQuery,
  buildUpdateQuery,
  executeQuery,
} from '../../utils/db.js';
import { logger } from '../../utils/logger.js';

const getDesignationDao = async (filters) => {
  try {
    const baseQuery = `SELECT * FROM "${tableName.DESIGNATION}" WHERE 1=1`;
    const [sql, queryParams] = buildSelectQuery(baseQuery, filters);
    const result = await executeQuery(sql, queryParams);
    return result.rows;
  } catch (error) {
    logger.error('Error in getDesignationDao:', error);
    throw error;
  }
};

const createDesignationDao = async (payload) => {
  try {
    const [sql, params] = buildInsertQuery(tableName.DESIGNATION, payload);
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    logger.error('Error in createDesignationDao:', error);
    throw error;
  }
};

const updateDesignationDao = async (id, data) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.DESIGNATION, data, id);
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    logger.error('Error in updateDesignationDao:', error);
    throw error;
  }
};

const deleteDesignationDao = async (id, data) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.DESIGNATION, data, id);
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    logger.error('Error in deleteDesignationDao:', error);
    throw error;
  }
};

export {
  getDesignationDao,
  createDesignationDao,
  updateDesignationDao,
  deleteDesignationDao,
};
