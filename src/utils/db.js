/* eslint-disable no-unused-vars */
import pkg from 'pg';
import config from '../config/config.js';
import chalk from 'chalk';
import { DbError, InternalServerError } from './appErrors.js';
import { logger } from './logger.js';
import { stringifyJSON } from './index.js';
// import fs from 'fs';
// import path from 'path';
// import { fileURLToPath } from 'url';
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);
const { Pool } = pkg;

const sslConfig =
  config.env === 'production'
    ? {
        rejectUnauthorized: false,
        // If you need SSL CA cert (RDS bundle)
        // ca: fs.readFileSync(path.join(__dirname, 'ap-south-1-bundle.pem')).toString(),
      }
    : { rejectUnauthorized: false };

// const writerPool = new Pool({
//   connectionString: config.databaseWriterUrl,
//   ssl: sslConfig,
//   max: 20,
//   idleTimeoutMillis: 30000,
//   connectionTimeoutMillis: 10000,
//   keepAlive: true,
// });

// const readerPool = new Pool({
//   connectionString: config.databaseReaderUrl,
//   ssl: sslConfig,
//   max: 20,
//   idleTimeoutMillis: 30000,
//   connectionTimeoutMillis: 10000,
//   keepAlive: true,
// });

export const createPool = (connectionString, name) => {
  if (!connectionString) {
    throw new InternalServerError(
      'DATABASE_URL is not set. Check your environment variables.',
    );
  }

  const pool = new Pool({
    connectionString: connectionString,
    ssl:
      config.env === 'production'
        ? {
            rejectUnauthorized: false,
            // ca: fs.readFileSync(path.join(__dirname, 'ap-south-1-bundle.pem')).toString(),
          }
        : { rejectUnauthorized: false },
    max: 60,
    min: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    keepAlive: true,
    maxUses: 7500,
  });

  pool.on('connect', (client) => {
    client.query("SET TIME ZONE 'Asia/Kolkata'");
  });

  pool.on('error', async (err, client) => {
    logger.error(`Unexpected error on idle client (${name}):`, err);
    
    // For connection reset errors (laptop sleep/wake, network issues)
    if (err.code === 'ECONNRESET' || err.code === 'EPIPE') {
      logger.warn(`Connection reset detected for ${name} pool. Pool will automatically recover.`);
      // The pool will automatically remove the bad connection and create new ones
      // No manual intervention needed
      return;
    }

    let retryCount = 0;
    const maxRetries = 5;
    const baseDelay = config.env === 'production' ? 5000 : 2000;

    while (retryCount < maxRetries) {
      const delay = baseDelay * Math.pow(2, retryCount);
      logger.warn(
        `Reconnecting to ${name} DB (Attempt ${retryCount + 1}) in ${delay / 1000}s...`,
      );

      await new Promise((resolve) => setTimeout(resolve, delay));

      try {
        const newClient = await pool.connect();
        newClient.release();
        logger.info(`${name} Database reconnected successfully!`);
        return;
      } catch (retryErr) {
        logger.error(
          `Reconnection attempt ${retryCount + 1} failed for ${name}:`,
          retryErr,
        );
      }

      retryCount++;
    }
    logger.error(
      `All reconnection attempts failed. ${name}. The database remains unreachable.`,
    );
  });
  return pool;
};

const writerPool = createPool(config?.databaseWriterUrl, 'Writer');
const readerPool = createPool(config?.databaseReaderUrl, 'Reader');

/**
 * getConnection
 * @param {string} type - "reader" | "writer"
 */
const getConnection = async (type = 'writer') => {
  const maxRetries = 5;
  const baseDelay = 2000;

  for (let retryCount = 0; retryCount < maxRetries; retryCount++) {
    try {
      const pool = type === 'reader' ? readerPool : writerPool;
      const client = await pool.connect();
      logger.info(chalk.bgCyanBright('Database connected successfully'));
      return client;
    } catch (error) {
      const delay = baseDelay * Math.pow(2, retryCount);
      logger.error(`Error fetching database connection:`, error);
      logger.warn(
        chalk.yellow(
          `DB connection failed (Attempt ${retryCount + 1}). Retrying in ${delay / 1000}s...`,
        ),
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  logger.error('Database connection failed after multiple retries');
  throw new DbError('Database connection error');
};

export async function closePool() {
  try {
    // await pool.end();
    await writerPool.end();
    await readerPool.end();
    const styledMessageError = chalk.underline.red(
      `PostgreSQL connection pool closed`,
    );
    logger.info(styledMessageError);
  } catch (err) {
    logger.error('Error while closing PostgreSQL pool:', err);
  }
}


// RULE: BEGIN & COMMIT bubble errors.
// ROLLBACK is best-effort and must never throw.

/**
 * Starts a database transaction.
 *
 * IMPORTANT:
 * - This function intentionally DOES NOT use try/catch.
 * - BEGIN is a transaction boundary operation.
 * - If BEGIN fails (connection dropped, pool issue, DB restart),
 *   the REAL error must bubble up to the transaction owner (API layer).
 *
 * Wrapping or masking BEGIN errors would:
 * - Hide infrastructure issues
 * - Break transaction state awareness
 * - Cause incorrect rollback attempts
 *
 * Error handling and recovery MUST be done at the transaction boundary,
 * not inside this helper.
 */
const beginTransaction = async (client) => {
  await client.query('BEGIN');
  logger.info('Transaction started');
};

/**
 * Commits the current transaction.
 *
 * IMPORTANT:
 * - This function intentionally DOES NOT use try/catch.
 * - COMMIT is a transaction boundary operation.
 * - If COMMIT fails, the transaction state is UNKNOWN and the caller
 *   must decide how to recover.
 *
 * We do NOT wrap or replace errors here so that:
 * - The original PostgreSQL / network error is preserved
 * - The caller can correctly decide whether rollback is safe
 * - We avoid double-rollback or cleanup crashes
 *
 * All commit failures are handled at the transaction boundary (API layer).
 */
const commit = async (client) => {
  await client.query('COMMIT');
  logger.info('Transaction committed');
};


/**
 * Rolls back the current transaction (best-effort cleanup).
 *
 * IMPORTANT:
 * - Rollback is a CLEANUP operation, not business logic.
 * - This function MUST use try/catch and MUST NEVER throw.
 *
 * Reasons:
 * - The connection may already be closed
 * - The transaction may already be committed or auto-rolled back
 * - PostgreSQL may reject ROLLBACK in an invalid state
 *
 * Cleanup failures must NEVER crash the application or override
 * the original error that caused the rollback.
 *
 * Rollback errors are logged as warnings and safely ignored.
 */
const rollback = async (client) => {
  try {
    await client.query('ROLLBACK');
    logger.info('Transaction rolled back');
  } catch (error) {
    logger.warn('Rollback skipped / failed (transaction already closed or connection dead)', error);
  }
};

export const executeQuery = async (query, queryParams = [], conn = null) => {
  const maxRetries = 3; // Number of retries for transient errors
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const isSelect = query.trim().toUpperCase().startsWith('SELECT');
      const pool = isSelect ? readerPool : writerPool;
      const result = conn
        ? await conn.query(query, queryParams)
        : await pool.query(query, queryParams);
      return result;
    } catch (error) {
      logger.error(`Error while executing query (Attempt ${attempt}):`, error);
      logger.error(`\nQuery: ${query}\nParams: [${queryParams}]`);

      // Check if error is a transient connection issue
      const isTransientError = 
        error.code === 'ECONNRESET' ||
        error.code === 'ECONNREFUSED' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'EPIPE' ||
        error.code === 'ENOTFOUND' ||
        error.message?.includes('Connection terminated unexpectedly') ||
        error.message?.includes('connection timeout') ||
        error.message?.includes('server closed the connection') ||
        error.message?.includes('terminating connection due to idle-in-transaction timeout');

      // Retry only for transient errors
      if (isTransientError && attempt < maxRetries) {
        const delay = 1000 * attempt; // Exponential backoff: 1s, 2s, 3s
        logger.warn(`Retrying query due to ${error.code || 'connection error'} (Attempt ${attempt + 1} in ${delay}ms)...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      // Throw error if retries are exhausted or error is not transient
      throw new DbError(error.message);
    }
  }
};

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
    }

    if (['startDate', 'endDate'].includes(key)) {
      continue;
    }

    if (key.startsWith('config_') && key.endsWith('_contains')) {
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

  // Handle startDate and endDate
  if (filters?.startDate && filters?.endDate) {
    const startDate = new Date(filters.startDate).toISOString().split('T')[0];
    const endDate = new Date(filters.endDate).toISOString().split('T')[0];
    conditions.push(
      `${prefix}"created_at" BETWEEN $${values.length + 1} AND $${values.length + 2}`,
    );
    values.push(startDate, endDate);
  }

  // Add WHERE conditions
  if (conditions?.length) {
    if (query.toLowerCase().includes('where')) {
      query += ` AND ${conditions.join(' AND ')}`;
    } else {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
  }

  if (filters?.or && typeof filters?.or === 'object') {
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
  prefix,
) => {
  // Validate sort order
  const order =
    (sortOrder && sortOrder.toUpperCase()) === 'ASC' ? 'ASC' : 'DESC';

  // Add sorting
  query += ` ORDER BY ${prefix}"${sortBy || 'created_at'}" ${order}`;

  // Add pagination if values are passed
  if (Number(page) && Number(pageSize)) {
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
  options = { returnUpdated: true }, // Option to control RETURNING clause
) => {
  const values = [];
  const setClause = Object.entries(data).map(([key, value]) => {
    values.push(value);
    return specialFields[key]
      ? `"${key}" = "${key}" ${specialFields[key]} $${values.length}` // Use specified operator (e.g., "+", "-")
      : `"${key}" = $${values.length}`;
  });

  const whereClause = Object.entries(whereCondition).map(([key, value]) => {
    values.push(value);
    return `"${key}" = $${values.length}`;
  });

  const returningClause = options.returnUpdated ? 'RETURNING *' : '';

  const query = `UPDATE "${tableName}" SET ${setClause.join(', ')} WHERE ${whereClause.join(' AND ')} ${returningClause}`;
  return [query, values];
};

export const buildAndExecuteUpdateQuery = async (
  tableName,
  data,
  whereCondition,
  specialFields = {},
  options = { returnUpdated: true }, // Option to control RETURNING clause
  conn = null, // Optional database connection
) => {
  try {
    const values = [];
    const setClause = [];
    let index = 1;

    // Handle nested JSON updates for `config` or other JSONB columns
    if (data.config && typeof data.config === 'object') {
      let jsonbSetQuery = `"config"::jsonb`;
      const processNestedKeys = (obj, parentKey = []) => {
        Object.entries(obj).forEach(([key, value]) => {
          const currentPath = [...parentKey, key];
          // merging merchant_added object
          if (
            key === 'merchant_added' &&
            typeof value === 'object' &&
            !Array.isArray(value)
          ) {
            const path = currentPath.join(',');
            const mergeSnippet = `coalesce(${jsonbSetQuery}#>'{${path}}', '{}'::jsonb) || $${index}::jsonb`;
            jsonbSetQuery = `jsonb_set(${jsonbSetQuery}, '{${path}}', ${mergeSnippet})`;
            values.push(stringifyJSON(value));
            index++;
          } else if (
            value &&
            typeof value === 'object' &&
            !Array.isArray(value)
          ) {
            // Recursively process nested objects
            processNestedKeys(value, currentPath);
          } else {
            // Add jsonb_set for the current key
            const path = currentPath.join(',');
            jsonbSetQuery = `jsonb_set(${jsonbSetQuery}, '{${path}}', $${index}::jsonb)`;
            values.push(stringifyJSON(value));
            index++;
          }
        });
      };

      processNestedKeys(data.config);
      setClause.push(`"config" = ${jsonbSetQuery}`);
      delete data.config; // Remove `config` from the main data object
    }

    // Handle other updates
    Object.entries(data).forEach(([key, value]) => {
      setClause.push(
        specialFields[key]
          ? `"${key}" = "${key}" ${specialFields[key]} $${index}` // Use specified operator (e.g., "+", "-")
          : `"${key}" = $${index}`,
      );
      values.push(value);
      index++;
    });

    // Build the WHERE clause
    const whereClause = Object.entries(whereCondition).map(([key, value]) => {
      values.push(value);
      return `"${key}" = $${index++}`;
    });

    // Add RETURNING clause if required
    const returningClause = options.returnUpdated ? 'RETURNING *' : '';

    // Build the final query
    const query = `UPDATE "${tableName}" SET ${setClause.join(', ')} WHERE ${whereClause.join(' AND ')} ${returningClause}`;

    // Execute the query
    const result = await executeQuery(query, values, conn);

    if (!result || !result.rows || result.rows.length === 0) {
      logger.warn(
        'No rows updated. Please check the provided IDs and conditions.',
      );
      throw new Error(
        'No rows updated. Please check the provided IDs and conditions.',
      );
    }

    return result.rows[0]; // Return the updated row
  } catch (error) {
    logger.error('Error in buildAndExecuteUpdateQuery:', error);
    throw new Error(error.message || 'Error updating the database.');
  }
};

export const transactionWrapper =
  (fn) =>
  async (...args) => {
    let conn; 
    let committed = false; ;
    try {
      conn = await getConnection();
      await beginTransaction(conn);

      const data = await fn(conn, ...args);

      await commit(conn); 
      committed = true;
      return data;
    } catch (error) {
      // Only attempt rollback if the connection is still valid
      if (conn && !committed) {
        try {
          if (!error.message?.includes('ECONNRESET')) {
            await rollback(conn);
            logger.error('Transaction rolled back due to error:', error);
          } else {
            logger.error('Connection reset detected, skipping rollback');
          }
        } catch (rollbackError) {
          logger.error(
            'Rollback failed (likely due to closed connection):',
            rollbackError,
          );
        }
      }

      // Check for retry able deadlock/serialization errors
      const isDeadlock =
        error.message &&
        (error.message.includes('deadlock') ||
          error.message.includes('could not serialize access') ||
          error.message.includes('canceling statement due to lock timeout') ||
          error.message.includes('lock timeout') ||
          ['40P01', '40001', '55P03'].includes(error.code));

      if (isDeadlock) {
        logger.warn('Deadlock detected. Retrying transaction...');
        if (conn) {
          try {
            conn.release();
          } catch {
            logger.error('Failed to release connection after deadlock:', error);
          }
          conn = null;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
        // Retry the same transaction ONCE if we detected a deadlock
        return await transactionWrapper(fn)(...args);
      }

      throw error;
    } finally {
      if (conn) conn.release();
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

const executePaginatedQuery = async ({
  baseQuery,
  countQuery,
  params = [],
  page = 1,
  limit = 10,
}) => {
  // Convert page and limit to integers
  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 10;
  const offset = (pageNum - 1) * limitNum;
  logger.info(typeof offset, offset, pageNum, 'offset');

  // Base query params include limit and offset
  const validParams = params.filter((param) => param !== undefined);
  const baseQueryParams = [...validParams, limitNum, offset];
  logger.info(baseQueryParams, 'baseQueryParams');
  // Count query params exclude limit and offset
  const countQueryParams = [...params];

  const limitPlaceholder = `$${baseQueryParams.length - 1 + 1}`; // Correct index
  const offsetPlaceholder = `$${baseQueryParams.length + 1}`;

  logger.info(
    `${baseQuery} LIMIT $${limitPlaceholder.length - 1} OFFSET $${offsetPlaceholder.length}`,
    '-------',
  );

  const [result, countResult] = await Promise.all([
    executeQuery(
      `${baseQuery} LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`,
      baseQueryParams,
    ),
    executeQuery(countQuery, countQueryParams), // Use only the params needed for countQuery
  ]);

  return {
    rows: result.rows,
    totalCount: parseInt(countResult.rows[0].total),
  };
};

const buildSearchConditions = (
  searchTerms,
  searchableFields,
  paramStart = 1,
) => {
  if (!searchTerms?.length)
    return { conditions: [], params: [], nextParam: paramStart };

  const params = [];
  let paramCount = paramStart;

  const conditions = searchTerms.map((term) => {
    const fieldConditions = searchableFields.map(
      (field) => `${field} ILIKE '%' || $${paramCount++} || '%'`,
    );
    params.push(term);
    return `(${fieldConditions.join(' OR ')})`;
  });

  return {
    conditions: conditions.length ? [`(${conditions.join(' AND ')})`] : [],
    params,
    nextParam: paramCount,
  };
};

const buildFilterConditions = (filters, fieldMap, paramStart = 1) => {
  const params = [];
  let paramCount = paramStart;

  const conditions = Object.entries(filters)
    .filter(([_, value]) => value !== undefined && value !== null)
    .map(([key, value]) => {
      const field = fieldMap[key];
      if (!field) return null;
      params.push(value);
      return `${field} = $${paramCount++}`;
    })
    .filter(Boolean);

  return { conditions, params, nextParam: paramCount };
};

const generateQuery = (baseQuery, options = {}) => {
  // Default options
  const {
    tableName = 'CheckUtrHistory',
    sortOrder = 'DESC',
    companyIdParam = '$1',
  } = options;

  // Build the additional conditions
  const additionalConditions = `
      AND "${tableName}".is_obsolete = false 
      AND "${tableName}"."company_id" = ${companyIdParam}
      ORDER BY "${tableName}"."created_at" ${sortOrder}
  `;

  // Combine base query with additional conditions
  const finalQuery = `${baseQuery} ${additionalConditions}`;

  return finalQuery;
};

export {
  // pool,
  getConnection,
  beginTransaction,
  commit,
  rollback,
  executePaginatedQuery,
  buildSearchConditions,
  buildFilterConditions,
  generateQuery,
};
