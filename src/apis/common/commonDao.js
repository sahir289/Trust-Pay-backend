import { executeQuery } from '../../utils/db.js';

export const getTotalCountDao = async (tableName, role, filters) => {
  try {
    // Validate table name to prevent SQL injection
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
      throw new Error(`Invalid table name: ${tableName}`);
    }
    console.log(role);
    let columnName = '';
    let columnValue = '';
    if (filters) {
      columnName = Object.keys(filters)[0];
      columnValue = Object.values(filters)[0];
    }
    
    // Base query
    let query = `SELECT COUNT(*) AS count FROM "${tableName}" WHERE is_obsolete = false`;

    // Add role-based filtering for the settlement table
    let params= [];
    let paramIndex = 1;

    // Add role-based filtering for 'Settlement'
    if (tableName && role) {
      query += ` AND EXISTS (
        SELECT 1 FROM public."User" u
        JOIN public."Role" r ON r.id = u.role_id
        WHERE u.id = "${tableName}".user_id AND r.role = $${paramIndex}
      )`;
      params.push(role);
      paramIndex++;
    }

    // Dynamically add filters to query
    if (filters){
      query += ` AND "${columnName}" = $${paramIndex}`;
      params.push(columnValue);
      paramIndex++;
    }
console.log(query, "query", params, "params")
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
