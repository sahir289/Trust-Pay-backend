import { executeQuery } from '../../utils/db.js';
import { Role, tableName } from '../../constants/index.js';

export const getTotalCountDao = async (tablename, role, filters, roleIs) => {
  try {
    // Validate table name to prevent SQL injection
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tablename)) {
      throw new Error(`Invalid table name: ${tablename}`);
    }

    // Base query
    let query;
    let params = [];
    let paramIndex = 1;

    if (roleIs === Role.ADMIN && tablename === tableName.MERCHANT) {
      query = `
        SELECT COUNT(*) AS count 
        FROM "${tablename}" 
        JOIN "User" ON "${tablename}".user_id = "User".id 
        LEFT JOIN "Designation" ON "User".designation_id = "Designation".id 
        WHERE "${tablename}".is_obsolete = false 
        AND "Designation".designation = 'MERCHANT' 
        AND "Merchant".company_id = $${paramIndex}
      `;
      params.push(filters.company_id);
      paramIndex++;
      delete filters.company_id;
    } else {
      query = `
        SELECT COUNT(*) AS count 
        FROM "${tablename}" 
        WHERE is_obsolete = false
      `;
    }

    // Add role-based filtering for 'Settlement'
    if (tableName && role) {
      query += ` AND EXISTS (
        SELECT 1 FROM public."User" u
        JOIN public."Role" r ON r.id = u.role_id
        WHERE u.id = "${tablename}".user_id AND r.role = $${paramIndex}
      )`;
      params.push(role);
      paramIndex++;
    }

    if (filters?.startDate && filters?.endDate) {
      query += ` AND created_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
      params.push(filters.startDate, filters.endDate);
      paramIndex += 2;
    }

    // Dynamically add filters to query
    if (filters) {
      Object.entries(filters).forEach(([column, value]) => {
        if (column === 'startDate' || column === 'endDate') {
          return;
        }
        if (Array.isArray(value)) {
          // Handle multiple values using SQL IN clause
          const placeholders = value.map(() => `$${paramIndex++}`).join(',');
          query += ` AND "${column}" IN (${placeholders})`;
          params.push(...value);
        } else {
          // Single value condition
          query += ` AND "${column}" = $${paramIndex++}`;
          params.push(value);
        }
      });
    }

    const result = await executeQuery(query, params);
    return parseInt(result.rows[0].count, 10); // Ensure the count is returned as an integer
  } catch (error) {
    if (error.code === '42P01') {
      console.error(`Table "${tablename}" does not exist in the database.`);
      throw new Error(`Table "${tablename}" does not exist.`);
    }
    console.error(`Error fetching total count for table ${tablename}:`, error);
    throw error.message;
  }
};
