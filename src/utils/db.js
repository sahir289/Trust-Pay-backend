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

export const buildSelectQuery = (baseQuery, f, columns, p, ps, s, o, isJson = true ,user) => {
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
  if(user){
    for (const key in user) {
      const value = user[key];
      if (value) {
        conditions.push(`"${key}" = $${values.length + 1}`);
        values.push(value);
      }
    }
  }
  conditions.push(`is_obsolete = false`);
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
  const query = `INSERT INTO "${tableName}" (${keys.join(', ')}) VALUES (${values}) RETURNING id`;
  return [query, Object.values(data)];
}

// specialFields { balance: "+" }
// whereCondition { id: 1 }
// data { balance: 1000 }
export const buildUpdateQuery = (tableName, data, whereCondition, specialFields = {}) => {
  const values = [];

  const setClause = Object.entries(data).map(([key, value]) => {
    values.push(value);
    return specialFields[key]
      ? `"${key}" = "${key}" ${specialFields[key]} $${values.length}`  // Use specified operator
      : `"${key}" = $${values.length}`;
  });

  const whereClause = Object.entries(whereCondition).map(([key, value]) => {
    values.push(value);
    return `"${key}" = $${values.length}`;
  });

  const query = `UPDATE "${tableName}" SET ${setClause.join(', ')} WHERE ${whereClause.join(' AND ')} RETURNING id`;
  return [query, values];
};


export const transactionWrapper = (fn) => async (...args) => {
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
        console.error('Transaction rolled back due to error:', error);
      } catch (rollbackError) {
        console.error('Rollback failed:', rollbackError);
      }
    }
    throw new DbError(error.message); // Rethrow error
  } finally {
    if (conn) {
      console.log('Releasing connection');
      conn.release(); // Always release connection
    }
  }
};

export { pool, getConnection, beginTransaction, commit, rollback };
