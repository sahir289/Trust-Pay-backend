/* eslint-disable no-unused-vars */
import pkg from 'pg';
import config from '../config/config.js';
import chalk from 'chalk';
import { DbError, InternalServerError } from './appErrors.js';
import { logger } from './logger.js';
import { stringifyJSON } from './index.js';
import { trackDbConnection } from './dbConnectionTracker.js';
// import fs from 'fs';
// import path from 'path';
// import { fileURLToPath } from 'url';
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);
const { Pool } = pkg;

const parseEnvPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const DB_CONN_HOLD_WARN_MS = parseEnvPositiveInt(
  process.env.DB_CONN_HOLD_WARN_MS,
  config.env === 'production' ? 60000 : 30000,
);

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

  const parsePositiveInt = (value, fallback) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };

  const isWriter = name === 'Writer';
  const defaultMax = config.env === 'production' ? 20 : 10;
  const defaultMin = config.env === 'production' ? 2 : 1;

  const globalMax = parsePositiveInt(process.env.DB_POOL_MAX, defaultMax);
  const globalMin = parsePositiveInt(process.env.DB_POOL_MIN, defaultMin);
  const poolMax = parsePositiveInt(
    isWriter ? process.env.DB_WRITER_POOL_MAX : process.env.DB_READER_POOL_MAX,
    globalMax,
  );
  const poolMinRaw = parsePositiveInt(
    isWriter ? process.env.DB_WRITER_POOL_MIN : process.env.DB_READER_POOL_MIN,
    globalMin,
  );
  const poolMin = Math.min(poolMinRaw, poolMax);
  const poolConnectionTimeout = parsePositiveInt(
    process.env.DB_CONNECTION_TIMEOUT_MS,
    20000,
  );
  const poolIdleTimeout = parsePositiveInt(
    process.env.DB_IDLE_TIMEOUT_MS,
    10000,
  );

  const pool = new Pool({
    connectionString: connectionString,
    ssl:
      config.env === 'production'
        ? {
            rejectUnauthorized: false,
            // ca: fs.readFileSync(path.join(__dirname, 'ap-south-1-bundle.pem')).toString(),
          }
        : { rejectUnauthorized: false },
    max: poolMax,
    min: poolMin,
    idleTimeoutMillis: poolIdleTimeout,
    connectionTimeoutMillis: poolConnectionTimeout,
    keepAlive: true,
    maxUses: 7500,
  });

  pool.on('connect', async (client) => {
    try {
      await client.query("SET TIME ZONE 'Asia/Kolkata'");
    } catch (err) {
      logger.error(`Failed to set timezone for ${name}:`, err);
      throw err; // Reject the connection if timezone can't be set
    }
  });

  let reconnecting = false; // Prevent multiple simultaneous reconnection attempts

  pool.on('error', async (err, client) => {
    logger.error(`Unexpected error on idle client (${name}):`, err);

    // For connection reset errors (laptop sleep/wake, network issues)
    if (err.code === 'ECONNRESET' || err.code === 'EPIPE') {
      logger.warn(
        `Connection reset detected for ${name} pool. Pool will automatically recover.`,
      );
      // The pool will automatically remove the bad connection and create new ones
      // No manual intervention needed
      return;
    }

    // Prevent multiple concurrent reconnection attempts
    if (reconnecting) {
      logger.warn(
        `Reconnection already in progress for ${name}, skipping duplicate attempt`,
      );
      return;
    }

    reconnecting = true;
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
        reconnecting = false;
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
    reconnecting = false;
  });
  return pool;
};

const writerPool = createPool(config?.databaseWriterUrl, 'Writer');
const readerPool = createPool(config?.databaseReaderUrl, 'Reader');
const DB_TX_STATE = Symbol('dbTransactionState');

const getTransactionState = (client) => client?.[DB_TX_STATE] ?? null;

const setTransactionState = (client, nextState) => {
  if (!client) return;
  client[DB_TX_STATE] = {
    ...getTransactionState(client),
    ...nextState,
  };
};

const clearTransactionState = (client) => {
  if (!client?.[DB_TX_STATE]) return;
  delete client[DB_TX_STATE];
};

/**
 * Monitor pool health - warn when running low on connections
 */
if (config.env === 'production') {
  const POOL_CHECK_INTERVAL = 30000; // Check every 30s in production
  const WARNING_THRESHOLD = 0.8; // Warn when 80% of pool used

  setInterval(() => {
    const stats = getPoolStats();

    // Check writer pool against configured max capacity
    if (stats.writer.max > 0) {
      const writerActive = stats.writer.total - stats.writer.idle;
      const writerUsage = writerActive / stats.writer.max;
      if (writerUsage >= WARNING_THRESHOLD) {
        logger.warn(
          `[DB Pool] Writer pool ${(writerUsage * 100).toFixed(0)}% used (${writerActive}/${stats.writer.max}), created=${stats.writer.total}, idle=${stats.writer.idle}, waiting=${stats.writer.waiting}`,
        );
      }
    }

    // Check reader pool against configured max capacity
    if (stats.reader.max > 0) {
      const readerActive = stats.reader.total - stats.reader.idle;
      const readerUsage = readerActive / stats.reader.max;
      if (readerUsage >= WARNING_THRESHOLD) {
        logger.warn(
          `[DB Pool] Reader pool ${(readerUsage * 100).toFixed(0)}% used (${readerActive}/${stats.reader.max}), created=${stats.reader.total}, idle=${stats.reader.idle}, waiting=${stats.reader.waiting}`,
        );
      }
    }
  }, POOL_CHECK_INTERVAL);
}

/**
 * Get current pool statistics for monitoring
 */
export const getPoolStats = () => {
  return {
    writer: {
      total: writerPool.totalCount,
      idle: writerPool.idleCount,
      waiting: writerPool.waitingCount,
      max: writerPool.options?.max || 0,
    },
    reader: {
      total: readerPool.totalCount,
      idle: readerPool.idleCount,
      waiting: readerPool.waitingCount,
      max: readerPool.options?.max || 0,
    },
  };
};

/**
 * Check database health
 */
export const checkDatabaseHealth = async () => {
  let client;
  try {
    client = await writerPool.connect();
    await client.query('SELECT 1');
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      pools: getPoolStats(),
    };
  } catch (error) {
    logger.error('Database health check failed:', error);
    return {
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString(),
      pools: getPoolStats(),
    };
  } finally {
    if (client) client.release();
  }
};

/**
 * getConnection
 * @param {string} type - "reader" | "writer"
 */
const getConnection = async (type = 'writer') => {
  const maxRetries = 5;
  const baseDelay = 2000;
  const acquireTimeoutMs = 30000;

  for (let retryCount = 0; retryCount < maxRetries; retryCount++) {
    try {
      const pool = type === 'reader' ? readerPool : writerPool;

      // Add safe acquisition timeout (no leaked clients on late resolve)
      const client = await new Promise((resolve, reject) => {
        let settled = false;

        const timeoutId = setTimeout(() => {
          settled = true;
          reject(
            new Error(
              `Connection acquisition timeout after ${acquireTimeoutMs}ms`,
            ),
          );
        }, acquireTimeoutMs);

        pool
          .connect()
          .then((acquiredClient) => {
            if (settled) {
              // Timeout already fired - release late client to avoid pool leak
              try {
                acquiredClient.release();
              } catch {
                // no-op
              }
              return;
            }

            settled = true;
            clearTimeout(timeoutId);
            resolve(acquiredClient);
          })
          .catch((connectError) => {
            if (settled) return;

            settled = true;
            clearTimeout(timeoutId);
            reject(connectError);
          });
      });

      // Add tracking (capture caller file/line best-effort)
      const stack = new Error('DB connection checkout stack')
        .stack?.split('\n')
        .slice(2, 6)
        .join('\n');
      trackDbConnection({ stack });

      const checkoutAt = Date.now();
      const checkoutStack = new Error('DB connection hold stack')
        .stack
        ?.split('\n')
        .slice(2, 8)
        .join('\n');
      const originalRelease = client.release.bind(client);
      let released = false;

      const holdWarnTimer = setTimeout(() => {
        if (released) return;

        logger.warn('[DB Connection] Connection held beyond threshold', {
          type,
          heldMs: Date.now() - checkoutAt,
          thresholdMs: DB_CONN_HOLD_WARN_MS,
          pools: getPoolStats(),
          checkoutStack,
        });
      }, DB_CONN_HOLD_WARN_MS);

      if (typeof holdWarnTimer.unref === 'function') {
        holdWarnTimer.unref();
      }

      client.release = (...args) => {
        if (released) {
          if (config.env !== 'production') {
            logger.warn('[DB Connection] Duplicate release detected', {
              type,
              checkoutStack,
            });
          }
          return undefined;
        }

        released = true;
        clearTimeout(holdWarnTimer);

        const heldMs = Date.now() - checkoutAt;
        const txState = getTransactionState(client);

        if (
          txState?.state === 'open' ||
          txState?.state === 'rollback-failed'
        ) {
          logger.error(
            '[DB Connection] Dirty transaction detected during release; destroying client',
            {
              type,
              heldMs,
              txState,
              pools: getPoolStats(),
              checkoutStack,
            },
          );
          clearTransactionState(client);
          return originalRelease(true);
        }

        if (heldMs >= DB_CONN_HOLD_WARN_MS) {
          logger.warn('[DB Connection] Long-held connection released', {
            type,
            heldMs,
            thresholdMs: DB_CONN_HOLD_WARN_MS,
            pools: getPoolStats(),
            checkoutStack,
          });
        }

        clearTransactionState(client);
        return originalRelease(...args);
      };

      // Only log in development or on first connection
      if (config.env !== 'production' || retryCount > 0) {
        logger.info('Database connected successfully');
      }
      return client;
    } catch (error) {
      const errorMessage = error?.message || '';
      const isPoolSaturationError =
        error?.code === '53300' ||
        errorMessage.includes('too many clients already') ||
        errorMessage.includes('remaining connection slots are reserved') ||
        errorMessage.includes('timeout exceeded when trying to connect') ||
        errorMessage.includes('Connection acquisition timeout');

      if (isPoolSaturationError) {
        logger.error('DB connection pool saturation detected. Failing fast.', {
          type,
          error,
          pools: getPoolStats(),
        });
        throw new DbError(error.message, {
          code: error.code,
          cause: error,
        });
      }

      const delay = baseDelay * Math.pow(2, retryCount);
      logger.error(`Error fetching database connection:`, error);
      logger.warn(
        `DB connection failed (Attempt ${retryCount + 1}). Retrying in ${delay / 1000}s...`,
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

export const dbPoolMonitor = () => {
  try {
    const stats = getPoolStats();

    // Validate stats exist
    if (!stats || !stats.writer || !stats.reader) {
      logger.warn('DATABASE_ALERT: Pool stats unavailable');
      return;
    }

    // Alert if connection wait queue is building up (> 5 waiting connections)
    if (stats.writer.waiting > 5 || stats.reader.waiting > 5) {
      logger.error('DATABASE_ALERT: High connection wait queue!', stats);
    }

    // Calculate pool utilization (prevent division by zero)
    const writerUtilization =
      stats.writer.max > 0
        ? ((stats.writer.total - stats.writer.idle) / stats.writer.max) * 100
        : 0;
    const readerUtilization =
      stats.reader.max > 0
        ? ((stats.reader.total - stats.reader.idle) / stats.reader.max) * 100
        : 0;

    // Alert if pool utilization is too high (> 80%)
    if (writerUtilization > 80) {
      logger.warn(
        `DATABASE_ALERT: High writer pool usage: ${writerUtilization.toFixed(1)}%`,
        {
          active: stats.writer.total - stats.writer.idle,
          totalCreated: stats.writer.total,
          max: stats.writer.max,
          waiting: stats.writer.waiting,
        },
      );
    }

    if (readerUtilization > 80) {
      logger.warn(
        `DATABASE_ALERT: High reader pool usage: ${readerUtilization.toFixed(1)}%`,
        {
          active: stats.reader.total - stats.reader.idle,
          totalCreated: stats.reader.total,
          max: stats.reader.max,
          waiting: stats.reader.waiting,
        },
      );
    }
  } catch (error) {
    logger.error('DATABASE_ALERT: Pool monitoring error:', error);
  }
};

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
  setTransactionState(client, {
    state: 'open',
    startedAt: new Date().toISOString(),
    beginStack: new Error('Transaction begin stack')
      .stack?.split('\n')
      .slice(2, 8)
      .join('\n'),
  });
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
  clearTransactionState(client);
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
    clearTransactionState(client);
    logger.info('Transaction rolled back');
  } catch (error) {
    setTransactionState(client, {
      state: 'rollback-failed',
      rollbackFailedAt: new Date().toISOString(),
      rollbackError: error?.message,
    });
    logger.warn(
      'Rollback skipped / failed (transaction already closed or connection dead)',
      error,
    );
  }
};

export const executeQuery = async (query, queryParams = [], conn = null) => {
  const maxRetries = 3;
  const isSelect = query.trim().toUpperCase().startsWith('SELECT');
  const pool = isSelect ? readerPool : writerPool;
  const usingExternalTransactionConn = Boolean(conn);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    let client = null;
    const db = conn ?? (client = await pool.connect());

    try {
      const result = await db.query(query, queryParams);
      return result;
    } catch (error) {
      if (error.message?.includes('timeout')) {
        logger.error('[DB Timeout] Pool stats:', getPoolStats());
      }

      logger.error(`DB Error (Attempt ${attempt})`, {
        query,
        params: queryParams,
        error,
      });

      // IMPORTANT: never retry on an externally managed transaction connection.
      // If a statement fails inside a transaction (e.g. 57014 statement timeout,
      // 55P03 lock timeout), PostgreSQL marks the whole transaction as aborted.
      // Retrying on the same connection only causes 25P02 cascades until rollback.
      if (usingExternalTransactionConn) {
        throw new DbError(error.message, {
          code: error.code,
          cause: error,
        });
      }

      const isTransientError =
        error.code === 'ECONNRESET' ||
        error.code === 'ECONNREFUSED' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'EPIPE' ||
        error.code === 'ENOTFOUND' ||
        error.message?.includes('Connection terminated unexpectedly') ||
        error.message?.includes('timeout');

      if (isTransientError && attempt < maxRetries) {
        const delay = attempt * 1000;
        logger.warn(`Retrying DB query in ${delay}ms (Attempt ${attempt + 1})`);
        await new Promise((res) => setTimeout(res, delay));
        continue;
      }

      throw new DbError(error.message, {
        code: error.code,
        cause: error,
      });
    } finally {
      if (client) {
        client.release();
      }
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
      // Validate variablePart to prevent SQL injection (only allow alphanumeric and underscore)
      if (!/^[a-zA-Z0-9_]+$/.test(variablePart)) {
        throw new Error(`Invalid config field name: ${variablePart}`);
      }
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
  isdelete
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
          const path = currentPath.join(',');
          // merging merchant_added object
          if (
            key === 'merchant_added' &&
            typeof value === 'object' &&
            !Array.isArray(value)
          ) {
            const mergeSnippet = `coalesce(${jsonbSetQuery}#>'{${path}}', '{}'::jsonb) || $${index}::jsonb`;
            jsonbSetQuery = `jsonb_set(${jsonbSetQuery}, '{${path}}', ${mergeSnippet})`;
            values.push(stringifyJSON(value));
            index++;
          } else if (value && typeof value === 'object' && !Array.isArray(value)) {
            // Recursively process nested objects
            processNestedKeys(value, currentPath);
          } else if (value === null || value === undefined) {
            // Remove the key from config if value is null/undefined
            jsonbSetQuery = `${jsonbSetQuery} - '{${path}}'`;
          } else {
            // Add jsonb_set for the current key
            jsonbSetQuery = `jsonb_set(${jsonbSetQuery}, '{${path}}', $${index}::jsonb)`;
            values.push(stringifyJSON(value));
            index++;
          }
        });
      };
      processNestedKeys(data.config);
      setClause.push(`"config" = ${jsonbSetQuery}`);
      delete data.config;
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
      if (!isdelete) {
        throw new Error(
          'No rows updated. Please check the provided IDs and conditions.',
        );
      }
    }

    return result.rows[0]; // Return the updated row
  } catch (error) {
    logger.error('Error in buildAndExecuteUpdateQuery:', error);
    throw new Error(error.message || 'Error updating the database.');
  }
};

export const transactionWrapper =
  (fn, maxDeadlockRetries = 3) =>
  async (...args) => {
    let conn;
    let committed = false;
    let deadlockAttempts = 0;

    const executeWithRetry = async () => {
      try {
        conn = await getConnection();
        // Set statement timeout for this transaction (60 seconds)
        await conn.query("SET LOCAL statement_timeout = '60s'");
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
          deadlockAttempts++;
          if (deadlockAttempts >= maxDeadlockRetries) {
            logger.error(
              `Max deadlock retries (${maxDeadlockRetries}) exceeded. Giving up.`,
            );
            throw error;
          }

          logger.warn(
            `Deadlock detected. Retry ${deadlockAttempts}/${maxDeadlockRetries}...`,
          );
          if (conn) {
            try {
              conn.release();
            } catch {
              logger.error(
                'Failed to release connection after deadlock:',
                error,
              );
            }
            conn = null;
          }
          // Add jitter (500ms - 1500ms) to prevent thundering herd
          const jitter = Math.random() * 1000 + 500;
          await new Promise((resolve) => setTimeout(resolve, jitter));
          // Retry the transaction
          return await executeWithRetry();
        }

        throw error;
      } finally {
        if (conn) conn.release();
      }
    };

    return await executeWithRetry();
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
/**
 * Validate column/table name to prevent SQL injection
 */
const isValidIdentifier = (name) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);

export const buildJoinQuery = (table, columns = '*', joins = []) => {
  // Validate table name
  if (!isValidIdentifier(table)) {
    throw new Error(`Invalid table name: ${table}`);
  }

  let selectCols =
    columns === '*'
      ? [`"${table}".*`]
      : columns.map((col) => {
          if (!isValidIdentifier(col)) {
            throw new Error(`Invalid column name: ${col}`);
          }
          return `"${table}".${col}`;
        });
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

    // Validate join table name
    if (!isValidIdentifier(jTable)) {
      throw new Error(`Invalid join table name: ${jTable}`);
    }

    const referenceTable = rTable || table;
    if (rTable && !isValidIdentifier(rTable)) {
      throw new Error(`Invalid reference table name: ${rTable}`);
    }

    // Auto-generate ON condition
    let onCondition = '';
    if (keys) {
      if (typeof keys === 'string') {
        if (!isValidIdentifier(keys)) {
          throw new Error(`Invalid key name: ${keys}`);
        }
        // If keys is a string, use the same key for both tables
        onCondition = `"${referenceTable}".${keys} = "${jTable}".${keys}`;
      } else if (Array.isArray(keys) && keys.length === 2) {
        if (!isValidIdentifier(keys[0]) || !isValidIdentifier(keys[1])) {
          throw new Error(`Invalid key names: ${keys.join(', ')}`);
        }
        // If keys is an array, assume different keys for each table
        onCondition = `"${referenceTable}".${keys[0]} = "${jTable}".${keys[1]}`;
      }
    }

    // Add selected columns
    for (const col of columns) {
      if (!isValidIdentifier(col)) {
        throw new Error(`Invalid column name: ${col}`);
      }
      selectCols.push(`"${jTable}".${col}`);
    }
    for (const colAs of columnAs) {
      // columnAs can have aliases, so we don't validate them (they're developer-defined)
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

  // Base query params include limit and offset
  const validParams = params.filter((param) => param !== undefined);
  const baseQueryParams = [...validParams, limitNum, offset];
  // Count query params exclude limit and offset
  const countQueryParams = [...params];

  const limitPlaceholder = `$${baseQueryParams.length - 1 + 1}`; // Correct index
  const offsetPlaceholder = `$${baseQueryParams.length + 1}`;

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
