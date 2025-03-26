import { executeQuery } from '../../utils/db.js';

export const getTotalCountDao = async (tableName, role) => {
  try {
    // Validate table name to prevent SQL injection
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
      throw new Error(`Invalid table name: ${tableName}`);
    }

    // Base query
    let query = `SELECT COUNT(*) AS count FROM "${tableName}" WHERE is_obsolete = false`;

    // Add role-based filtering for the settlement table
    if (tableName === 'Settlement' && role) {
      query += ` AND EXISTS (
        SELECT 1 FROM public."User" u
        JOIN public."Role" r ON r.id = u.role_id
        WHERE u.id = "${tableName}".user_id AND r.role = $1
      )`;
    }

    const params = tableName === 'Settlement' && role ? [role] : [];
    const result = await executeQuery(query, params);

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
