import pkg from 'pg';
import config from '../config/config.js';
import chalk from 'chalk';
import { DbError } from './appErrors.js';

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
    const styledServerMessage = chalk.bgCyanBright('Database connected successfully');
    console.log(`${styledServerMessage}`);
    return client;
  } catch (error) {
    console.error(`Error fetching database connection:`, error);
    throw new DbError('Database connection error');
  }
};

const beginTransaction = async (client) => {
  try {
    await client.query('BEGIN');
    console.log('Transaction started');
  } catch (error) {
    console.error('Error starting transaction', error);
    throw new DbError('Failed to start transaction');
  }
};

const commit = async (client) => {
  try {
    await client.query('COMMIT');
    console.log('Transaction committed');
  } catch (error) {
    console.error('Error committing transaction', error);
    throw new DbError('Failed to commit transaction');
  }
};

const rollback = async (client, throwError = true) => {
  try {
    await client.query('ROLLBACK');
    console.log('Transaction rolled back');
  } catch (error) {
    console.error('Error rolling back transaction', error);
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
    console.error('Error while executing query', error);
    console.error(`\nQuery: ${query}\nParams: [${queryParams}]`);
    throw new DbError(error.message);
  }
}

export const buildSelectQuery = (baseQuery, f, columns, p, ps, s, o, isJson = true) => {
  const page = p || 1, pageSize = ps || 10, sortBy = s || "created_at", sortOrder = o || "DESC";
  let filters = {};

  if (isJson) {
    filters = f;
  } else {
    for (const key of columns) {
      filters[key] = f;
    }
  }

  let query = baseQuery;
  let values = [];
  let conditions = [];

  // Apply filters
  for (const key in filters) {
    const value = filters[key];
    if (typeof value === 'string' && value.includes(',')) {
      conditions.push(`"${key}" = ANY($${values.length + 1})`);
      values.push(value.split(','));
      continue;
    }
    if (value) {
      conditions.push(`"${key}" = $${values.length + 1}`);
      values.push(value);
    }
  }

  if (conditions.length) {
    query += ` AND ${conditions.join(' AND ')}`;
  }

  // Apply sorting and pagination
  query = applySortingAndPagination(query, values, columns, sortBy, sortOrder, page, pageSize);

  return [query, values];
};

export const applySortingAndPagination = (query, values, columns = [], sortBy, sortOrder, page, pageSize) => {
  // Ensure sorting column exists
  if (!columns.includes(sortBy)) {
    sortBy = "created_at"; // Default fallback
  }

  // Validate sort order
  const order = sortOrder.toUpperCase() === "DESC" ? "DESC" : "ASC";

  // Add sorting
  query += ` ORDER BY "${sortBy}" ${order}`;

  // Add pagination
  const offset = (page - 1) * pageSize;
  query += ` LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
  values.push(pageSize, offset);

  return query;
};

export const buildInsertQuery = (tableName, data) => {
  const keys = Object.keys(data).map((key) => `"${key}"`);
  const values = keys.map((el, i) => `$${i + 1}`);
  const query = `INSERT INTO "${tableName}" (${keys.join(', ')}) VALUES (${values}) RETURNING *`;
  return [query, Object.values(data)];
}

export const buildUpdateQuery = (tableName, data, whereCondition) => {
  const values = Object.values(data);
  const whereValues = Object.values(whereCondition);
  const keys = Object.keys(data).map((key, i) => `"${key}" = $${i + 1}`);
  const whereKeys = Object.keys(whereCondition).map((key, i) => `"${key}" = $${i + 1 + keys.length}`);
  const query = `UPDATE "${tableName}" SET ${keys.join(', ')} WHERE ${whereKeys.join(' AND ')} RETURNING *`;
  const params = [...values, ...whereValues];
  return [query, params];
}

export const transactionWrapper = (fn) => async (...args) => {
  let conn;
  try {
    conn = await getConnection();
    await beginTransaction(conn);
    await Promise.resolve(fn(conn, ...args));
    await commit(conn);
  } catch (error) {
    await rollback(conn, false); // Rollback the transaction if an error occurs
    console.error('Error while executing query', error);
    console.error(`\nQuery: ${query}\nParams: [${queryParams}]`);
    throw new DbError(error.message);
  } finally {
    if (conn) {
      console.log('Releasing connection');
      conn.release(); // Release the connection back to the pool
    }
  }
}

export { pool, getConnection, beginTransaction, commit, rollback };
