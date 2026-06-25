import { Role, tableName } from '../../constants/index.js';

import {
  buildInsertQuery,
  buildSelectQuery,
  buildUpdateQuery,
  buildAndExecuteUpdateQuery,
  executeQuery,
  isSafeColumnName,
} from '../../utils/db.js';

import { logger } from '../../utils/logger.js';
import { acquireBankBalanceLock } from '../../utils/advisoryLock.js';

const PRIVILEGED_BANK_DESIGNATIONS = new Set([
  Role.ADMIN,
  Role.OPERATIONS,
  Role.TRANSACTIONS,
]);

const shouldIncludeMerchantDetails = (role, designation) =>
  role !== Role.MERCHANT &&
  PRIVILEGED_BANK_DESIGNATIONS.has(designation);

const dynamicBalanceJoin = `
  LEFT JOIN (
    SELECT
      br.bank_id,
      COUNT(*)::INTEGER AS dynamic_payin_count,
      COALESCE(SUM(br.amount), 0)::NUMERIC AS dynamic_today_balance
    FROM public."BankResponse" br
    WHERE br.status = '/success'
      AND br.created_at >= DATE_TRUNC('day', NOW() AT TIME ZONE 'Asia/Kolkata')
      AND br.created_at < DATE_TRUNC('day', NOW() AT TIME ZONE 'Asia/Kolkata') + INTERVAL '1 day'
    GROUP BY br.bank_id
  ) br_stats ON br_stats.bank_id = ba.id
`;

const merchantDetailsJoin = `
LEFT JOIN LATERAL (
  SELECT
    jsonb_agg(
      jsonb_build_object(
        'id', m.id,
        'code', m.code
      )
    ) AS merchant_details
  FROM public."Merchant" m
  WHERE (ba.config->'merchants')::jsonb ? m.id::text
) m ON TRUE
`;

export const getBankaccountPayinDao = async (filters, conn = null) => {
  try {
    let query = `
    SELECT id, nick_name, user_id
    FROM public."BankAccount"
    WHERE id = $1 
    AND is_obsolete = false

  `;
    const result = await executeQuery(query, [filters.id], conn);
    return result.rows;
  } catch (error) {
    logger.error('Error in get BankAccountPayin Dao:', error.message);
    throw error;
  }
};

// Lightweight lookup for internal transactional flows
const getBankAccountCoreByIdDao = async (filters, conn = null) => {
  try {
    const query = `
      SELECT
        ba.id,
        ba.company_id,
        ba.user_id,
        ba.bank_used_for,
        ba.is_enabled,
        ba.nick_name,
        ba.balance,
        ba.today_balance,
        ba.config
      FROM public."BankAccount" ba
      WHERE ba.is_obsolete = false
        AND ba.id = $1
        AND ba.company_id = $2
      LIMIT 1;
    `;

    const result = await executeQuery(
      query,
      [filters.id, filters.company_id],
      conn,
    );

    return result.rows;
  } catch (error) {
    logger.error('Error in getBankaccountCoreByIdDao:', error);
    throw error;
  }
};
const getBankaccountDao = async (filters, page, limit, role, designation, conn = null) => {
  try {
    const includeMerchantDetails = shouldIncludeMerchantDetails(
      role,
      designation,
    );
    let queryParams = [];
    let conditions = [`ba.is_obsolete = false`];
    // if (filters.company_id) {
    //   queryParams.push(filters.company_id);
    //   conditions.push(`ba.company_id = $1`);
    // }
    let limitcondition = '';

    if (page && limit) {
      limitcondition = `LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
      queryParams.push(limit, (page - 1) * limit);
    }

    // if (filters?.startDate && filters?.endDate) {
    //   conditions.push(
    //     `ba.created_at BETWEEN $${queryParams.length + 1} AND $${queryParams.length + 2}`,
    //   );
    //   queryParams.push(filters?.startDate, filters?.endDate);
    //   // delete filters.startDate
    //   // delete filters.endDate
    // }
    // if (filters?.bank_used_for) {
    //   conditions.push(`ba.bank_used_for = $${queryParams.length + 1}`);
    //   queryParams.push(filters?.bank_used_for);
    // }

    // // Nickname filter
    // if (filters?.nick_name) {
    //   conditions.push(`ba.nick_name= $${queryParams.length + 1}`);
    //   queryParams.push(filters.nick_name);
    // }
    if (filters?.merchant_id) {
      queryParams.push(filters.merchant_id);
      conditions.push(
        `(ba.config->'merchants')::jsonb ?| $${queryParams.length}::text[]`,
      );
      delete filters.merchant_id;
    }
    if (filters && Object.keys(filters).length > 0) {
      Object.keys(filters).forEach((key) => {
        delete filters?.page;
        delete filters?.limit;
        const value = filters[key];
        if (!isSafeColumnName(key)) return;
        if (value !== null && value !== undefined && value !== '') {
          if (Array.isArray(value)) {
            conditions.push(`ba."${key}" = ANY($${queryParams.length + 1})`);
            queryParams.push(value);
          } else {
            conditions.push(`ba."${key}" = $${queryParams.length + 1}`);
            queryParams.push(value);
          }
        }
      });
    }
    let commissionSelect = '';
    if (role === 'MERCHANT') {
      commissionSelect = '';
    } else if (role === 'VENDOR') {
      commissionSelect = `
        ba.ifsc AS ifsc_code, 
        ba.payin_count::float AS payin_count, 
        ba.balance::float AS balance, 
        ba.today_balance::float AS today_balance, 
        ba.bank_used_for,
        ba.user_id,
        ba.config->>'is_freeze' AS freezed,
        ba.config->>'is_intent' AS intent,
        ba.config->>'is_phonepay' AS phonepe,
        ba.config->>'max_limit' AS daily_limit`;
    } else {
      // Only include Merchant_Details and config if designation is 'Admin'
      commissionSelect = `
        ba.user_id, 
        ba.ifsc, 
        ba.min, 
        ba.max, 
        ba.payin_count::float AS payin_count, 
        ba.balance::float AS balance, 
        ba.today_balance::float AS today_balance, 
        ba.bank_used_for, 
        creator.user_name AS created_by, 
        updater.user_name AS updated_by, 
        ${includeMerchantDetails ? `COALESCE(m.merchant_details, '[]'::jsonb) AS Merchant_Details, ba.config,` : ''}
        ba.created_at, 
        ba.updated_at`;
    }
    const baseQuery = `SELECT 
        ba.id, 
        ba.sno, 
        ba.upi_id,
        ba.acc_holder_name,
        ba.upi_params, 
        ba.nick_name, 
        ba.acc_no, 
        ba.bank_name, 
        ba.is_qr, 
        ba.company_id,
        ba.is_bank, 
        ba.is_enabled, 
        ${commissionSelect ? `${commissionSelect},` : ''}
        v.code AS Vendor 
      FROM 
          public."BankAccount" ba
      LEFT JOIN public."Vendor" v 
          ON ba.user_id = v.user_id
        ${role === 'MERCHANT' ? '' : dynamicBalanceJoin}
        ${includeMerchantDetails ? merchantDetailsJoin : ''}
       LEFT JOIN public."User" creator 
        ON ba.created_by = creator.id
      LEFT JOIN public."User" updater 
        ON ba.updated_by = updater.id
      WHERE 
          ${conditions.join(' AND ')}
      ORDER BY 
          ba.is_enabled DESC,  
          ba.updated_at DESC  
      ${limitcondition};
      `;
    const result = await executeQuery(baseQuery, queryParams, conn);
    return result.rows;
  } catch (error) {
    logger.error('Error in get BankAccount Dao:', error);
    throw error;
  }
};

const getAllBankaccountDao = async (
  filters,
  page,
  limit,
  role,
  designation,
  conn = null,
) => {
  try {
    const includeMerchantDetails = shouldIncludeMerchantDetails(
      role,
      designation,
    );
    let queryParams = [];
    let conditions = [`ba.is_obsolete = false`];
    // if (filters.company_id) {
    //   queryParams.push(filters.company_id);
    //   conditions.push(`ba.company_id = $1`);
    // }
    let limitcondition = '';

    if (page && limit) {
      limitcondition = `LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
      queryParams.push(limit, (page - 1) * limit);
    }

    if (filters?.startDate && filters?.endDate) {
      conditions.push(
        `ba.created_at BETWEEN $${queryParams.length + 1} AND $${queryParams.length + 2}`,
      );
      queryParams.push(filters?.startDate, filters?.endDate);
      // delete filters.startDate
      // delete filters.endDate
    }
    if (filters?.bank_used_for) {
      conditions.push(`ba.bank_used_for = $${queryParams.length + 1}`);
      queryParams.push(filters?.bank_used_for);
    }

    // Nickname filter
    if (filters?.nick_name) {
      conditions.push(`ba.nick_name= $${queryParams.length + 1}`);
      queryParams.push(filters.nick_name);
    }
    if (filters?.merchant_id) {
      queryParams.push(filters.merchant_id);
      conditions.push(
        `(ba.config->'merchants')::jsonb ?| $${queryParams.length}::text[]`,
      );
      delete filters.merchant_id;
    }
    if (filters && Object.keys(filters).length > 0) {
      Object.keys(filters).forEach((key) => {
        delete filters?.page;
        delete filters?.limit;
        const value = filters[key];
        if (!isSafeColumnName(key)) return;
        if (value !== null && value !== undefined && value !== '') {
          if (Array.isArray(value)) {
            conditions.push(`ba."${key}" = ANY($${queryParams.length + 1})`);
            queryParams.push(value);
          } else {
            conditions.push(`ba."${key}" = $${queryParams.length + 1}`);
            queryParams.push(value);
          }
        }
      });
    }
    let commissionSelect = '';
    if (role === 'MERCHANT') {
      commissionSelect = '';
    } else if (role === 'VENDOR') {
      commissionSelect = `
        ba.ifsc AS ifsc_code, 
        ba.payin_count::float AS payin_count, 
        ba.balance::float AS balance, 
        ba.today_balance::float AS today_balance,
        ba.is_enabled,   
        ba.bank_used_for,
        ba.config->>'max_limit' AS daily_limit`;
    } else {
      // Only include Merchant_Details and config if designation is 'Admin'
      commissionSelect = `
        ba.user_id, 
        ba.ifsc, 
        ba.min, 
        ba.max, 
        ba.payin_count::float AS payin_count, 
        ba.balance::float AS balance, 
        ba.is_qr, 
        ba.is_bank, 
        ba.is_enabled, 
        ba.today_balance::float AS today_balance, 
        ba.bank_used_for, 
        creator.user_name AS created_by, 
        updater.user_name AS updated_by, 
        ${includeMerchantDetails ? `COALESCE(m.merchant_details, '[]'::jsonb) AS Merchant_Details, ba.config,` : ''}
        ba.created_at, 
        ba.updated_at`;
    }
    const baseQuery = `SELECT 
        ba.id, 
        ba.sno, 
        ba.upi_id,
        ba.acc_holder_name,
        ba.upi_params, 
        ba.nick_name, 
        ba.acc_no, 
        ba.bank_name, 
        ${commissionSelect ? `${commissionSelect},` : ''}
        v.code AS Vendor 
      FROM 
          public."BankAccount" ba
      LEFT JOIN public."Vendor" v 
          ON ba.user_id = v.user_id
        ${role === 'MERCHANT' ? '' : dynamicBalanceJoin}
        ${includeMerchantDetails ? merchantDetailsJoin : ''}
       LEFT JOIN public."User" creator 
        ON ba.created_by = creator.id
      LEFT JOIN public."User" updater 
        ON ba.updated_by = updater.id
      WHERE 
          ${conditions.join(' AND ')}
      ORDER BY 
          ba.is_enabled DESC,  
          ba.updated_at DESC  
      ${limitcondition};
      `;
    const result = await executeQuery(baseQuery, queryParams, conn);
    return result.rows;
  } catch (error) {
    logger.error('Error in get BankAccount Dao:', error);
    throw error;
  }
};

const getBankAccountsBySearchDao = async (
  filters,
  page,
  limit,
  role,
  designation,
  searchTerms = [],
  conn = null,
) => {
  try {
    const includeMerchantDetails = shouldIncludeMerchantDetails(
      role,
      designation,
    );
    let queryParams = [];
    let conditions = [];
    let paramIndex = 1;

    // Date range filter
    if (filters?.startDate && filters?.endDate) {
      conditions.push(
        `ba.created_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`,
      );
      queryParams.push(filters.startDate, filters.endDate);
      paramIndex += 2;
    }

    // Bank used for filter
    if (filters?.bank_used_for) {
      conditions.push(`ba.bank_used_for = $${paramIndex}`);
      queryParams.push(filters.bank_used_for);
      paramIndex++;
    }

    // Nickname filter
    if (filters?.nick_name) {
      conditions.push(`ba.nick_name = $${paramIndex}`);
      queryParams.push(filters.nick_name);
      paramIndex++;
    }

    // Merchant ID filter
    if (filters?.merchant_id) {
      conditions.push(
        `(ba.config->'merchants')::jsonb ?| $${paramIndex}::text[]`,
      );
      queryParams.push(filters.merchant_id);
      paramIndex++;
    }
    if (filters.active === 'true') {
      conditions.push(
        `ba.is_obsolete = false AND (ba.config->>'is_freeze' IS NULL OR (ba.config->>'is_freeze')::boolean = false)`,
      );
      delete filters.active;
    } else {
      conditions.push(
        `((ba.config->>'is_freeze')::boolean = true OR ba.is_obsolete = true)`,
      );
      delete filters.active;
    }
    // Other filters
    if (filters && Object.keys(filters).length > 0) {
      Object.keys(filters).forEach((key) => {
        if (key === 'page' || key === 'limit') return; // Skip pagination keys
        if (!isSafeColumnName(key)) return;
        const value = filters[key];
        if (value !== null && value !== undefined && value !== '') {
          if (Array.isArray(value)) {
            conditions.push(`ba."${key}" = ANY($${paramIndex})`);
            queryParams.push(value);
          } else {
            conditions.push(`ba."${key}" = $${paramIndex}`);
            queryParams.push(value);
          }
          paramIndex++;
        }
      });
    }

    // Search terms filter
    if (searchTerms?.length) {
      const searchConditions = [];
      searchTerms.forEach((term) => {
        if (!term || term.trim() === '') return; 
        if (term.toLowerCase() === 'true' || term.toLowerCase() === 'false') {
          const boolValue = term.toLowerCase() === 'true';
          searchConditions.push(`ba.is_enabled = $${paramIndex}`);
          queryParams.push(boolValue);
          paramIndex++;
        } else {
          const likeVal = `%${term.toLowerCase()}%`;
          let searchCondition = `
        (
          LOWER(ba.id::text) LIKE $${paramIndex}
          OR LOWER(ba.sno::text) LIKE $${paramIndex}
          OR LOWER(ba.upi_id) LIKE $${paramIndex}
          OR LOWER(ba.acc_holder_name) LIKE $${paramIndex}
          OR LOWER(ba.nick_name) LIKE $${paramIndex}
          OR LOWER(ba.acc_no) LIKE $${paramIndex}
          OR LOWER(ba.bank_name) LIKE $${paramIndex}
          OR LOWER(ba.ifsc) LIKE $${paramIndex}
          OR LOWER(ba.user_id::text) LIKE $${paramIndex}
          OR LOWER(ba.created_at::text) LIKE $${paramIndex}
          OR LOWER(ba.updated_at::text) LIKE $${paramIndex}
          OR LOWER(creator.user_name) LIKE $${paramIndex}
          OR LOWER(updater.user_name) LIKE $${paramIndex}
          OR LOWER(v.code) LIKE $${paramIndex}
          OR LOWER(ba.config->>'max_limit') LIKE $${paramIndex}
          OR LOWER(ba.config->>'is_intent') LIKE $${paramIndex}
      `;
          // Add merchant code search only for ADMIN role
          if (role === 'ADMIN') {
            searchCondition += `
          OR EXISTS (
            SELECT 1
            FROM public."Merchant" m
            WHERE m.id::text IN (
              SELECT jsonb_array_elements_text((ba.config->'merchants')::jsonb)
            )
            AND LOWER(m.code) LIKE LOWER($${paramIndex})
          )
        `;
          }
          searchCondition += ')';
          searchConditions.push(searchCondition);
          queryParams.push(likeVal);
          paramIndex++;
        }
      });
      conditions.push(`(${searchConditions.join(' OR ')})`);
    }

    // Pagination
    let limitcondition = '';
    if (page && limit) {
      limitcondition = `LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      queryParams.push(limit, (page - 1) * limit);
      paramIndex += 2;
    }

    // Role-based select fields
    let commissionSelect = '';
    if (role === 'MERCHANT') {
      commissionSelect = '';
    } else if (role === 'VENDOR') {
      commissionSelect = `
        ba.ifsc AS ifsc_code, 
        ba.payin_count::float AS payin_count, 
        ba.balance::float AS balance, 
        ba.today_balance::float AS today_balance,
        ba.is_enabled,   
        ba.bank_used_for,
        ba.config->>'max_limit' AS daily_limit,
        (ba.config->>'is_freeze')::boolean AS is_freezed`;
    } else {
      commissionSelect = `
        ba.user_id, 
        ba.ifsc, 
        ba.min, 
        ba.max, 
        ba.payin_count::float AS payin_count, 
        ba.balance::float AS balance, 
        ba.is_qr, 
        ba.is_bank, 
        ba.is_enabled, 
        ba.today_balance::float AS today_balance, 
        ba.bank_used_for, 
        creator.user_name AS created_by, 
        updater.user_name AS updated_by, 
        ${includeMerchantDetails ? `COALESCE(m.merchant_details, '[]'::jsonb) AS Merchant_Details, ba.config,` : ''}
        ba.created_at, 
        ba.updated_at`;
    }

      const whereClause = conditions.length ? conditions.join(' AND ') : '1 = 1';

    // Base query
    const baseQuery = `
      SELECT 
        ba.id, 
        ba.sno, 
        ba.upi_id,
        ba.acc_holder_name,
        ba.upi_params, 
        ba.nick_name, 
        ba.acc_no, 
        ba.bank_name, 
        ba.is_obsolete,
        ${commissionSelect ? `${commissionSelect},` : ''}
        v.code AS Vendor 
      FROM 
        public."BankAccount" ba
      LEFT JOIN public."Vendor" v 
        ON ba.user_id = v.user_id
      ${role === 'MERCHANT' ? '' : dynamicBalanceJoin}
      ${includeMerchantDetails ? merchantDetailsJoin : ''}
      LEFT JOIN public."User" creator 
        ON ba.created_by = creator.id
      LEFT JOIN public."User" updater 
        ON ba.updated_by = updater.id
      WHERE 
        ${whereClause}
    `;

    const countBaseQuery = `
      SELECT ba.id
      FROM public."BankAccount" ba
      LEFT JOIN public."Vendor" v 
        ON ba.user_id = v.user_id
      LEFT JOIN public."User" creator 
        ON ba.created_by = creator.id
      LEFT JOIN public."User" updater 
        ON ba.updated_by = updater.id
      WHERE ${whereClause}
    `;

    const countQuery = `SELECT COUNT(*) AS total FROM (${countBaseQuery}) AS count_table`;

    // Main query with sorting and pagination
    const mainQuery = `
      ${baseQuery}
      ORDER BY
        (CASE 
          WHEN ba.is_enabled = true AND (ba.config->>'is_freeze')::boolean IS DISTINCT FROM true AND ba.is_obsolete = false THEN 1 -- Active
          WHEN ba.is_enabled = false AND (ba.config->>'is_freeze')::boolean IS DISTINCT FROM true AND ba.is_obsolete = false THEN 2 -- Deactive
          WHEN (ba.config->>'is_freeze')::boolean = true AND ba.is_obsolete = false THEN 3 -- Freezed
          WHEN ba.is_obsolete = true THEN 4 -- Obsolete
          ELSE 5
        END),
        ba.updated_at DESC
      ${limitcondition};
    `;

    // Execute queries sequentially to avoid holding two pool connections simultaneously
    const countResult = await executeQuery(
      countQuery,
      queryParams.slice(0, page && limit ? -2 : queryParams.length),
      conn,
    );
    const searchResult = await executeQuery(mainQuery, queryParams, conn);

    const totalCount = parseInt(countResult.rows[0].total);
    let totalPages = limit ? Math.ceil(totalCount / limit) : 1;

    if (
      totalCount > 0 &&
      searchResult.rows.length === 0 &&
      page &&
      limit &&
      (page - 1) * limit > 0
    ) {
      queryParams[queryParams.length - 1] = 0;
      const newSearchResult = await executeQuery(mainQuery, queryParams, conn);
      totalPages = limit ? Math.ceil(totalCount / limit) : 1;
      return {
        totalCount,
        totalPages,
        banks: newSearchResult.rows,
      };
    }

    return {
      totalCount,
      totalPages,
      banks: searchResult.rows,
    };
  } catch (error) {
    logger.error('Error in getBankAccountsBySearchDao:', error);
    throw error;
  }
};
export const getBankaccountCheckDao = async (filters = {}, conn = null) => {
  try {
    const selectColumns = `
      id,
      company_id,
      bank_used_for
    `;

    const [sql, params] = buildSelectQuery(
      `SELECT ${selectColumns} FROM "${tableName.BANK_ACCOUNT}" WHERE 1=1`,
      filters,
    );
    const result = await executeQuery(sql, params, conn);
    return result.rows && result.rows.length > 0;
  } catch (error) {
    logger.error('Error checking bank account existence:', error);
    throw error;
  }
};

export const getBankaccountDashBoardReportDao = async (filters = {}, conn = null) => {
  try {
    const selectColumns = `
      id,
      user_id,
      nick_name,
      today_balance,
      balance,
      payin_count,
      bank_used_for,
      config
    `;
    const [sql, params] = buildSelectQuery(
      `SELECT ${selectColumns} FROM "${tableName.BANK_ACCOUNT}" WHERE 1=1`,
      filters,
    );
    const result = await executeQuery(sql, params, conn);
    return result.rows || [];
  } catch (error) {
    logger.error('Error getting bank account data:', error);
    throw error;
  }
};

const getBankAccountNickNameForPayinEsDao = async (bankId, conn = null) => {
  try {
    const sql = `
      SELECT 
        ba.nick_name,
        v.user_id AS vendor_user_id,
        v.code AS vendor_code
      FROM "${tableName.BANK_ACCOUNT}" ba
      INNER JOIN "${tableName.VENDOR}" v 
        ON ba.user_id = v.user_id
      WHERE ba.id = $1
    `;
    const result = await executeQuery(sql, [bankId], conn);
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error getting bank account nickname:', error);
    throw error;
  }
};


 const getBankAccountNickNameForEsDao = async (bankId, conn = null) => {
  try {
    const sql = `
      SELECT 
        nick_name
      FROM "${tableName.BANK_ACCOUNT}"
      WHERE id = $1
    `;
    const result = await executeQuery(sql, [bankId], conn);
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error getting bank account nickname:', error);
    throw error;
  }
};
const getMerchantBankDao = async (filters, conn = null) => {
  try {
    let queryParams = [];
    let conditions = [];

    if (filters?.config_merchants_contains) {

      queryParams.push(
        Array.isArray(filters.config_merchants_contains)
          ? filters.config_merchants_contains
          : [filters.config_merchants_contains]
      );
    
      conditions.push(
        `(ba.config->'merchants')::jsonb ?| $${queryParams.length}::text[]`
      );
    
      delete filters.config_merchants_contains;
    }

    if (filters && Object.keys(filters).length > 0) {
      Object.keys(filters).forEach((key) => {
        const value = filters[key];
        if (!isSafeColumnName(key)) return;

        if (value !== null && value !== undefined && value !== '') {

          if (Array.isArray(value)) {
            conditions.push(
              `ba."${key}" = ANY($${queryParams.length + 1})`
            );

            queryParams.push(value);

          } else {

            conditions.push(
              `ba."${key}" = $${queryParams.length + 1}`
            );

            queryParams.push(value);
          }
        }
      });
    }

    const query = `
      SELECT
        ba.id,
        ba.user_id,
        ba.nick_name,
        ba.is_qr,
        ba.is_bank,
        ba.bank_used_for,
        ba.is_enabled,
        ba.min,
        ba.max,
        ba.acc_holder_name,
        ba.acc_no,
        ba.ifsc,
        ba.bank_name,
        upi_id,
        ba.config
      FROM "${tableName.BANK_ACCOUNT}" ba
      ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
    `;

    const result = await executeQuery(query, queryParams, conn);
    return result.rows || [];
  } catch (error) {
    logger.error(error);
    throw error;
  }
};
export const getMerchantLinkBankDao = async (filters, conn = null) => {
  try {
    let query = `
    SELECT 
      bank_used_for, 
      is_enabled, 
      is_qr, 
      is_bank, 
      config
    FROM "${tableName.BANK_ACCOUNT}"
    WHERE is_obsolete = false
  `;
    const [sql, parameters] = buildSelectQuery(query, filters);
    const result = await executeQuery(sql, parameters, conn);
    return result.rows;
  } catch (error) {
    logger.error('Error getting bank account payin:', error.message);
    throw error;
  }
};
const getBankByIdDao = async (filters, conn = null) => {
  try {
    const query = `SELECT  min,
  max,
  is_enabled,
  payin_count,
  config,
  balance,today_balance, user_id ,id FROM  "${tableName.BANK_ACCOUNT}" WHERE 1=1`;
    const [sql, parameters] = buildSelectQuery(query, filters);
    const result = await executeQuery(sql, parameters, conn);
    return result.rows;
  } catch (error) {
    logger.error(error);
    throw error;
  }
};

const createBankaccountDao = async (payload, conn = null) => {
  try {
    const [sql, params] = buildInsertQuery(tableName.BANK_ACCOUNT, payload);
    const result = await executeQuery(sql, params, conn);
    return result.rows[0];
  } catch (error) {
    logger.error(error);
    throw error;
  }
};

const patchBankaccountFastDao = async (id, payload, conn = null) => {
  try {
    return await buildAndExecuteUpdateQuery(
      tableName.BANK_ACCOUNT,
      payload,
      id,
      {},
      { returnUpdated: true },
      conn,
    );
  } catch (error) {
    logger.error('Error in patchBankaccountFastDao:', error);
    throw error;
  }
};

const checkBankNickNameExistsDao = async (
  companyId,
  nickName,
  conn = null,
) => {
  try {
    const query = `
      SELECT 1
      FROM "${tableName.BANK_ACCOUNT}"
      WHERE company_id = $1
        AND nick_name = $2
        AND is_obsolete = false
      LIMIT 1
    `;
    const result = await executeQuery(query, [companyId, nickName], conn);
    return result.rowCount > 0;
  } catch (error) {
    logger.error('Error in checkBankNickNameExistsDao:', error);
    throw error;
  }
};

const getBankAccountDaoNickName = async (
  company_id,
  type,
  filters = {},
  conn = null,
  // check_enabled,
) => {
  try {
    // Initialize query components
    let whereConditions = [
      'company_id = $1',
      'bank_used_for = $2',
      'is_obsolete = false',
      "(config->>'is_freeze' IS NULL OR config->>'is_freeze' != 'true' OR config->>'is_freeze' = 'false')",
    ];
    // if (type !== 'PayIn' || check_enabled === 'true') {
    //   whereConditions.push('is_enabled = true');
    // }
    let queryParams = [company_id, type];

    // Handle filters
    if (Object.keys(filters).length > 0) {
      Object.entries(filters).forEach(([key, value]) => {
        if (!isSafeColumnName(key)) return;
        if (key === 'user_id' && Array.isArray(value)) {
          // If user_id is an array, use IN clause
          whereConditions.push(`"user_id" = ANY($${queryParams.length + 1})`);
          queryParams.push(value);
        } else {
          let paramValue = value;
          // If value is an array, take the first element (adjust based on requirements)
          if (Array.isArray(value) && value.length > 0) {
            paramValue = value; // Extract first element
            if (paramValue == null) {
              return; // Skip if first element is null/undefined
            }
          }
          whereConditions.push(`"${key}" = $${queryParams.length + 1}`);
          queryParams.push(paramValue);
        }
      });
    }

    // Construct base query with dynamic WHERE clause
    let baseQuery = `
      SELECT nick_name AS label, id AS value 
      FROM "${tableName.BANK_ACCOUNT}" 
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY nick_name ASC
    `;
    // Execute query
    const result = await executeQuery(baseQuery, queryParams, conn);
    return {
      totalCount: result.rowCount,
      bankNames: result.rows,
    };
  } catch (error) {
    logger.error('Error querying bank accounts:', error.message, error.stack);
    throw error;
  }
};

const shouldAcquireBankBalanceLock = (payload = {}) => {
  if (!payload || typeof payload !== 'object') return false;
  return (
    Object.hasOwn(payload, 'balance') ||
    Object.hasOwn(payload, 'today_balance') ||
    Object.hasOwn(payload, 'payin_count')
  );
};

const logBankBalanceBlockers = async (conn, context) => {
  if (!conn?.query) return;

  try {
    const blockers = await conn.query(`
      SELECT
        a.pid,
        a.usename,
        a.application_name,
        a.client_addr,
        a.state,
        a.wait_event_type,
        a.wait_event,
        NOW() - a.query_start AS query_age,
        LEFT(a.query, 300) AS query
      FROM pg_stat_activity a
      WHERE a.pid = ANY(pg_blocking_pids(pg_backend_pid()));
    `);

    logger.warn(`Detected blocking sessions for ${context}`, {
      blockerCount: blockers.rowCount,
      blockers: blockers.rows,
    });
  } catch (diagError) {
    logger.warn(`Unable to capture blocking session diagnostics for ${context}`, {
      error: diagError.message,
    });
  }
};

const getPostgresErrorCode = (error) => error?.code || error?.err?.code;

const updateBankaccountDao = async (id, payload, isParentDeleted, conn = null) => {
  try {
    if (conn && id?.id && shouldAcquireBankBalanceLock(payload)) {
      await acquireBankBalanceLock(id.id, true, conn);
    }

    // Fetch existing bank config to merge with added_at
    const existingBankArr = await getBankAccountCoreByIdDao({
      id: id.id,
      company_id: id.company_id,
    }, conn);
    const existingBank = existingBankArr[0];

    if (!existingBank) {
      throw new Error(`Bank account not found with id: ${id.id}`);
    }

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
        } else if(key ===  'is_intent' && configUpdates[key] !== existingBank?.config?.is_intent) {
          const existingStatus = existingBank?.is_enabled || false;
          if (existingStatus) {
            throw new Error(`Cannot update 'is_intent' when bank account is enabled.`);
          }
          else {
            safeConfig[key] = configUpdates[key];
          }
        } else {
          safeConfig[key] = configUpdates[key];
        }
      }
      payload.config = safeConfig;
    }

    // if vendor delete then this config updated
    if (isParentDeleted) {
      const [sql, params] = buildUpdateQuery(
        tableName.BANK_ACCOUNT,
        payload,
        id,
      );
      const result = await executeQuery(sql, params, conn);
      return result.rows[0];
    }
    
    // Use buildAndExecuteUpdateQuery to update the bank account
    const result = await buildAndExecuteUpdateQuery(
      tableName.BANK_ACCOUNT,
      payload,
      id,
      {}, // No special fields
      { returnUpdated: true }, // Return the updated row
      conn, // Pass connection for transaction support
    );
    
    return result;
    
  } catch (error) {
    if (getPostgresErrorCode(error) === '55P03' && conn) {
      await logBankBalanceBlockers(conn, 'updateBankaccountDao');
    }
    logger.error('Error in updateBankaccountDao:', error);
    throw error;
  }
};
const deleteBankaccountByUserIdDao = async (id, payload, conn = null) => {
  try {
     const result = await buildAndExecuteUpdateQuery(
       tableName.BANK_ACCOUNT,
       payload,
       id,
       {}, 
       { returnUpdated: true }, 
       conn,
       true, 
     );
    return result;
  } catch (error) {
    logger.error('Error in deleteBankaccountDao:', error);
    throw error;
  }
};
const deleteBankaccountDao = async (id, data, conn = null) => {
  try {
   const result = await buildAndExecuteUpdateQuery(
       tableName.BANK_ACCOUNT,
       data,
       id,
       {}, 
       { returnUpdated: true }, 
       conn,
       true, 
     );
    return result;
  } catch (error)  {
    logger.error('Error in deleteBankaccountDao:', error);
    throw error;
  }
};

const markStatementUploadedDao = async (ids, conn = null) => {
  try {
    const query = `
      UPDATE public."BankAccount"
      SET config = jsonb_set(
        config::jsonb,
        '{statement_upload}',
        COALESCE(config::jsonb->'statement_upload', '{}'::jsonb)
          || jsonb_build_object(
            'uploaded', true,
            'notification_level', 0,
            'last_notified_at', null
          )
      )
      WHERE id = $1
        AND company_id = $2
        AND is_obsolete = false
      RETURNING id, nick_name, user_id, config;
    `;
    const result = await executeQuery(query, [ids.id, ids.company_id], conn);
    return result.rows[0];
  } catch (error) {
    logger.error('Error in markStatementUploadedDao:', error);
    throw error;
  }
};

// Get all banks pending statement upload with vendor info
const getPendingStatementUploadBanksDao = async (conn = null) => {
  try {
    const query = `
      SELECT ba.id, ba.nick_name, ba.user_id, ba.company_id, ba.config, v.code AS vendor_code
      FROM public."BankAccount" ba
      LEFT JOIN public."Vendor" v ON ba.user_id = v.user_id
      WHERE ba.is_obsolete = false
        AND ba.is_enabled = true
        AND ba.bank_used_for = 'PayIn'
        AND (ba.config::jsonb->'statement_upload'->>'uploaded')::boolean = false;
    `;
    const result = await executeQuery(query, [], conn);
    return result.rows;
  } catch (error) {
    logger.error('Error in getPendingStatementUploadBanksDao:', error);
    throw error;
  }
};

// Update notification level for a single bank
const updateStatementUploadNotificationDao = async (bankId, newLevel, nowISO, conn = null) => {
  try {
    const query = `
      UPDATE public."BankAccount"
      SET config = jsonb_set(
        config::jsonb,
        '{statement_upload}',
        COALESCE(config::jsonb->'statement_upload', '{}'::jsonb)
          || jsonb_build_object(
            'notification_level', $1::int,
            'last_notified_at', $2::text
          )
      )
      WHERE id = $3;
    `;
    await executeQuery(query, [newLevel, nowISO, bankId], conn);
  } catch (error) {
    logger.error('Error in updateStatementUploadNotificationDao:', error);
    throw error;
  }
};

const updateBanktBalanceDao = async (
  filters,
  amount,
  updated_by,
  conn = null,
) => {
  try {
    const [sql, params] = buildUpdateQuery(
      tableName.BANK_ACCOUNT,
      { balance: amount, today_balance: amount, updated_by },
      filters,
      { balance: '+', today_balance: '+' },
    );

    if (conn && filters?.id) {
      await acquireBankBalanceLock(filters.id, true, conn);
    }

    const result = await executeQuery(sql, params, conn);

    return result.rows[0];
  } catch (error) {
    logger.error('Error in updateBanktBalanceDao:', error);
    throw error;
  }
};

/**
 * Atomic update for bank account balance and payin_count
 * Uses SQL increment to prevent race conditions on concurrent updates
 * @param {Object} filters - { id, company_id }
 * @param {number} amount - Amount to add to balance and today_balance
 * @param {string|null} updated_by - User ID performing the update
 * @param {Object|null} conn - Database connection for transaction support
 * @returns {Object} Updated bank account row
 */
const atomicUpdateBankBalanceDao = async (
  filters,
  amount,
  updated_by,
  conn = null,
) => {
  const [sql, params] = buildUpdateQuery(
    tableName.BANK_ACCOUNT,
    { balance: amount, today_balance: amount, payin_count: 1, updated_by },
    filters,
    { balance: '+', today_balance: '+', payin_count: '+' }, // Atomic increment for all three
  );

  if (conn && filters?.id) {
    await acquireBankBalanceLock(filters.id, true, conn);
  }

  // IMPORTANT: when an external transaction connection is supplied,
  // do not retry here. Any SQL error can mark the transaction as aborted.
  // Retry decisions belong to the transaction boundary owner.
  if (conn) {
    try {
      const result = await conn.query(sql, params);
      return result.rows[0];
    } catch (error) {
      if (getPostgresErrorCode(error) === '55P03') {
        await logBankBalanceBlockers(conn, 'atomicUpdateBankBalanceDao');
      }
      logger.error('Error in atomicUpdateBankBalanceDao:', error);
      throw error;
    }
  }

  try {
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    logger.error('Error in atomicUpdateBankBalanceDao:', error);
    throw error;
  }
};

/**
 * Atomic decrement for bank account balance and payin_count
 * Uses SQL decrement to prevent race conditions on concurrent updates
 * @param {Object} filters - { id, company_id }
 * @param {number} amount - Amount to subtract from balance and today_balance
 * @param {string|null} updated_by - User ID performing the update
 * @param {Object|null} conn - Database connection for transaction support
 * @returns {Object} Updated bank account row
 */
const atomicDecrementBankBalanceDao = async (
  filters,
  amount,
  updated_by,
  conn = null,
) => {
  const [sql, params] = buildUpdateQuery(
    tableName.BANK_ACCOUNT,
    { balance: amount, today_balance: amount, payin_count: 1, updated_by },
    filters,
    { balance: '-', today_balance: '-', payin_count: '-' }, // Atomic decrement for all three
  );

  if (conn && filters?.id) {
    await acquireBankBalanceLock(filters.id, true, conn);
  }

  // IMPORTANT: when an external transaction connection is supplied,
  // do not retry here. Any SQL error can mark the transaction as aborted.
  // Retry decisions belong to the transaction boundary owner.
  if (conn) {
    try {
      const result = await conn.query(sql, params);
      return result.rows[0];
    } catch (error) {
      if (getPostgresErrorCode(error) === '55P03') {
        await logBankBalanceBlockers(conn, 'atomicDecrementBankBalanceDao');
      }
      logger.error('Error in atomicDecrementBankBalanceDao:', error);
      throw error;
    }
  }

  try {
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    logger.error('Error in atomicDecrementBankBalanceDao:', error);
    throw error;
  }
};

/**
 * Lightweight function to get only bank IDs for a given user_id(s)
 * Used for filtering in other queries - avoids heavy JOINs
 */
const getBankIdsOnlyDao = async (userIds, bankUsedFor = 'PayIn', conn = null) => {
  try {
    const userIdArray = Array.isArray(userIds) ? userIds : [userIds];
    const query = `
      SELECT id 
      FROM "BankAccount" 
      WHERE user_id = ANY($1) 
        AND bank_used_for = $2 
        AND is_obsolete = false
    `;
    const result = await executeQuery(query, [userIdArray, bankUsedFor], conn);
    return result.rows.map(row => row.id);
  } catch (error) {
    logger.error('Error in getBankIdsOnlyDao:', error);
    throw error;
  }
};

// Temporary function to reset bank notification config for all PayIn banks - used for testing notification flow
const resetBankNotificationDao = async (conn) => {
  try {    const query = `
      UPDATE public."BankAccount"
      SET config = jsonb_set(
        COALESCE(config, '{}')::jsonb,
        '{statement_upload}',
        jsonb_build_object(
          'uploaded', false,
          'notification_level', 0,
          'last_notified_at', null
        )
      )
      WHERE bank_used_for = 'PayIn';
    `;
    await executeQuery(query, [], conn);
  } catch (error) {
    logger.error('Error in resetBankNotificationDao:', error);
    throw error;
  }
}

// Batch fetch bank accounts by array of ids
const getBankaccountDaoBatch = async (ids = [], conn = null) => {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  try {
    const sql = `
      SELECT * FROM "BankAccount"
      WHERE id = ANY($1::text[])
        AND is_obsolete = false
    `;
    const result = await executeQuery(sql, [ids], conn);
    return result.rows;
  } catch (error) {
    logger.error('Error in getBankaccountDaoBatch:', error);
    throw error;
  }
};
export const updateBankAccountBalanceDao = async (
  filters,
  data,
  conn = null,
) => {
  try {
    const specialFields = {};
    Object.keys(data).forEach((el) => {
      specialFields[el] = '+'; 
    });

    const [sql, params] = buildUpdateQuery(
      tableName.BANK_ACCOUNT,
      data,
      filters,
      specialFields,
    );

    const result = conn
      ? await conn.query(sql, params)
      : await executeQuery(sql, params, conn);

    return result.rows[0];
  } catch (error) {
    logger.error('Error updating bank account balance:', error);
    throw error;
  }
};

export {
  getBankaccountDao,
  getBankAccountCoreByIdDao,
  getBankAccountsBySearchDao,
  getAllBankaccountDao,
  createBankaccountDao,
  checkBankNickNameExistsDao,
  patchBankaccountFastDao,
  updateBankaccountDao,
  deleteBankaccountDao,
  getMerchantBankDao,
  getBankAccountDaoNickName,
  getBankByIdDao,
  updateBanktBalanceDao,
  atomicUpdateBankBalanceDao,
  atomicDecrementBankBalanceDao,
  getBankAccountNickNameForEsDao,
  getBankAccountNickNameForPayinEsDao,
  getBankIdsOnlyDao,
  markStatementUploadedDao,
  getPendingStatementUploadBanksDao,
  updateStatementUploadNotificationDao,
  resetBankNotificationDao,
  getBankaccountDaoBatch,
  deleteBankaccountByUserIdDao,
};
