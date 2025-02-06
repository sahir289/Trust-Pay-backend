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

const rollback = async (client) => {
  try {
    await client.query('ROLLBACK');
    logger.log('Transaction rolled back', 'info');
  } catch (error) {
    logger.log('Error rolling back transaction', 'error', error);
    throw new DbError('Failed to rollback transaction');
  }
};

export { pool, getConnection, beginTransaction, commit, rollback };
