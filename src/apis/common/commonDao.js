import { executeQuery } from '../../utils/db.js';
import { Role, tableName } from '../../constants/index.js';
import { logger } from '../../utils/logger.js';

export const getTotalCountDao = async (tablename, role, filters, roleIs, updated = false) => {
  try {
    // Validate table name to prevent SQL injection
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tablename)) {
      throw new Error(`Invalid table name: ${tablename}`);
    }
    // delete filters.user_ids;  ///temperary
    // Base query
    let query;
    let params = [];
    let paramIndex = 1;
    //handle userIds for filters of vendor
    let joins= '';
    if (filters.user_ids) {
      joins = `
        LEFT JOIN "BankAccount" ON "${tablename}".bank_acc_id = "BankAccount".id
        LEFT JOIN "Vendor" ON "BankAccount".user_id = "Vendor".user_id
      `;
    }  
    if (roleIs === Role.ADMIN && tablename === tableName.MERCHANT) {
      query = `
        SELECT COUNT(*) AS count 
        FROM "${tablename}" 
        JOIN "User" ON "${tablename}".user_id = "User".id 
        LEFT JOIN "Designation" ON "User".designation_id = "Designation".id 
        ${joins}
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
         ${joins}
        WHERE "${tablename}".is_obsolete = false
      `;
    }
     
    if (filters.user_ids) {
      query += ` AND "Vendor".user_id = ANY($${paramIndex})`;
      params.push(filters.user_ids);
      paramIndex++;
      delete filters.user_ids;
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

    // Handle updated entries
    if (updated) {
      query += ` AND "${tablename}".updated_at IS NOT NULL 
        AND "${tablename}".updated_at != "${tablename}".created_at`;
    }

    // Handle nickname filter
    if (filters.nick_name) {
      delete filters.nick_name;
    }

    // Handle date range
    if (filters?.startDate && filters?.endDate) {
      query += ` AND created_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
      params.push(filters.startDate, filters.endDate);
      paramIndex += 2;
    }

    // Handle user_id array
    if (Array.isArray(filters.user_id) && filters.user_id.length > 0) {
      query += ` AND "${tablename}".user_id = ANY($${paramIndex})`;
      params.push(filters.user_id);
      paramIndex++;
      if (filters?.startDate && filters?.endDate) {
        query += ` AND "${tablename}".created_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
        params.push(filters.startDate, filters.endDate);
        paramIndex += 2;
      }
      delete filters.user_id;
    }

    // Dynamically add remaining filters
    if (filters) {
      Object.entries(filters).forEach(([column, value]) => {
        if (column === 'startDate' || column === 'endDate') {
          return;
        }
        if (Array.isArray(value)) {
          // Handle multiple values using SQL IN clause
          const placeholders = value.map(() => `$${paramIndex++}`).join(',');
          query += ` AND "${tablename}"."${column}" IN (${placeholders})`;
          params.push(...value);
        } else {
          // Single value condition
          query += ` AND "${tablename}"."${column}" = $${paramIndex++}`;
          params.push(value);
        }
      });
    }

    const result = await executeQuery(query, params);
    return parseInt(result.rows[0].count, 10); // Ensure the count is returned as an integer
  } catch (error) {
    if (error.code === '42P01') {
      logger.error(`Table "${tablename}" does not exist in the database.`);
      throw new Error(`Table "${tablename}" does not exist.`);
    }
    if (error.code === '42703') {
      logger.error(`Column updated_at or created_at does not exist in table "${tablename}".`);
      throw new Error(`Cannot filter updated entries: table "${tablename}" lacks required columns.`);
    }
    logger.error(`Error fetching total count for table ${tablename}:`, error);
    throw error.message;
  }
};
