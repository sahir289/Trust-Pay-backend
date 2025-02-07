import pkg from 'pg';
import Logger from './logger.js';
import config from '../config/config.js';
import chalk from 'chalk';
import { DbError } from './appErrors.js';

const { Pool } = pkg;
const logger = new Logger();
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
    logger.log(`${styledServerMessage}`, 'info');
    return client;
  } catch (error) {
    logger.log(`Error fetching database connection:`, 'error', error);
    throw new DbError('Database connection error');
  }
};

const beginTransaction = async (client) => {
  try {
    await client.query('BEGIN');
    logger.log('Transaction started', 'info');
  } catch (error) {
    logger.log('Error starting transaction', 'error', error);
    throw new DbError('Failed to start transaction');
  }
};

const commit = async (client) => {
  try {
    await client.query('COMMIT');
    logger.log('Transaction committed', 'info');
  } catch (error) {
    logger.log('Error committing transaction', 'error', error);
    throw new DbError('Failed to commit transaction');
  }
};

const rollback = async (client, throwError = true) => {
  try {
    await client.query('ROLLBACK');
    logger.log('Transaction rolled back', 'info');
  } catch (error) {
    logger.log('Error rolling back transaction', 'error', error);
    if (throwError) {
      throw new DbError('Failed to rollback transaction');
    }
  }
};

export const executeQuery = async (query, queryParams = []) => {
  let conn;
  try {
    conn = await getConnection();
    await beginTransaction(conn);
    const result = await conn.query(query, queryParams);
    await commit(conn);
    return result;
  } catch (error) {
    logger.log('Error while executing query', 'error', error);
    logger.log(`\nQuery: ${query}\nParams: [${queryParams}]`, 'error')
    await rollback(conn, false); // Rollback the transaction if an error occurs
    throw new DbError(error.message);
  } finally {
    if (conn) {
      console.log('Releasing connection');
      conn.release(); // Release the connection back to the pool
    }
  }
}

export const buildSelectQuery = (query, filters) => {
  const conditions = [];
  const queryParams = [];
  let sql = query;
  // Dynamically build the query
  for (const key in filters) {
    const value = filters[key];
    if (value !== undefined && value !== null) {
      conditions.push(`${key} = $${queryParams.length + 1}`);
      queryParams.push(value);
    }
  }

  // Append conditions to the SQL query
  if (conditions.length) {
    sql += ` AND ${conditions.join(' AND ')}`;
  }

  return [sql, queryParams];
}

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
export { pool, getConnection, beginTransaction, commit, rollback };
