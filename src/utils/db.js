import pkg from 'pg';
import config from '../config/config.js';
import chalk from 'chalk';
import { DbError } from './appErrors.js';
import { logger } from "./logger.js";
const { Pool } = pkg;
const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: {
    rejectUnauthorized: false, // Use true in production with proper certificates
  },
});

const getConnection = async () => {
  try {
    const client = await pool.connect();
    const styledServerMessage = chalk.bgCyanBright(
      'Database connected successfully',
    );
    logger.log(`${styledServerMessage}`);
    return client;
  } catch (error) {
    logger.error(`Error fetching database connection:`, error);
    throw new DbError('Database connection error');
  }
};

const beginTransaction = async (client) => {
  try {
    await client.query('BEGIN');
    logger.log('Transaction started');
  } catch (error) {
    logger.error('Error starting transaction', error);
    throw new DbError('Failed to start transaction');
  }
};

const commit = async (client) => {
  try {
    await client.query('COMMIT');
    logger.log('Transaction committed');
  } catch (error) {
    logger.error('Error committing transaction', error);
    throw new DbError('Failed to commit transaction');
  }
};

const rollback = async (client, throwError = true) => {
  try {
    await client.query('ROLLBACK');
    logger.log('Transaction rolled back');
  } catch (error) {
    logger.error('Error rolling back transaction', error);
    if (throwError) {
      throw new DbError('Failed to rollback transaction');
    }
  }
};

export const executeQuery = async (query, queryParams = []) => {
  try {
    const result = await pool.query(query, queryParams);
    return result;
  } catch (error) {
    logger.error('Error while executing query', error);
    logger.error(`\nQuery: ${query}\nParams: [${queryParams}]`);
    throw new DbError(error.message);
  }
};

// export const buildJoinQuery = async (baseTable, filters, baseQuery, p, ps, s, o) => {
//   try {
//     const page = p || 1,
//       pageSize = ps || 10,
//       sortBy = s || "created_at",
//       sortOrder = o || "DESC";

//     let query = baseQuery;
//     let values = [];

//     for (const filter of filters) {
//       query += ` LEFT JOIN public."${filter.tableName}" r_${filter.tableName}
//                  ON r_${filter.tableName}.${filter.id} = "${baseTable}".${filter.id}`;
//     }

//     query += ` WHERE "${baseTable}".is_obsolete = false`;
//     query += ` ORDER BY "${baseTable}"."${sortBy}" ${sortOrder}`;
//     query += ` LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
//       values.push(pageSize);
//     values.push((page - 1) * pageSize);

//     return [query, values];
//   } catch (error) {
//     console.error('Error building join query:', error);
//     throw new DbError('Error building join query');
//   }
// };

export const buildSelectQuery = (
  baseQuery,
  filters,
  page,
  pageSize,
  sortBy,
  sortOrder,
  tableName,
) => {
  const prefix = tableName ? `"${tableName}".` : '';
  let query = baseQuery;
  let values = [];
  let conditions = [`${prefix}is_obsolete = false`];

  for (const key in filters) {
    const value = filters[key];
    if (key === 'or' || key === 'page' || key === 'limit') {
      continue;
    } else if (key.startsWith('config_') && key.endsWith('_contains')) {
      // Handle dynamic config.<variable> array column containment
      const variablePart = key.replace('config_', '').replace('_contains', '');
      const jsonColumn = `
        COALESCE(
          CASE 
            WHEN json_typeof(${prefix}"config"->'${variablePart}') = 'array' 
            THEN ARRAY(SELECT json_array_elements_text(${prefix}"config"->'${variablePart}'))
            ELSE ARRAY[(${prefix}"config"->>'${variablePart}')::text]
          END,
          ARRAY[]::text[]
        )`;
      conditions.push(`$${values.length + 1} = ANY(${jsonColumn})`);
      values.push(value);
    } else if (Array.isArray(value)) {
      conditions.push(`${prefix}"${key}" = ANY($${values.length + 1})`);
      values.push(value);
    } else {
      conditions.push(`${prefix}"${key}" = $${values.length + 1}`);
      values.push(value);
    }
  }

  if (conditions.length) {
    query += ` AND ${conditions.join(' AND ')}`;
  }

  // OR conditions (unchanged)
  if (filters.or && typeof filters.or === 'object') {
    const orConditions = [];
    for (const key in filters.or) {
      const value = filters.or[key];
      if (Array.isArray(value)) {
        orConditions.push(`${prefix}"${key}" = ANY($${values.length + 1})`);
      } else {
        orConditions.push(`${prefix}"${key}" = $${values.length + 1}`);
      }
      values.push(value);
    }
    query += ` AND (${orConditions.join(' OR ')})`;
  }

  // Apply sorting and pagination
  query = applySortingAndPagination(
    query,
    values,
    sortBy,
    sortOrder,
    page,
    pageSize,
    prefix,
  );
  return [query, values];
};

export const applySortingAndPagination = (
  query,
  values,
  sortBy,
  sortOrder,
  page,
  pageSize,
  prefix
) => {
  // Validate sort order
  const order = (sortOrder && sortOrder.toUpperCase()) === 'ASC' ? 'ASC' : 'DESC';

  // Add sorting
  query += ` ORDER BY ${prefix}"${sortBy || "created_at"}" ${order}`;

  // Add pagination if values are passed
  if(Number(page) && Number(pageSize)){
    const offset = (page - 1) * pageSize;
    query += ` LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
    values.push(pageSize, offset);
  }

  return query;
};

export const buildInsertQuery = (tableName, data) => {
  const keys = Object.keys(data).map((key) => `"${key}"`);
  const values = keys.map((el, i) => `$${i + 1}`);
  const query = `INSERT INTO "${tableName}" (${keys.join(', ')}) VALUES (${values}) RETURNING *`;
  return [query, Object.values(data)];
};

// specialFields { balance: "+" }
// whereCondition { id: 1 }
// data { balance: 1000 }
export const buildUpdateQuery = (
  tableName,
  data,
  whereCondition,
  specialFields = {},
) => {
  const values = [];

  const setClause = Object.entries(data).map(([key, value]) => {
    values.push(value);
    return specialFields[key]
      ? `"${key}" = "${key}" ${specialFields[key]} $${values.length}` // Use specified operator
      : `"${key}" = $${values.length}`;
  });

  const whereClause = Object.entries(whereCondition).map(([key, value]) => {
    values.push(value);
    return `"${key}" = $${values.length}`;
  });

  const query = `UPDATE "${tableName}" SET ${setClause.join(', ')} WHERE ${whereClause.join(' AND ')} RETURNING *`;
  return [query, values];
};

export const transactionWrapper =
  (fn) =>
  async (...args) => {
    let conn;
    try {
      conn = await getConnection();
      await beginTransaction(conn); // Ensure transaction starts properly

      const data = await fn(conn, ...args); // Ensure fn expects conn as the first argument

      await commit(conn); // Commit only if no errors
      return data;
    } catch (error) {
      if (conn) {
        try {
          await rollback(conn); // Explicit rollback
          logger.error('Transaction rolled back due to error:', error);
        } catch (rollbackError) {
          logger.error('Rollback failed:', rollbackError);
        }
      }
      throw new DbError(error.message); // Rethrow error
    } finally {
      if (conn) {
        logger.log('Releasing connection');
        conn.release(); // Always release connection
      }
    }
  };

/**
 * Builds a dynamic SQL SELECT query with auto-generated JOIN conditions.
 * @param {string} table - The main table name.
 * @param {Array<string>|"*"} [columns="*"] - Base table columns.
 * @param {Array<Object>} [joins=[]] - Array of join objects.
 *
 * Each join object should have:
 *  - {string} table: The table to join.
 *  - {string} referenceTable: The table to use as baseTable (Optional).
 *  - {string|Array<string>} keys:
 *      - If string → assumes both tables have the same key. (e.g., `"user_id"`)
 *      - If array → assumes [foreignKey, primaryKey]. (e.g., `["user_id", "id"]`)
 *  - {string} [type="JOIN"]: Type of join (e.g., "JOIN", "LEFT JOIN").
 *  - {Array<string>} [columns=[]]: Columns to select from the joined table.
 *  - {Array<string>} [columnAs=[]]: Columns with aliases.
 *
 * @returns {string} - The generated SQL query.
 *
 * @example
 *
 * const sql = buildJoinQuery({
 *   table: "Merchant",
 *   columns: "*",
 *   joins: [
 *     {
 *       table: "User",
 *       keys: "user_id",
 *       type: "JOIN",
 *       columns: ["first_name", "last_name"]
 *     },
 *     {
 *       table: "Designation",
 *       keys: ["designation_id", "id"],
 *       type: "LEFT JOIN",
 *       columnAs: [`"Designation".designation AS designation_name`]
 *     }
 *   ]
 * });
 *
 *
 * // Generates:
 * SELECT "Merchant".*, "User".first_name, "User".last_name, "Designation".designation AS designation_name
 * FROM "Merchant"
 * JOIN "User" ON "Merchant".user_id = "User".user_id
 * LEFT JOIN "Designation" ON "User".designation_id = "Designation".id
 */
export const buildJoinQuery = (table, columns = '*', joins = []) => {
  let selectCols =
    columns === '*'
      ? [`"${table}".*`]
      : columns.map((col) => `"${table}".${col}`);
  let joinClauses = [];

  for (const join of joins) {
    const {
      table: jTable,
      referenceTable: rTable,
      keys,
      type = 'JOIN',
      columns = [],
      columnAs = [],
    } = join;
    const referenceTable = rTable || table;

    // Auto-generate ON condition
    let onCondition = '';
    if (keys) {
      if (typeof keys === 'string') {
        // If keys is a string, use the same key for both tables
        onCondition = `"${referenceTable}".${keys} = "${jTable}".${keys}`;
      } else if (Array.isArray(keys) && keys.length === 2) {
        // If keys is an array, assume different keys for each table
        onCondition = `"${referenceTable}".${keys[0]} = "${jTable}".${keys[1]}`;
      }
    }

    // Add selected columns
    for (const col of columns) {
      selectCols.push(`"${jTable}".${col}`);
    }
    for (const colAs of columnAs) {
      selectCols.push(colAs);
    }

    // Add the JOIN clause
    joinClauses.push(`${type} "${jTable}" ON ${onCondition}`);
  }

  return `SELECT ${selectCols.join(', ')} FROM "${table}" ${joinClauses.join(' ')} WHERE 1=1`;
};

export { pool, getConnection, beginTransaction, commit, rollback };
