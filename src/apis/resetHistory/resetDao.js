import {
  buildInsertQuery,
  buildSelectQuery,
  buildUpdateQuery,
  executeQuery,
} from '../../utils/db.js';
const tableName = 'ResetHistory';

const getResetHistoryDao = async (id) => {
  try {
    const query = `SELECT *  FROM  "${tableName}" WHERE 1=1`;
    const [sql, parameters] = buildSelectQuery(query, { id });
    const result = await executeQuery(sql, parameters);
    return result.rows[0];
  } catch (error) {
    console.error('Error in getResetHistoryDao:', error);
    throw error;
  }
};

const createResetHistoryDao = async (payload) => {
  try {
    const [sql, params] = buildInsertQuery(tableName, payload);
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    console.error('Error in createResetHistoryDao:', error);
    throw error;
  }
};

const updateResetHistoryDao = async (id, data) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName, data, { id });
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    console.error('Error in updateResetHistoryDao:', error);
    throw error;
  }
};

const deleteResetHistoryDao = async (id, data) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName, data, { id });
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    console.error('Error in deleteResetHistoryDao:', error);
    throw error;
  }
};

export {
  getResetHistoryDao,
  createResetHistoryDao,
  updateResetHistoryDao,
  deleteResetHistoryDao,
};
