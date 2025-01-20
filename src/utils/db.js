import pkg from 'pg';
import Logger from './logger';
import config from '../config/config';
const { Pool } = pkg;
const logger = new Logger();

const pool = new Pool({
//   user: 'postgres',
//   password: 'psahir1234',
//   host: 'new-tp-stg.cp0m0y6ag4gv.us-east-1.rds.amazonaws.com',
//   database: 'new-tp-stg',
//   port: 5432,
  connectionString: config.databaseUrl,
  ssl: {
    rejectUnauthorized: false,
  },
});

const getConnection = async () => {
  try {
    const client = await pool.connect();
    logger.log(`Database connected successfully:`, 'info')
    return client;
  } catch (error) {
    logger.log(`Error fetching database connection:`, 'error', error)
    throw new Error('Database connection error');
  }
};

export { pool, getConnection };
