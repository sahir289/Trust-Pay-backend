import {
  buildInsertQuery,
  buildSelectQuery,
  buildUpdateQuery,
  executeQuery,
  isSafeColumnName,
} from '../../utils/db.js';
import { tableName } from '../../constants/index.js';
import { logger } from '../../utils/logger.js';
import { stringifyJSON } from '../../utils/index.js';

const getCompanyDao = async (
  filters,
  page,
  pageSize,
  sortBy,
  sortOrder,
  conn,
) => {
  try {
    const baseQuery = `SELECT id,first_name,last_name,config,email,contact_no,scope FROM "${tableName.COMPANY}" WHERE 1=1 AND scope != 'global'`;
    const { search, ...exactFilters } = filters || {};
    const parsedPage = Number(page);
    const parsedPageSize = Number(pageSize);
    let [sql, queryParams] = buildSelectQuery(
      baseQuery,
      exactFilters,
      parsedPage,
      parsedPageSize,
      sortBy,
      sortOrder,
    );

    if (search) {
      const searchPlaceholder = queryParams.length + 1;
      sql = sql.replace(
        ' ORDER BY',
        ` AND (
          first_name ILIKE $${searchPlaceholder}
          OR last_name ILIKE $${searchPlaceholder}
          OR email ILIKE $${searchPlaceholder}
          OR contact_no ILIKE $${searchPlaceholder}
        ) ORDER BY`,
      );
      queryParams = [...queryParams, `%${search}%`];
    }

    const result = await executeQuery(sql, queryParams, conn);
    return result.rows.length > 0 ? result.rows : result.rows[0];
  } catch (error) {
    logger.error('Error fetching company:', error);
    throw error;
  }
};

const getCompanyDetailsByIdDao = async (id, conn = null) => {
  try {
    const baseQuery = `SELECT CONCAT(first_name, ' ', last_name) AS full_name, scope,
      config ->> 'allowPayAssist' AS allowPayAssist,
      config ->> 'allowTataPay' AS allowTataPay,
      config ->> 'allow_clickrr' AS allow_clickrr,
      config ->> 'allowRupeeFlow' AS allowRupeeFlow,
      config ->> 'allowBSS' AS allowBSS,
      config ->> 'allowSilkPayOut' AS allowSilkPay,
      config ->> 'allowBSS02' AS allowBSS02,
      config ->> 'allowBSS03' AS allowBSS03,
      config ->> 'allowVertexPay' AS allowVertexPay,
      config ->> 'allowcps' AS allowcps,
      config ->> 'allow_payout_runsafe' AS allowrunsafe,
      config ->> 'allowPayDum' AS allowPayDum,
      config ->> 'allow_silkpay' AS silkpay_intent,
      config ->> 'allow_payin_tytl' AS tytl_intent,
      config ->> 'allow_vertexpay' AS vertexpay_intent,
      config ->> 'allow_freechips' AS freechips_intent,
      config ->> 'allowCpsPay' AS cps_intent,
      config ->> 'allow_runsafe' AS runsafe_intent,
      config ->> 'allow_payeasy' AS payeasy_intent,
      config ->> 'allow_payeasy02' AS payeasy02_intent,
      config ->> 'allow_payeasy03' AS payeasy03_intent,
      config ->> 'allow_albecollect' AS albecollect_intent,
      config ->> 'allow_pennypay' AS pennypay_intent,
      config ->> 'allow_trustpay' AS trustpay_intent,
      config ->> 'allow_paybitra' AS paybitra_intent,
      config ->> 'allow_paycric' AS paycric_intent,
      config ->> 'allow_rapidpay' AS rapidpay_intent,
      config ->> 'allow_beetas' AS beetas_intent,
      config ->> 'allow_cashwallet' AS cashwallet_intent,
      config ->> 'allow_payout_trustpay' AS allowtrustpay,
      config ->> 'allow_payout_pennypay' AS allowpennypay,
      config ->> 'allow_payout_paybitra' AS allowpaybitra,
      config ->> 'allow_payout_paycric' AS allowpaycric,
      config ->> 'allow_payout_rapidpay' AS allowrapidpay,
      config ->> 'allow_payout_beetas' AS allowbeetas,
      config ->> 'allowPayInFintech' AS allowPayInFintech,
      config ->> 'allow_payout_freechips' AS allowfreechips,
      config ->> 'allow_payout_payfly' AS allowpayfly
      FROM "${tableName.COMPANY}" WHERE 1 = 1`;
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
        COALESCE((config ->> 'allow_freechips')::boolean, false) AS allow_freechips,
        COALESCE((config ->> 'allow_nmplpay')::boolean, false) AS allow_nmplpay,
        COALESCE((config ->> 'allow_runsafe')::boolean, false) AS allow_runsafe,
        COALESCE((config ->> 'allowCpsPay')::boolean, false) AS allow_cps,
        COALESCE((config ->> 'allow_razorpay')::boolean, false) AS allow_razorpay,
        COALESCE((config ->> 'allow_silkpay')::boolean, false) AS allow_silkpay,
        COALESCE((config ->> 'allow_orvixpay')::boolean, false) AS allow_orvixpay,
        COALESCE((config ->> 'allow_payin_tytl')::boolean, false) AS allow_tytl,
        COALESCE((config ->> 'allow_orvixpay1')::boolean, false) AS allow_orvixpay1,
        COALESCE((config ->> 'allow_albecollect')::boolean, false) AS allow_albecollect,
        COALESCE((config ->> 'allow_cashwallet')::boolean, false) AS allow_cashwallet,
        COALESCE((config ->> 'allow_payeasy')::boolean, false) AS allow_payeasy,
        COALESCE((config ->> 'allow_payeasy02')::boolean, false) AS allow_payeasy02,
        COALESCE((config ->> 'allow_payeasy03')::boolean, false) AS allow_payeasy03,
        COALESCE((config ->> 'allow_pennypay')::boolean, false) AS allow_pennypay,
        COALESCE((config ->> 'allow_trustpay')::boolean, false) AS allow_trustpay,
        COALESCE((config ->> 'allow_paybitra')::boolean, false) AS allow_paybitra,
        COALESCE((config ->> 'allow_paycric')::boolean, false) AS allow_paycric,
        COALESCE((config ->> 'allow_rapidpay')::boolean, false) AS allow_rapidpay,
        COALESCE((config ->> 'allow_beetas')::boolean, false) AS allow_beetas,
        COALESCE((config ->> 'allow_paytm')::boolean, false) AS is_paytm_enabled
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

const isCompanyEmailExistsDao = async (email, conn = null) => {
  try {
    const sql = `
      SELECT 1 FROM "${tableName.COMPANY}"
      WHERE is_obsolete = false AND LOWER(email) = LOWER($1)
      UNION ALL
      SELECT 1 FROM "${tableName.USER}"
      WHERE is_obsolete = false AND LOWER(email) = LOWER($1)
      LIMIT 1
    `;
    const result = await executeQuery(sql, [email], conn);
    return result.rows.length > 0;
  } catch (error) {
    logger.error('Error checking company email uniqueness:', error);
    throw error;
  }
};

const isCompanyContactNoExistsDao = async (contactNo, conn = null) => {
  try {
    const sql = `
      SELECT 1 FROM "${tableName.COMPANY}"
      WHERE is_obsolete = false AND contact_no = $1
      UNION ALL
      SELECT 1 FROM "${tableName.USER}"
      WHERE is_obsolete = false AND contact_no = $1
      LIMIT 1
    `;
    const result = await executeQuery(sql, [contactNo], conn);
    return result.rows.length > 0;
  } catch (error) {
    logger.error('Error checking company contact number uniqueness:', error);
    throw error;
  }
};

const isUserNameExistsDao = async (userName, conn = null) => {
  try {
    const sql = `SELECT 1 FROM "${tableName.USER}" WHERE is_obsolete = false AND LOWER(user_name) = LOWER($1) LIMIT 1`;
    const result = await executeQuery(sql, [userName], conn);
    return result.rows.length > 0;
  } catch (error) {
    logger.error('Error checking username uniqueness:', error);
    throw error;
  }
};

// const isUserCodeExistsDao = async (code, conn = null) => {
//   try {
//     const sql = `SELECT 1 FROM "${tableName.USER}" WHERE is_obsolete = false AND code = $1 LIMIT 1`;
//     const result = await executeQuery(sql, [code], conn);
//     return result.rows.length > 0;
//   } catch (error) {
//     logger.error('Error checking user code uniqueness:', error);
//     throw error;
//   }
// };

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
    const [sql, params] = buildUpdateQuery(
      tableName.COMPANY,
      data,
      id,
      {},
      { returnUpdated: true },
      conn,
    );
    const result = await executeQuery(sql, params, conn);
    return result.rows[0];
  } catch (error) {
    logger.error('Error updating company:', error); // Log the error for debugging
    throw error;
  }
};
// Builds a jsonb expression that deep-merges `config` into the stored value.
// Rules:
//   - nested object  -> recursively merged with the existing object
//   - null/undefined -> key removed at that exact path
//   - array/scalar   -> key replaced via jsonb_set
const buildConfigDeepMergeSql = (config) => {
  const values = [];
  let index = 1;

  const buildObjectFromIncoming = (obj) => {
    let expr = `'{}'::jsonb`;
    Object.entries(obj).forEach(([key, value]) => {
      if (value === null || value === undefined) return;
      const keyPath = `'{${key}}'`;
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        expr = `jsonb_set(${expr}, ${keyPath}, ${buildObjectFromIncoming(
          value,
        )})`;
      } else {
        expr = `jsonb_set(${expr}, ${keyPath}, $${index}::jsonb)`;
        values.push(stringifyJSON(value));
        index++;
      }
    });
    return expr;
  };

  const buildMergedValue = (obj, existingExpr) => {
    const objectBase = `CASE WHEN jsonb_typeof(${existingExpr}) = 'object' THEN ${existingExpr} ELSE '{}'::jsonb END`;
    let expr = objectBase;
    Object.entries(obj).forEach(([key, value]) => {
      const existingKey = `${existingExpr}#>'{${key}}'`;
      const keyPath = `'{${key}}'`;
      if (value === null || value === undefined) {
        expr = `${expr} - '${key}'`;
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        const childExpr = `CASE WHEN jsonb_typeof(${existingKey}) = 'object' THEN ${buildMergedValue(
          value,
          existingKey,
        )} ELSE ${buildObjectFromIncoming(value)} END`;
        // Avoid creating an empty object when the incoming subtree holds
        // only removals for a path that does not exist yet.
        expr = `CASE WHEN ${childExpr} = '{}'::jsonb AND COALESCE(jsonb_typeof(${existingKey}), '') <> 'object' THEN ${expr} ELSE jsonb_set(${expr}, ${keyPath}, ${childExpr}) END`;
      } else {
        expr = `jsonb_set(${expr}, ${keyPath}, $${index}::jsonb)`;
        values.push(stringifyJSON(value));
        index++;
      }
    });
    return expr;
  };

  return { expr: buildMergedValue(config, `"config"::jsonb`), values };
};

const updateCompanyConfigDao = async (id, data, conn = null) => {
  try {
    if (!data.config || typeof data.config !== 'object') {
      throw new Error('config must be an object');
    }
    const { expr, values } = buildConfigDeepMergeSql(data.config);

    const whereClause = Object.entries(id).map(([key, value]) => {
      if (!isSafeColumnName(key)) {
        throw new Error(`Unsafe column name in update condition: ${key}`);
      }
      values.push(value);
      return `"${key}" = $${values.length}`;
    });

    const query = `UPDATE "${tableName.COMPANY}" SET "config" = ${expr} WHERE ${whereClause.join(' AND ')} RETURNING *`;
    const result = await executeQuery(query, values, conn);
    return result.rows[0];
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
  isCompanyEmailExistsDao,
  isCompanyContactNoExistsDao,
  isUserNameExistsDao,
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
