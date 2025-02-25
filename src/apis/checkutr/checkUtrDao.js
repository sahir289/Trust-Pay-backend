import { buildInsertQuery, buildSelectQuery, buildUpdateQuery, executeQuery } from '../../utils/db.js';
const tableName = 'CheckUtr';

const getCheckUtrDao = async (filters) => {
  try {
    const query = `SELECT *  FROM  "${tableName}" WHERE 1=1`;
    const [sql, parameters] = buildSelectQuery(query, filters);
    const result = await executeQuery(sql, parameters);
    return result.rows[0];
  } catch (error) {
    console.error('Error getting CheckUtr:', error);  // Log the error for debugging
    throw error;  // Rethrow the error to propagate it
  }
};

const createCheckUtrDao = async (payload) => {
  try {
    const [sql, params] = buildInsertQuery(tableName, payload);
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    console.error('Error creating CheckUtr:', error);  // Log the error for debugging
    throw error;  // Rethrow the error to propagate it
  }
};

const updateCheckUtrDao = async (id, data) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName, data, { id });
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    console.error('Error updating CheckUtr:', error);  // Log the error for debugging
    throw error;  // Rethrow the error to propagate it
  }
};

const deleteCheckUtrDao = async (id, data) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName, data, { id });
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    console.error('Error deleting CheckUtr:', error);  // Log the error for debugging
    throw error;  // Rethrow the error to propagate it
  }
};

export { getCheckUtrDao, createCheckUtrDao, updateCheckUtrDao, deleteCheckUtrDao };
