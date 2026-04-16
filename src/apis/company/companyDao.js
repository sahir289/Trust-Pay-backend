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
    const baseQuery = `SELECT CONCAT(first_name, ' ', last_name) AS full_name, config ->> 'allowPayAssist' AS allowPayAssist, config ->> 'allowTataPay' AS allowTataPay, config ->> 'allow_clickrr' AS allow_clickrr, config ->> 'allowRupeeFlow' AS allowRupeeFlow, config ->> 'allowBSS' AS allowBSS, config ->> 'allowSilkPayOut' AS allowSilkPay, config ->> 'allowBSS02' AS allowBSS02, config ->> 'allowBSS03' AS allowBSS03,  config ->> 'allowVertexPay' AS allowVertexPay, config ->> 'allowcps' AS allowcps, config ->> 'allow_payout_runsafe' AS allowrunsafe, config ->> 'allowPayDum' AS allowPayDum, config ->> 'allow_silkpay' AS silkpay_intent, config ->> 'allow_vertexpay' AS vertexpay_intent, config ->> 'allow_runsafe' AS runsafe_intent, config ->> 'allow_payeasy' AS payeasy_intent FROM "${tableName.COMPANY}" WHERE 1 = 1`;
    const [sql, queryParams] = buildSelectQuery(baseQuery, id);
    const result = await executeQuery(sql, queryParams, conn);
    return result.rows.length > 0 ? result.rows : result.rows[0];
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
        COALESCE((config ->> 'allow_cashfree')::boolean, false) AS allow_cashfree,
        COALESCE((config ->> 'allow_zentechind')::boolean, false) AS allow_zentechind,
        COALESCE((config ->> 'allow_nmplpay')::boolean, false) AS allow_nmplpay,
        COALESCE((config ->> 'allow_runsafe')::boolean, false) AS allow_runsafe,
        COALESCE((config ->> 'allowCpsPay')::boolean, false) AS allow_cps,
        COALESCE((config ->> 'allow_razorpay')::boolean, false) AS allow_razorpay,
        COALESCE((config ->> 'allow_silkpay')::boolean, false) AS allow_silkpay,
        COALESCE((config ->> 'allow_orvixpay')::boolean, false) AS allow_orvixpay,
        COALESCE((config ->> 'allow_orvixpay1')::boolean, false) AS allow_orvixpay1,
        COALESCE((config ->> 'allow_payeasy')::boolean, false) AS allow_payeasy
      FROM "${tableName.COMPANY}"
      WHERE id = $1
    `;
    const queryParams = [id];
    const result = await executeQuery(sql, queryParams, conn);
    return result.rows[0];
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
