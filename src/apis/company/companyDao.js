import {
  buildInsertQuery,
  buildSelectQuery,
  buildUpdateQuery,
  executeQuery,
  buildAndExecuteUpdateQuery,
} from '../../utils/db.js';
import { tableName } from '../../constants/index.js';
import { logger } from '../../utils/logger.js';

const getCompanyDao = async (
  filters,
  page,
  pageSize,
  sortBy,
  sortOrder,
  conn,
) => {
  try {
    const baseQuery = `SELECT id,first_name,last_name,config FROM "${tableName.COMPANY}" WHERE 1=1`;
    //TODO: columns.Company dynamic search
    const [sql, queryParams] = buildSelectQuery(
      baseQuery,
      filters,
      page,
      pageSize,
      sortBy,
      sortOrder,
    );
    const result = await executeQuery(sql, queryParams, conn);
    return result.rows.length > 0 ? result.rows : result.rows[0];
  } catch (error) {
    logger.error('Error fetching company:', error);
    throw error;
  }
};

const getCompanyDetailsByIdDao = async (id, conn = null) => {
  try {
    const baseQuery = `SELECT CONCAT(first_name, ' ', last_name) AS full_name, config FROM "${tableName.COMPANY}" WHERE 1 = 1`;
    const [sql, queryParams] = buildSelectQuery(baseQuery, id);
    const result = await executeQuery(sql, queryParams, conn);
    if (!result.rows.length) return null;
    const { full_name, config } = result.rows[0];
    // Include all keys that start with allow_payin_ or allow_payout_, as camelCase
    const toCamelCase = (str) =>
      str
        .replace(/_([a-zA-Z0-9])/g, (_, c) => (c ? c.toUpperCase() : ''))
        .replace(/^([A-Z])/, (m) => m.toLowerCase());
    const filteredConfig = {};
    for (const key in config) {
      if (
        Object.prototype.hasOwnProperty.call(config, key) &&
        (key.startsWith('allow_payin_') || key.startsWith('allow_payout_'))
      ) {
        filteredConfig[toCamelCase(key)] = config[key];
      }
    }
    return { full_name, ...filteredConfig };
  } catch (error) {
    logger.error('Error fetching company details by ID:', error);
    throw error;
  }
};

const getClickrrDetailsByCompanyIdDao = async (id, conn = null) => {
  try {
    const sql = `SELECT config -> 'CLICKRR' ->> 'api_key' AS api_key,
    config -> 'CLICKRR' ->> 'api_secret' AS api_secret FROM "${tableName.COMPANY}" WHERE id = $1`;
    const queryParams = [id];
    const result = await executeQuery(sql, queryParams, conn);
    return result.rows.length > 0 ? result.rows[0] : result.rows;
  } catch (error) {
    logger.error('Error fetching clickrr details by companyId:', error);
    throw error;
  }
};

const getBSSDetailsByCompanyIdDao = async (id) => {
  try {
    const sql = `SELECT config -> 'BSS' ->> 'api_key' AS api_key,
    config -> 'BSS' ->> 'api_secret' AS api_secret FROM "${tableName.COMPANY}" WHERE id = $1`;
    const queryParams = [id];
    const result = await executeQuery(sql, queryParams);
    return result.rows.length > 0 ? result.rows[0] : result.rows;
  } catch (error) {
    logger.error('Error fetching BSS details by companyId:', error);
    throw error;
  }
};

const getSilkPayDetailsByCompanyIdDao = async (id) => {
  try {
    const sql = `SELECT config -> 'SILKPAY' ->> 'mId' AS mId,
    config -> 'SILKPAY' ->> 'api_secret' AS api_secret FROM "${tableName.COMPANY}" WHERE id = $1`;
    const queryParams = [id];
    const result = await executeQuery(sql, queryParams);
    return result.rows.length > 0 ? result.rows[0] : result.rows;
  } catch (error) {
    logger.error('Error fetching silkpay details by companyId:', error);
    throw error;
  }
};

const getBSS02DetailsByCompanyIdDao = async (id) => {
  try {
    const sql = `SELECT config -> 'BSS02' ->> 'api_key' AS api_key,
    config -> 'BSS02' ->> 'api_secret' AS api_secret FROM "${tableName.COMPANY}" WHERE id = $1`;
    const queryParams = [id];
    const result = await executeQuery(sql, queryParams);
    return result.rows.length > 0 ? result.rows[0] : result.rows;
  } catch (error) {
    logger.error('Error fetching BSS02 details by companyId:', error);
    throw error;
  }
};

const getBSS03DetailsByCompanyIdDao = async (id) => {
  try {
    const sql = `SELECT config -> 'BSS03' ->> 'api_key' AS api_key,
    config -> 'BSS03' ->> 'api_secret' AS api_secret FROM "${tableName.COMPANY}" WHERE id = $1`;
    const queryParams = [id];
    const result = await executeQuery(sql, queryParams);
    return result.rows.length > 0 ? result.rows[0] : result.rows;
  } catch (error) {
    logger.error('Error fetching BSS03 details by companyId:', error);
    throw error;
  }
};

const getBepayDetailsByCompanyIdDao = async (id, conn = null) => {
  try {
    const sql = `SELECT config -> 'Bepay' ->> 'api_key' AS api_key,
    config -> 'Bepay' ->> 'api_secret' AS api_secret FROM "${tableName.COMPANY}" WHERE id = $1`;
    const queryParams = [id];
    const result = await executeQuery(sql, queryParams, conn);
    return result.rows.length > 0 ? result.rows[0] : result.rows;
  } catch (error) {
    logger.error('Error fetching Bepay details by companyId:', error);
    throw error;
  }
};

const getCashfreeAllowByCompanyIdDao = async (id, conn = null) => {
  try {
    const sql = `
      SELECT 
        CONCAT(first_name, ' ', last_name) AS full_name,
        config
      FROM "${tableName.COMPANY}"
      WHERE id = $1
    `;
    const queryParams = [id];
    const result = await executeQuery(sql, queryParams, conn);
    const row = result.rows[0];
    if (!row) {
      return row;
    }

    // Convert allow_payin_* and allow_payout_* keys to camelCase and include in result
    const toCamelCase = (str) =>
      str
        .replace(/_([a-zA-Z0-9])/g, (_, c) => (c ? c.toUpperCase() : ''))
        .replace(/^([A-Z])/, (m) => m.toLowerCase());
    const filteredConfig = {};
    for (const key in row.config) {
      if (
        Object.prototype.hasOwnProperty.call(row.config, key) &&
        key.startsWith('allow_payin_')
      ) {
        filteredConfig[toCamelCase(key)] = row.config[key];
      }
    }
    return { full_name: row.full_name, ...filteredConfig };
  } catch (error) {
    logger.error('Error fetching company details by ID:', error);
    throw error;
  }
};

const getCompanyByIDDao = async (filters, conn = null) => {
  try {
    const baseQuery = `SELECT id,config FROM "${tableName.COMPANY}" WHERE 1=1`;
    const [sql, queryParams] = buildSelectQuery(baseQuery, filters);
    const result = await executeQuery(sql, queryParams, conn);
    return result.rows.length > 0 ? result.rows : result.rows[0];
  } catch (error) {
    logger.error('Error fetching company:', error);
    throw error;
  }
};

const createCompanyDao = async (payload, conn = null) => {
  try {
    const [sql, params] = buildInsertQuery(tableName.COMPANY, payload);
    const result = await executeQuery(sql, params, conn);
    return result.rows[0];
  } catch (error) {
    logger.error('Error fetching company:', error);
    throw error;
  }
};

const updateCompanyDao = async (id, data, conn = null) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.COMPANY, data, id);
    const result = await executeQuery(sql, params, conn);
    return result.rows[0];
  } catch (error) {
    logger.error('Error updating company:', error); // Log the error for debugging
    throw error;
  }
};
const updateCompanyConfigDao = async (id, data, conn) => {
  try {
    return await buildAndExecuteUpdateQuery(
      tableName.COMPANY,
      data,
      id,
      {},
      { returnUpdated: true },
      conn,
    );
  } catch (error) {
    logger.error('Error updating company config:', error);
    throw error;
  }
};

const deleteCompanyDao = async (id, data, conn = null) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.COMPANY, data, id);
    const result = await executeQuery(sql, params, conn);
    return result.rows[0];
  } catch (error) {
    logger.error('Error deleting company:', error); // Log the error for debugging
    throw error;
  }
};

export {
  getCompanyDao,
  createCompanyDao,
  updateCompanyDao,
  deleteCompanyDao,
  getCompanyByIDDao,
  getClickrrDetailsByCompanyIdDao,
  getBepayDetailsByCompanyIdDao,
  getCashfreeAllowByCompanyIdDao,
  updateCompanyConfigDao,
  getCompanyDetailsByIdDao,
  getBSSDetailsByCompanyIdDao,
  getSilkPayDetailsByCompanyIdDao,
  getBSS02DetailsByCompanyIdDao,
  getBSS03DetailsByCompanyIdDao,
};
