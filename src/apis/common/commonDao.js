import { executeQuery } from '../../utils/db.js';

export const getTotalCountDao = async (tableName) => {
  try {
    // Validate table name to prevent SQL injection
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
      throw new Error(`Invalid table name: ${tableName}`);
    }
    // Ensure the table name is properly quoted to handle case sensitivity
    const query = `SELECT COUNT(*) AS count FROM "${tableName}" WHERE is_obsolete = false`;
    const result = await executeQuery(query);
    return parseInt(result.rows[0].count, 10); // Ensure the count is returned as an integer
  } catch (error) {
    if (error.code === '42P01') {
      console.error(`Table "${tableName}" does not exist in the database.`);
      throw new Error(`Table "${tableName}" does not exist.`);
    }
    console.error(`Error fetching total count for table ${tableName}:`, error);
    throw error.message;
  }
};
