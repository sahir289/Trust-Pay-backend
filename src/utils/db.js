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
    const styledServerMessage =  chalk.bgCyanBright(
        `Database connected successfully`,
      );
    logger.log(`${styledServerMessage}`, 'info');
    return client;
  } catch (error) {
    logger.log(`Error fetching database connection:`, 'error', error);
    throw new DbError('Database connection error');
  }
};

export { pool, getConnection };
