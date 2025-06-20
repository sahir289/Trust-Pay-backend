import { Role, tableName } from '../../constants/index.js';

import {
  buildInsertQuery,
  buildUpdateQuery,
  buildAndExecuteUpdateQuery,
  executeQuery,
} from '../../utils/db.js';
import { DbError } from '../../utils/appErrors.js';
import { logger } from '../../utils/logger.js';

const getBeneficiaryAccountDao = async (filters, page, limit, role) => {
  try {
    let queryParams = [];
    let conditions = [`bea.is_obsolete = false`];
    let limitcondition = '';

    if (page && limit) {
      limitcondition = `LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
      queryParams.push(limit, (page - 1) * limit);
    }
    if (filters && Object.keys(filters).length > 0) {
      Object.keys(filters).forEach((key) => {
        delete filters?.page;
        delete filters?.limit;
        const value = filters[key];
        if (value !== null && value !== undefined && value !== '') {
          if (key.includes('->>')) {
            const [jsonField, jsonKey] = key.split('->>');
            conditions.push(`bea.${jsonField}->>'${jsonKey}' = $${queryParams.length + 1}`);
            queryParams.push(value);
          }
           else if (Array.isArray(value)) {
            conditions.push(`bea."${key}" = ANY($${queryParams.length + 1})`);
            queryParams.push(value);
          }  else {
            conditions.push(`bea."${key}" = $${queryParams.length + 1}`);
            queryParams.push(value);
          }
        }
      });
    }
    let commissionSelect = '';
    if (role === Role.MERCHANT) {
      commissionSelect = `
        bea.ifsc AS ifsc`;
    } else if (role === Role.VENDOR) {
      commissionSelect = `
        bea.ifsc AS ifsc, bea.config`;
    } else {
      commissionSelect = `
        bea.user_id, 
        bea.ifsc, 
        creator.user_name AS created_by, 
        updater.user_name AS updated_by, 
        bea.created_at,
        bea.config,
        bea.updated_at`;
    }
    const baseQuery = `SELECT 
        bea.id,
        bea.upi_id,
        bea.acc_holder_name,
        bea.acc_no, 
        bea.bank_name,
        ${commissionSelect ? `${commissionSelect},` : ''}
        v.code AS Vendor,
        m.code AS Merchant
      FROM 
          public."BeneficiaryAccounts" bea
      LEFT JOIN public."Vendor" v 
          ON bea.user_id = v.user_id
      LEFT JOIN public."Merchant" m 
          ON bea.user_id = m.user_id
       LEFT JOIN public."User" creator 
        ON bea.created_by = creator.id
      LEFT JOIN public."User" updater 
        ON bea.updated_by = updater.id
      WHERE 
          ${conditions.join(' AND ')}
      ORDER BY 
          bea.updated_at DESC  
      ${limitcondition};
      `;
    const result = await executeQuery(baseQuery, queryParams);
    return result.rows;
  } catch (error) {
    logger.error('Error in get BeneficiaryAccount Dao:', error);
    throw error.message;
  }
};

const getBeneficiaryAccountDaoAll = async (filters, page, limit, role) => {
  try {
    let queryParams = [];
    let conditions = [`bea.is_obsolete = false`];
    let limitcondition = '';

    if (page && limit) {
      limitcondition = `LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
      queryParams.push(limit, (page - 1) * limit);
    }
    if (filters && Object.keys(filters).length > 0) {
      Object.keys(filters).forEach((key) => {
        delete filters?.page;
        delete filters?.limit;
        const value = filters[key];
        if (value !== null && value !== undefined && value !== '') {
          if (key.includes('->>')) {
            const [jsonField, jsonKey] = key.split('->>');
            conditions.push(`bea.${jsonField}->>'${jsonKey}' = $${queryParams.length + 1}`);
            queryParams.push(value);
          }
           else if (Array.isArray(value)) {
            conditions.push(`bea."${key}" = ANY($${queryParams.length + 1})`);
            queryParams.push(value);
          } else {
            conditions.push(`bea."${key}" = $${queryParams.length + 1}`);
            queryParams.push(value);
          }
        }
      });
    }
    let commissionSelect = '';
    //MAX(...) is used to satisfy SQL’s requirement when grouping — you must aggregate non-grouped columns.
    //To keep one row per account, you must aggregate all non-grouped columns:
    //If you don't use MAX(), you must include the column in GROUP BY, which will give multiple rows per account

    let groupByColumns = ['bea.acc_no'];

    if (role === Role.MERCHANT) {
      commissionSelect = `MAX(bea.ifsc) AS ifsc`;
    } else if (role === Role.VENDOR) {
      commissionSelect = `
        MAX(bea.ifsc) AS ifsc,
        ARRAY_AGG(DISTINCT v.user_id) AS user_id,
        MAX(bea.config->>'type') AS config_type,
        MAX(bea.config->>'balance') AS config_balance,
        MAX(bea.config->>'today_balance') AS config_today_balance,
        MAX(bea.config->>'uniqueCode') AS config_uniqueCode,
`;
    } else {
      commissionSelect = `
      ARRAY_AGG(DISTINCT v.user_id) AS user_id,
        MAX(bea.ifsc) AS ifsc,
        MAX(creator.user_name) AS created_by,
        MAX(updater.user_name) AS updated_by,
        MAX(bea.created_at) AS created_at,
        MAX(bea.config->>'type') AS config_type,
        MAX(bea.config->>'balance') AS config_balance,
        MAX(bea.config->>'today_balance') AS config_today_balance,
        MAX(bea.config->>'uniqueCode') AS config_uniqueCode,
        MAX(bea.updated_at) AS updated_at`;
    }

    const baseQuery = `SELECT 
      bea.acc_no,
      MAX(bea.id) AS id,
      MAX(bea.upi_id) AS upi_id,
      MAX(bea.acc_holder_name) AS acc_holder_name,
      MAX(bea.bank_name) AS bank_name,
      ${commissionSelect ? `${commissionSelect},` : ''}
      ARRAY_AGG(DISTINCT v.code) AS vendors,
    MAX(m.code) AS merchant
    FROM public."BeneficiaryAccounts" bea
    LEFT JOIN public."Vendor" v ON bea.user_id = v.user_id
    LEFT JOIN public."Merchant" m ON bea.user_id = m.user_id
    LEFT JOIN public."User" creator ON bea.created_by = creator.id
    LEFT JOIN public."User" updater ON bea.updated_by = updater.id
    WHERE ${conditions.join(' AND ')}
    GROUP BY ${groupByColumns.join(', ')}
    ORDER BY MAX(bea.updated_at) DESC
    ${limitcondition};`;

    const result = await executeQuery(baseQuery, queryParams);
    return result.rows;
  } catch (error) {
    logger.error('Error in get BeneficiaryAccount Dao:', error);
    throw error.message;
  }
};

const getBeneficiaryAccountBySearchDao = async (
  role,
  searchTerms = [],
  page = 1,
  limit = 10,
  filters = {},
) => {
  try {
    let queryParams = [];
    let conditions = [`sub.is_obsolete = false`];
    let paramIndex = 1;

    if (filters && typeof filters === 'object' && Object.keys(filters).length > 0) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          if (Array.isArray(value)) {
            conditions.push(`sub."${key}" = ANY($${paramIndex})`);
            queryParams.push(value);
          } else {
            conditions.push(`sub."${key}" = $${paramIndex}`);
            queryParams.push(value);
          }
          paramIndex++;
        }
      });
    }

    let commissionSelect = '';
    if (role === 'MERCHANT') {
      commissionSelect = `sub.ifsc AS ifsc`;
    } else if (role === 'VENDOR') {
      commissionSelect = `sub.ifsc AS ifsc, sub.config AS config`;
    } else {
      commissionSelect = `
        sub.user_id AS user_id,
        sub.ifsc AS ifsc,
        sub.config AS config,
        sub.created_by AS created_by,
        sub.updated_by AS updated_by,
        sub.created_at AS created_at,
        sub.updated_at AS updated_at`;
    }

    // Track search terms and their parameter indices
    const searchTermIndices = [];
    const searchConditions = [];
    if (Array.isArray(searchTerms) && searchTerms.length > 0) {
      searchTerms.forEach((term) => {
        if (typeof term !== 'string') return;
        let configSearch = '';
        if (role !== 'MERCHANT') {
          configSearch = `OR LOWER(sub.config::text) LIKE LOWER($${paramIndex})`;
        }
        searchConditions.push(`
          (
            LOWER(sub.id::text) LIKE LOWER($${paramIndex})
            OR LOWER(sub.upi_id) LIKE LOWER($${paramIndex})
            OR LOWER(sub.acc_holder_name) LIKE LOWER($${paramIndex})
            OR LOWER(sub.acc_no) LIKE LOWER($${paramIndex})
            OR LOWER(sub.bank_name) LIKE LOWER($${paramIndex})
            OR LOWER(sub.vendors::text) LIKE LOWER($${paramIndex})
            OR LOWER(sub.merchants::text) LIKE LOWER($${paramIndex})
            ${
              role !== 'MERCHANT'
                ? `
              OR LOWER(sub.user_id::text) LIKE LOWER($${paramIndex})
              OR LOWER(sub.ifsc) LIKE LOWER($${paramIndex})
              ${configSearch}
              ${
                role !== 'VENDOR'
                  ? `
                OR LOWER(COALESCE(sub.created_by, '')) LIKE LOWER($${paramIndex})
                OR LOWER(COALESCE(sub.updated_by, '')) LIKE LOWER($${paramIndex})
              `
                  : ''
              }`
                : role === 'VENDOR'
                  ? `
              OR LOWER(sub.ifsc) LIKE LOWER($${paramIndex})
              ${configSearch}`
                  : ''
            }
          )`);
        queryParams.push(`%${term}%`);
        searchTermIndices.push({ term, paramIndex, isBoolean: false });
        paramIndex++;
      });
    }

    // Compute matched_keywords
    let matchedKeywordsSelect = '';
    if (searchTermIndices.length > 0) {
      const keywordCases = searchTermIndices
        .map(({ term, paramIndex }) => `
          CASE WHEN (
            LOWER(sub.id::text) LIKE LOWER($${paramIndex})
            OR LOWER(sub.upi_id) LIKE LOWER($${paramIndex})
            OR LOWER(sub.acc_holder_name) LIKE LOWER($${paramIndex})
            OR LOWER(sub.acc_no) LIKE LOWER($${paramIndex})
            OR LOWER(sub.bank_name) LIKE LOWER($${paramIndex})
            OR LOWER(sub.vendors::text) LIKE LOWER($${paramIndex})
            OR LOWER(sub.merchants::text) LIKE LOWER($${paramIndex})
            ${
              role !== 'MERCHANT'
                ? `
              OR LOWER(sub.user_id::text) LIKE LOWER($${paramIndex})
              OR LOWER(sub.ifsc) LIKE LOWER($${paramIndex})
              ${role !== 'MERCHANT' ? `OR LOWER(sub.config::text) LIKE LOWER($${paramIndex})` : ''}
              ${
                role !== 'VENDOR'
                  ? `
                OR LOWER(COALESCE(sub.created_by, '')) LIKE LOWER($${paramIndex})
                OR LOWER(COALESCE(sub.updated_by, '')) LIKE LOWER($${paramIndex})
              `
                  : ''
              }`
                : role === 'VENDOR'
                  ? `
              OR LOWER(sub.ifsc) LIKE LOWER($${paramIndex})
              ${role === 'VENDOR' ? `OR LOWER(sub.config::text) LIKE LOWER($${paramIndex})` : ''}`
                  : ''
            }
          ) THEN '${term}'::text END`);
      matchedKeywordsSelect = keywordCases.length > 0
        ? `,
          ARRAY_REMOVE(ARRAY[${keywordCases.join(', ')}], NULL) AS matched_keywords`
        : `,
          ARRAY[]::text[] AS matched_keywords`;
    } else {
      matchedKeywordsSelect = `,
        ARRAY[]::text[] AS matched_keywords`;
    }

    let baseQuery = `
      SELECT 
        sub.acc_no,
        sub.id,
        sub.upi_id,
        sub.acc_holder_name,
        sub.bank_name,
        ${commissionSelect ? `${commissionSelect},` : ''}
        sub.vendors,
        sub.merchants
        ${matchedKeywordsSelect}
      FROM (
        SELECT 
          bea.acc_no,
          MAX(bea.id) AS id,
          MAX(bea.upi_id) AS upi_id,
          MAX(bea.acc_holder_name) AS acc_holder_name,
          MAX(bea.bank_name) AS bank_name,
          MAX(bea.user_id) AS user_id,
          MAX(bea.ifsc) AS ifsc,
          json_agg(bea.config) AS config,
          MAX(creator.user_name) AS created_by,
          MAX(updater.user_name) AS updated_by,
          MAX(bea.created_at) AS created_at,
          MAX(bea.updated_at) AS updated_at,
          ARRAY_AGG(DISTINCT v.code) FILTER (WHERE v.code IS NOT NULL) AS vendors,
          ARRAY_AGG(DISTINCT m.code) FILTER (WHERE m.code IS NOT NULL) AS merchants,
          MAX(bea.is_obsolete::int)::boolean AS is_obsolete,
          MAX(bea.role_id) AS role_id
        FROM 
          public."BeneficiaryAccounts" bea
        LEFT JOIN public."Vendor" v 
          ON bea.user_id = v.user_id
        LEFT JOIN public."Merchant" m 
          ON bea.user_id = m.user_id
        LEFT JOIN public."User" creator 
          ON bea.created_by = creator.id
        LEFT JOIN public."User" updater 
          ON bea.updated_by = updater.id
        GROUP BY bea.acc_no
      ) sub
      WHERE 1=1`;

    if (conditions.length > 0) {
      baseQuery += ` AND ${conditions.join(' AND ')}`;
    }
    if (searchConditions.length > 0) {
      baseQuery += ` AND (${searchConditions.join(' OR ')})`;
    }

    const countQuery = `
      SELECT COUNT(DISTINCT sub.acc_no) as total
      FROM (
        SELECT 
          bea.acc_no,
          MAX(bea.id) AS id,
          MAX(bea.upi_id) AS upi_id,
          MAX(bea.acc_holder_name) AS acc_holder_name,
          MAX(bea.bank_name) AS bank_name,
          MAX(bea.user_id) AS user_id,
          MAX(bea.ifsc) AS ifsc,
          json_agg(bea.config) AS config,
          MAX(creator.user_name) AS created_by,
          MAX(updater.user_name) AS updated_by,
          MAX(bea.created_at) AS created_at,
          MAX(bea.updated_at) AS updated_at,
          ARRAY_AGG(DISTINCT v.code) FILTER (WHERE v.code IS NOT NULL) AS vendors,
          ARRAY_AGG(DISTINCT m.code) FILTER (WHERE m.code IS NOT NULL) AS merchants,
          MAX(bea.is_obsolete::int)::boolean AS is_obsolete,
          MAX(bea.role_id) AS role_id
        FROM public."BeneficiaryAccounts" bea
        LEFT JOIN public."Vendor" v 
          ON bea.user_id = v.user_id
        LEFT JOIN public."Merchant" m 
          ON bea.user_id = m.user_id
        LEFT JOIN public."User" creator 
          ON bea.created_by = creator.id
        LEFT JOIN public."User" updater 
          ON bea.updated_by = updater.id
        GROUP BY bea.acc_no
      ) sub
      WHERE 1=1
      ${conditions.length > 0 ? ` AND ${conditions.join(' AND ')}` : ''}
      ${searchConditions.length > 0 ? ` AND (${searchConditions.join(' OR ')})` : ''}`;
    console.log('Count Query:', countQuery);
    const countResult = await executeQuery(countQuery, queryParams);

    const offset = (page - 1) * limit;
    baseQuery += `
      ORDER BY 
        sub.updated_at DESC
      LIMIT $${paramIndex}
      OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, offset);

    const searchResult = await executeQuery(baseQuery, queryParams);

    const totalItems = parseInt(countResult.rows[0].total);
    const totalPages = totalItems > 0 ? Math.ceil(totalItems / limit) : 0;

   

    return {
      totalCount: totalItems,
      totalPages,
      bankAccounts: searchResult.rows,
    };
  } catch (error) {
    logger.error('Error in get Beneficiary Account By SearchDao:',error);
    throw error;
  }
};

const createBeneficiaryAccountDao = async (payload) => {
  try {
    const [sql, params] = buildInsertQuery(tableName.BENEFICIARY_ACCOUNTS, payload);
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    logger.error(error);
    throw error.message;
  }
};

const getBeneficiaryAccountDaoByBankName = async (
  conn,
  company_id,
  type,
  filters = {},
) => {
  try {
    // Initialize query components
    let whereConditions = [
      'is_obsolete = false',
    ];
    let queryParams = [];

    // Handle filters
    if (Object.keys(filters).length > 0) {
      Object.entries(filters).forEach(([key, value]) => {
        let paramValue = value;
        // If value is an array, take the first element (adjust based on requirements)
        if (Array.isArray(value) && value.length > 0) {
          paramValue = value[0]; // Extract first element
          if (paramValue == null) {
            return; // Skip if first element is null/undefined
          }
        }
        whereConditions.push(`"${key}" = $${queryParams.length + 1}`);
        queryParams.push(paramValue);
      });
    }

    // Construct base query with dynamic WHERE clause
    let baseQuery = `
      SELECT bank_name AS label, id AS value 
      FROM "${tableName.BENEFICIARY_ACCOUNTS}" 
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY bank_name ASC
    `;

    // Execute query
    const result = await conn.query(baseQuery, queryParams);

    return {
      totalCount: result.rowCount,
      bankNames: result.rows,
    };
  } catch (error) {
    logger.error('Error querying bank accounts:', error.message, error.stack);
    throw new Error('Failed to retrieve bank account nicknames');
  }
};

const updateBeneficiaryAccountDao = async (
  id,
  payload,
  conn,
  isParentDeleted,
) => {
  try {
    // Fetch existing bank config to merge with added_at
    const existingBankArr = await getBeneficiaryAccountDao({
      id: id.id,
    });
    const existingBank = existingBankArr[0];

    // Handle nested JSON updates for the `config` column
    if (payload.config && typeof payload.config === 'object') {
      const configUpdates = payload.config;
      delete payload.config; // Remove `config` from the main payload

      // Merge the new `config` data into the existing JSON structure
      const safeConfig = {};
      //added merchant_added key in config
      for (const key in configUpdates) {
        if (
          key === 'merchant_added' &&
          typeof configUpdates[key] === 'object'
        ) {
          const rawAddedAt = configUpdates[key];
          const existingAddedAt = existingBank?.config?.merchant_added || {};

          const updatedAddedAt = {
            ...existingAddedAt,
            ...rawAddedAt,
          };

          safeConfig['merchant_added'] = updatedAddedAt;
        } else {
          safeConfig[key] = configUpdates[key];
        }
      }
      payload.config = safeConfig;
    }

    // if vendor delete then this config updated
    if (isParentDeleted) {
      const [sql, params] = buildUpdateQuery(
        tableName.BENEFICIARY_ACCOUNTS,
        payload,
        id,
      );
      return await conn.query(sql, params);
    }
    // Use buildAndExecuteUpdateQuery to update the bank account
    return await buildAndExecuteUpdateQuery(
      tableName.BENEFICIARY_ACCOUNTS,
      payload,
      id,
      {}, // No special fields
      { returnUpdated: true }, // Return the updated row
      conn, // Use the provided connection
    );
  } catch (error) {
    logger.error('Error in updateBeneficiaryAccountDao:', error);
    throw error.message;
  }
};

const deleteBankaccountDao = async (conn, id, data) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.BENEFICIARY_ACCOUNTS, data, id);
    let result;
    if (conn && conn.query) {
      result = await conn.query(sql, params); // Use connection to execute query
    } else {
      result = await executeQuery(sql, params); // Use executeQuery if no connection
    }
    return result.rows[0];
  } catch {
    DbError('Error executing query');
  }
};

export const updateBanktBalanceDao = async (
  filters,
  amount,
  updated_by,
  conn,
) => {
  try {
    const [sql, params] = buildUpdateQuery(
      tableName.BENEFICIARY_ACCOUNTS,
      { balance: amount, today_balance: amount, updated_by },
      filters,
      { balance: '+', today_balance: '+' },
    );
    if (conn && conn.query) {
      const result = await conn.query(sql, params);
      return result.rows[0];
    }
    const result = await executeQuery(sql, params);
    return result[0];
  } catch (error) {
    logger.error(error);
    throw error.message;
  }
};

export {
  getBeneficiaryAccountDao,
  getBeneficiaryAccountBySearchDao,
  createBeneficiaryAccountDao,
  updateBeneficiaryAccountDao,
  deleteBankaccountDao,
  getBeneficiaryAccountDaoAll,
  getBeneficiaryAccountDaoByBankName,
};
