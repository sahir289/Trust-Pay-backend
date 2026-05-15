import { tableName } from '../../constants/index.js';
import { BadRequestError } from '../../utils/appErrors.js';
// import { PayinResponses } from '../../constants/index.js';
// import { Role } from '../../constants/index.js';
import {
  buildInsertQuery,
  buildSelectQuery,
  buildUpdateQuery,
  executeQuery,
} from '../../utils/db.js';
import dayjs from 'dayjs';
import { logger } from '../../utils/logger.js';
// import {
//   createPayinInES,
//   // getPayinsByESSearch,
//   // updatePayinInES,
// } from '../../elasticSearch/payin/common.js';
// import { getBankResponseForEsDao } from '../bankResponse/bankResponseDao.js';
// import { getMerchantForEsDao } from '../merchants/merchantDao.js';
// import { getBankAccountNickNameForPayinEsDao } from '../bankAccounts/bankaccountDao.js';
// import { buildSearchFilterObj } from '../../utils/searchBuilder.js';
// import { generateCacheKey ,setCachedData,getCachedData } from '../../utils/redishashkey.js';
// import { newTableEntry } from '../../utils/sockets.js';
export const generatePayInUrlDao = async (data, conn = null) => {
  try {
    const [sql, params] = buildInsertQuery(tableName.PAYIN, data);
    const result = await executeQuery(sql, params, conn);
    const insertedEntry = result.rows[0];
    // if (insertedEntry.merchant_id) {
    //   const code = await getMerchantForEsDao(insertedEntry.merchant_id);
    //   insertedEntry.merchant_details = {
    //     merchant_code: code.code,
    //     dispute: code.dispute_enabled,
    //     return_url: code.return_url,
    //     notify_url: code.notify_url,
    //   }
    // }
    // await createPayinInES(insertedEntry);
    return insertedEntry;
  } catch (error) {
    logger.error('Error generating PayIn URL:', error);
    throw error;
  }
};
export const getPayInwithMerchantDao = async (merchantorderid, conn = null) => {
  try {
    const sql = `
    SELECT 
      p.merchant_order_id,
      p.status,
      p.amount,
      p.id,
      p.user_submitted_utr,
      p.config,
      p.created_at,
      m.config->'unblocked_countries' AS unblockedcountries,
      p.merchant_id,
      COALESCE(
        CASE 
          WHEN c.config->'blocked_users' IS NULL OR (c.config->'blocked_users')::jsonb = '[]'::jsonb
          THEN jsonb_build_array(jsonb_build_object('user_ip', jsonb_build_array()))
          ELSE (c.config->'blocked_users')::jsonb
        END, 
        jsonb_build_array(jsonb_build_object('user_ip', jsonb_build_array()))
      ) AS blocked_users_ip,
      COALESCE(
        CASE 
          WHEN m.config->'blocked_users' IS NULL OR (m.config->'blocked_users')::jsonb = '[]'::jsonb
          THEN jsonb_build_array(jsonb_build_object('userId', jsonb_build_array()))
          ELSE (m.config->'blocked_users')::jsonb
        END, 
        jsonb_build_array(jsonb_build_object('userId', jsonb_build_array()))
      ) AS blocked_users_id,
      p.user AS userId
    FROM "Payin" p
    INNER JOIN "Merchant" m ON p.merchant_id = m.id
    INNER JOIN "Company" c ON p.company_id = c.id
    WHERE p.merchant_order_id = $1 LIMIT 1`;

    const filterArray = Array.isArray(merchantorderid)
      ? merchantorderid
      : [merchantorderid];
    const result = await executeQuery(sql, filterArray, conn);
    return result.rows[0];
  } catch (error) {
    logger.error(
      'Error getting PayIn URL with merchant and company config:',
      error,
    );
    throw error;
  }
};

export const getPayInWithMerchantOrderIdDao = async (merchantOrderid, conn = null) => {
  try {
    let sql = `
    SELECT 
      p.id,
      p.merchant_order_id,
      p.user_submitted_utr,
      p.merchant_id
    FROM "Payin" p
    WHERE p.merchant_order_id = $1`;
    sql += ` ORDER BY "created_at" DESC LIMIT 1`;
    const params = [merchantOrderid];
    const result = await executeQuery(sql, params, conn);
    return result.rows[0];
  } catch (error) {
    logger.error(
      'Error getting PayIn URL with merchant order id:',
      error,
    );
    throw error;
  }
}

//new daos for payin, bankresponse , checkutr, resethistory
export const getPayInsBankResDao = async (filters = {}, conn = null) => {
  try {
    const selectColumns = `
      id,
      merchant_id,
      user_submitted_utr,
      upi_short_code,
      amount,
      config,
      status,
      bank_acc_id,
      created_at,
      updated_at
    `;
    const [sql, params] = buildSelectQuery(
      `SELECT ${selectColumns} FROM "${tableName.PAYIN}" WHERE is_obsolete = false`,
      filters,
    );
    const result = await executeQuery(sql, params, conn);
    return result.rows || [];
  } catch (error) {
    logger.error('Error in getPayInsDao:', error);
    throw error;
  }
};

export const getPayInsForSuccessRatioDao = async (filters = {}, conn = null) => {
  try {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const sql = `
      SELECT 
        id,
        merchant_id,
        company_id,
        status,
        created_at,
        updated_at,
        user_submitted_utr
      FROM "${tableName.PAYIN}" 
      WHERE 
        is_obsolete = false
        AND created_at >= $1
        AND created_at <= $2
        AND company_id = $3
      ORDER BY created_at DESC
    `;

    const result = await executeQuery(sql, [
      last24Hours,
      now,
      filters.company_id,
    ], conn);
    return result.rows || [];
  } catch (error) {
    logger.error('Error in getPayInsForSuccessRatioDao (last 24h):', error);
    throw error;
  }
};

export const getSuccessPayInsDao = async (filters = {}, conn = null) => {
  try {
    const selectColumns = `
      id,
      merchant_order_id,
      status,
      bank_response_id,
      user_submitted_utr
    `;

    const [sql, params] = buildSelectQuery(
      `SELECT ${selectColumns} FROM "${tableName.PAYIN}" WHERE is_obsolete = false`,
      filters,
    );
    const result = await executeQuery(sql, params, conn);
    return result.rows;
  } catch (error) {
    logger.error('Error getting success PayIns:', error);
    throw error;
  }
};
export const getPayInForUpdateDao = async (filters = {}, conn = null) => {
  try {
    const selectColumns = `
      id,
      merchant_order_id,
      merchant_id,
      bank_response_id,
      bank_acc_id,
      amount,
      payin_merchant_commission,
      payin_vendor_commission,
      user_submitted_utr,
      config,
      company_id,
      approved_at,
      created_at,
      status
    `;

    const [sql, params] = buildSelectQuery(
      `SELECT ${selectColumns} FROM "${tableName.PAYIN}" WHERE is_obsolete = false`,
      filters,
    );
    const result = await executeQuery(sql, params, conn);
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error getting PayIn for update service:', error);
    throw error;
  }
};
export const getPayInForUpdateServiceDao = async (filters = {}, conn = null) => {
  try {
    const selectColumns = `
      id,
      merchant_order_id,
      merchant_id,
      status,
      bank_response_id,
      created_at,
      amount,
      company_id,
      config
    `;

    const [sql, params] = buildSelectQuery(
      `SELECT ${selectColumns} FROM "${tableName.PAYIN}" WHERE is_obsolete = false`,
      filters,
    );
    const result = await executeQuery(sql, params, conn);
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error getting PayIn for update:', error);
    throw error;
  }
};
export const getPayInForCheckStatusDao = async (filters, conn = null) => {
  try {
    const selectColumns = `
      id,
      merchant_order_id,
      amount,
      status,
      merchant_id,
      bank_response_id,
      company_id,
      user_submitted_utr,
      config
    `;
    const [sql, params] = buildSelectQuery(
      `SELECT ${selectColumns} FROM "${tableName.PAYIN}" WHERE is_obsolete = false`,
      filters,
    );

    const result = await executeQuery(sql, params, conn);
    return result.rows[0];
  } catch (error) {
    logger.error('Error getting PayIn details:', error);
    throw error;
  }
};

export const getPayinsForServiccDao = async (filters, conn = null) => {
  try {
    let [sql, params] = buildSelectQuery(
      `SELECT 
        id,
        merchant_order_id,
        amount,
        status,
        expiration_date,
        is_url_expires,
        one_time_used,
        config,
        bank_acc_id,
        company_id,
        created_at,
        bank_response_id,
        user_submitted_utr,
        upi_short_code,
        "user",
        updated_at,
        sno,
        merchant_id,
        created_by,
        user_submitted_image
       FROM "${tableName.PAYIN}" WHERE is_obsolete = false`,
      filters,
    );
    sql += ` LIMIT 1`;
    const result = await executeQuery(sql, params, conn);

    return result.rows[0];
  } catch (error) {
    logger.error(
      `Error getting PayIn with filters ${JSON.stringify(filters)}:`,
      error,
    );
    throw error;
  }
};

export const getPayInForDisputeServiceDao = async (filters = {}, conn = null) => {
  try {
    const selectColumns = `
      p.id,
      p.merchant_order_id,
      p.merchant_id,
      p.user,
      p.upi_short_code,
      p.status,
      p.bank_response_id,
      p.created_at,
      p.amount,
      p.company_id,
      p.config,
      p.bank_acc_id,
      p.user_submitted_utr,
      p.amount,
      p.is_url_expires,
      p.expiration_date
    `;

    const [sql, params] = buildSelectQuery(
      `SELECT ${selectColumns} FROM "${tableName.PAYIN}" as p WHERE is_obsolete = false`,
      filters,
    );
    const result = await executeQuery(sql, params, conn);
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error getting PayIn for dispute service:', error);
    throw error;
  }
};

export const getPayInIntentDao = async (merchantOrderId, conn = null) => {
  try {
    const selectColumns = `
      p.id,
      p.merchant_order_id,
      p.user,
      p.merchant_id,
      p.status,
      p.created_at,
      p.amount,
      p.company_id,
      p.config,
      p.bank_acc_id,
      p.user_submitted_utr,
      p.is_url_expires,
      p.expiration_date,
      (
        SELECT m.code
        FROM "${tableName.MERCHANT}" m
        WHERE m.id = p.merchant_id
      ) AS merchant_code
    `;
    const sql = `SELECT ${selectColumns} FROM "${tableName.PAYIN}" p WHERE p.merchant_order_id = $1 AND p.is_obsolete = false`;
    const params = [merchantOrderId];
    const result = await executeQuery(sql, params, conn);
    return result.rows[0] || [];
  } catch (error) {
    logger.error('Error getting while creating intent link:', error);
    throw error;
  }
};
export const getPayInByClientRefNoDao = async (clientRefNo, conn = null) => {
  try {
    const sql = `
      SELECT
        p.id,
        p.merchant_order_id,
        p.user,
        p.merchant_id,
        p.status,
        p.created_at,
        p.amount,
        p.company_id,
        p.config,
        p.bank_acc_id,
        p.user_submitted_utr,
        p.is_url_expires,
        p.expiration_date
      FROM "${tableName.PAYIN}" p
      WHERE p.config->>'clientRefNo' = $1
        AND p.is_obsolete = false
      LIMIT 1
    `;
    const result = await executeQuery(sql, [clientRefNo], conn);
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error getting PayIn by clientRefNo:', error);
    throw error;
  }
};

export const getPayInsForCronDao = async (filters = {}, conn = null) => {
  try {
    const selectColumns = `
      id,
      merchant_order_id,
      status,
      is_notified,
      amount,
      user_submitted_utr,
      config,
      created_at,
      updated_at
    `;

    const [sql, params] = buildSelectQuery(
      `SELECT ${selectColumns} FROM "${tableName.PAYIN}" WHERE is_obsolete = false`,
      filters,
    );
    const result = await executeQuery(sql, params, conn);
    return result.rows || [];
  } catch (error) {
    logger.error('Error getting PayIns for cron:', error);
    throw error;
  }
};

export const getExpiredPayInsDao = async (expireTime, status, dateField = 'created_at', conn = null) => {
  try {
    const selectColumns = `
      id,
      merchant_order_id,
      status,
      is_notified,
      amount,
      user_submitted_utr,
      config,
      created_at,
      updated_at
    `;

    const sql = `
      SELECT ${selectColumns} 
      FROM "${tableName.PAYIN}" 
      WHERE is_obsolete = false 
        AND status = $1 
        AND ${dateField} <= $2
    `;
    
    const result = await executeQuery(sql, [status, expireTime], conn);
    return result.rows || [];
  } catch (error) {
    logger.error('Error getting expired PayIns:', error);
    throw error;
  }
};

export const getPayInForTelegramUtrDao = async (filters = {}, conn = null) => {
  try {
    const selectColumns = `
      id,
      merchant_order_id,
      status,
      user_submitted_utr,
      bank_response_id,
      amount,
      merchant_id,
      company_id
    `;

    const [sql, params] = buildSelectQuery(
      `SELECT ${selectColumns} FROM "${tableName.PAYIN}" WHERE 1=1`,
      filters,
    );
    const result = await executeQuery(sql, params, conn);
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error getting PayIn for telegram UTR check:', error);
    throw error;
  }
};

export const getPayInForResetDao = async (filters = {}, conn = null) => {
  try {
    const selectColumns = `
      id,
      merchant_order_id,
      status,
      bank_response_id,
      user_submitted_utr,
      created_at,
      merchant_id,
      company_id,
      amount,
      config
    `;

    const [sql, params] = buildSelectQuery(
      `SELECT ${selectColumns} FROM "${tableName.PAYIN}" WHERE 1=1`,
      filters,
    );
    const result = await executeQuery(sql, params, conn);
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error getting PayIn for reset service:', error);
    throw error;
  }
};
export const getPayInForTelegramResponseDao = async (filters = {}, conn = null) => {
  try {
    const selectColumns = `
      id,
      merchant_order_id,
      status,
      bank_response_id,
      user_submitted_utr,
      amount,
      is_notified,
      config,
      created_at,
      company_id,
      updated_at
    `;

    const [sql, params] = buildSelectQuery(
      `SELECT ${selectColumns} FROM "${tableName.PAYIN}" WHERE is_obsolete = false`,
      filters,
    );
    const result = await executeQuery(sql, params, conn);
    return result.rows[0];
  } catch (error) {
    logger.error('Error getting PayIn for telegram response:', error);
    throw error;
  }
};
export const getPayInForTelegramResponseArrayDao = async (filters = {}, conn = null) => {
  try {
    const selectColumns = `
      id,
      merchant_order_id,
      status,
      bank_response_id,
      user_submitted_utr,
      amount,
      is_notified,
      config,
      created_at,
      company_id,
      updated_at
    `;

    const [sql, params] = buildSelectQuery(
      `SELECT ${selectColumns} FROM "${tableName.PAYIN}" WHERE is_obsolete = false`,
      filters,
    );
    const result = await executeQuery(sql, params, conn);
    return result.rows;
  } catch (error) {
    logger.error('Error getting PayIn for telegram response:', error);
    throw error;
  }
};

export const getPayInResetBasicDao = async (filters, conn = null) => {
  try {
    const baseQuery = `
      SELECT 
        id,
        merchant_order_id,
        status,
        user_submitted_utr,
        amount,
        created_at,
        updated_at
      FROM "${tableName.PAYIN}"
      WHERE is_obsolete = false
    `;

    const [sql, params] = buildSelectQuery(baseQuery, filters);
    const result = await executeQuery(sql, params, conn);
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error getting basic PayIn:', error);
    throw error;
  }
};
export const getPayInForExpireDao = async (filters, conn = null) => {
  try {
    const baseQuery = `
      SELECT 
        id,
        status
      FROM "${tableName.PAYIN}"
      WHERE is_obsolete = false
    `;

    const [sql, params] = buildSelectQuery(baseQuery, filters);
    const result = await executeQuery(sql, params, conn);
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error getting PayIn for expire:', error);
    throw error;
  }
};
// export const getPayInUrlDao = async (filters) => {
//   try {
//     const [sql, params] = buildSelectQuery(
//       `SELECT * FROM "${tableName.PAYIN}" WHERE 1=1`,
//       filters,
//     );
//     const result = await executeQuery(sql, params);
//     return result.rows[0];
//   } catch (error) {
//     logger.error('Error getting PayIn URL:', error);
//     throw error;
//   }
// };

export const getPayInPendingDao = async ({ company_id, status }, conn = null) => {
  try {
    const sql = `
      SELECT 
        p.id,
        p.created_at,
        p.user_submitted_utr,
        p.bank_acc_id,
        p.amount,
        p.merchant_order_id,
        p.config,
        m.code as merchant
      FROM "${tableName.PAYIN}" p
      JOIN "${tableName.MERCHANT}" m ON p.merchant_id = m.id
      WHERE p.company_id = $1
        AND p.status = $2
        AND p.updated_at BETWEEN NOW() - INTERVAL '2 days' AND NOW()
    `;
    const params = [company_id, status];
    const result = await executeQuery(sql, params, conn);
    return result.rows;
  } catch (error) {
    logger.error('Error getting PayIn URL:', error);
    throw error;
  }
};

export const getPayInDaoByCode = async (filters, conn = null) => {
  try {
    const sql = `
    SELECT r.code, p.config, p.merchant_id, p.user
    FROM "${tableName.PAYIN}" p
    LEFT JOIN public."Merchant" r ON p.merchant_id = r.id
    WHERE p.id = $1
      AND p.company_id = $2
  `;
    const params = [filters.id, filters.company_id];
    const result = await executeQuery(sql, params, conn);
    return result.rows;
  } catch (error) {
    logger.error('Error getting PayIn URL:', error);
    throw error;
  }
};

// export const getPayInsDao = async (filters, company_id, page, limit, role) => {
//   try {
//     const { PAYIN } = tableName;

//     if (typeof company_id === 'string') {
//       company_id = company_id.trim();
//     }

//     const conditions = [`p.is_obsolete = false`, `p.company_id = $1`];
//     const queryParams = [company_id];
//     const limitcondition = { value: '' };

//     const handledKeys = new Set([
//       'search',
//       'startDate',
//       'endDate',
//       'status',
//       'sortBy',
//       'sortOrder',
//       'nick_name',
//     ]);

//     const conditionBuilders = {
//       search: (filters, PAYIN) => {
//         if (!filters.search || typeof filters.search !== 'string') return;
//         try {
//           filters.or = buildSearchFilterObj(filters.search, PAYIN);
//           delete filters.search;
//         } catch (error) {
//           logger.warn(`Invalid search filter: ${filters.search}`, error);
//           delete filters.search;
//         }
//       },
//       dateRange: (filters, conditions, queryParams) => {
//         if (!filters.startDate || !filters.endDate) return;
//         const nextParamIdx = queryParams.length + 1;
//         conditions.push(
//           `p.created_at BETWEEN $${nextParamIdx} AND $${nextParamIdx + 1}`,
//         );
//         queryParams.push(filters.startDate, filters.endDate);
//       },
//       bankName: (filters, conditions, queryParams) => {
//         if (!filters.nick_name) return;
//         const nextParamIdx = queryParams.length + 1;
//         conditions.push(`LOWER(b.nick_name) LIKE LOWER($${nextParamIdx})`);
//         queryParams.push(filters.nick_name);
//       },
//       status: (filters, conditions, queryParams) => {
//         if (!filters.status) return;
//         const statusArray = filters.status.split(',').map((s) => s.trim());
//         const nextParamIdx = queryParams.length + 1;
//         const placeholders = statusArray
//           .map((_, idx) => `$${nextParamIdx + idx}`)
//           .join(', ');
//         conditions.push(
//           statusArray.length > 1
//             ? `p.status IN (${placeholders})`
//             : `p.status = $${nextParamIdx}`,
//         );
//         queryParams.push(...statusArray);
//       },
//       updated: (filters, conditions) => {
//         if (!filters.updatedPayin) return;
//         conditions.push(
//           `(p.config->>'history' IS NOT NULL AND p.config::jsonb ? 'history')`,
//         );
//         delete filters.updatedPayin;
//       },
//       pagination: (page, limit, queryParams, limitconditionRef) => {
//         if (!page || !limit) return;
//         const nextParamIdx = queryParams.length + 1;
//         limitconditionRef.value = `LIMIT $${nextParamIdx} OFFSET $${nextParamIdx + 1}`;
//         queryParams.push(limit, (page - 1) * limit);
//       },
//     };

//     conditionBuilders.search(filters, PAYIN);
//     conditionBuilders.dateRange(filters, conditions, queryParams);
//     conditionBuilders.bankName(filters, conditions, queryParams);
//     conditionBuilders.status(filters, conditions, queryParams);
//     conditionBuilders.pagination(page, limit, queryParams, limitcondition);
//     conditionBuilders.updated(filters, conditions, queryParams);

//     Object.entries(filters).forEach(([key, value]) => {
//       if (handledKeys.has(key) || value == null) return;
//       const nextParamIdx = queryParams.length + 1;

//       if (Array.isArray(value)) {
//         const placeholders = value
//           .map((_, idx) => `$${nextParamIdx + idx}`)
//           .join(', ');
//         conditions.push(`p.${key} IN (${placeholders})`);
//         queryParams.push(...value);
//       } else if (key === 'user_ids') {
//         const isMultiValue = typeof value === 'string' && value.includes(',');
//         const valueArray = isMultiValue
//           ? value.split(',').map((v) => v.trim())
//           : [value];
//         const placeholders = valueArray
//           .map((_, idx) => `$${nextParamIdx + idx}`)
//           .join(', ');
//         conditions.push(
//           isMultiValue
//             ? `b.user_id IN (${placeholders})`
//             : `b.user_id = $${nextParamIdx}`,
//         );
//         queryParams.push(...valueArray);
//       } else {
//         const isMultiValue = typeof value === 'string' && value.includes(',');
//         const valueArray = isMultiValue
//           ? value.split(',').map((v) => v.trim())
//           : [value];
//         const placeholders = valueArray
//           .map((_, idx) => `$${nextParamIdx + idx}`)
//           .join(', ');
//         conditions.push(
//           isMultiValue
//             ? `p.${key} IN (${placeholders})`
//             : `p.${key} = $${nextParamIdx}`,
//         );
//         queryParams.push(...valueArray);
//       }
//     });

//     let commissionSelect = '';
//     if (role === 'MERCHANT') {
//       commissionSelect = `
//         p.payin_merchant_commission,
//         p.merchant_id,
//         p.user,
//         p.merchant_order_id,
//         p.config AS payin_details,
//         json_build_object(
//           'merchant_code', r.code,
//           'dispute', r.dispute_enabled,
//           'return_url', r.config->>'return_url',
//           'notify_url', r.config->>'notify_url'
//         ) AS merchant_details
//       `;
//     } else if (role === 'VENDOR') {
//       commissionSelect = `
//         p.payin_vendor_commission,
//         v.code AS vendor_code
//       `;
//     } else {
//       commissionSelect = `
//         p.payin_merchant_commission,
//         json_build_object(
//           'merchant_code', COALESCE(r.config->>'sub_code', r.code),
//           'dispute', r.dispute_enabled,
//           'return_url', r.config->>'return_url',
//           'notify_url', r.config->>'notify_url'
//         ) AS merchant_details,
//         p.payin_vendor_commission,
//         p.config AS payin_details,
//         p.merchant_order_id,
//         p.user,
//         u.user_name AS created_by,
//         uu.user_name AS updated_by,
//         p.merchant_id,
//         v.code AS vendor_code,
//         v.user_id AS vendor_user_id,
//         p.upi_short_code,
//         p.is_url_expires,
//         p.approved_at,
//         p.created_by,
//         p.updated_by,
//         p.created_at,
//         p.updated_at,
//         CASE
//           WHEN p.config::jsonb ? 'history'
//           THEN (
//             SELECT json_agg(
//               json_build_object(
//                 'updated_by', upd_user.user_name,
//                 'updated_at', h->>'updated_at',
//                 'bank_acc_id', h->>'bank_acc_id',
//                 'nick_name', h->>'nick_name',
//                 'user', p.user,
//                 'amount', h->>'amount',
//                 'status', p.status,
//                 'merchant_order_id', p.merchant_order_id,
//                 'bank_res_details', json_build_object(
//                   'utr', h->>'utr',
//                   'amount', h->>'amount'
//                 ),
//                 'merchant_details', json_build_object(
//                   'merchant_code', COALESCE(r.config->>'sub_code', r.code)
//                 ),
//                 'payin_vendor_commission', h->>'payin_vendor_commission',
//                 'payin_merchant_commission', h->>'payin_merchant_commission'
//               ) ORDER BY (h->>'updated_at')::timestamp DESC
//             )
//             FROM jsonb_array_elements(p.config::jsonb->'history') AS h
//             LEFT JOIN public."User" upd_user ON upd_user.id = (h->>'updated_by')::text
//           )
//           ELSE NULL
//         END AS history
//       `;
//     }

//     const baseQuery = `
//       WITH filtered_payins AS (
//         SELECT DISTINCT ON (p.id)
//           p.id,
//           p.sno,
//           p.amount,
//           p.status,
//           p.is_notified,
//           p.user_submitted_utr,
//           p.user_submitted_image,
//           p.duration,
//           b.nick_name,
//           ${commissionSelect},
//           json_build_object(
//             'utr', br.utr,
//             'amount', br.amount
//           ) AS bank_res_details,
//           CASE
//           WHEN p.config::jsonb ? 'history'
//           THEN (
//             SELECT json_agg(
//               json_build_object(
//                 'updated_by', upd_user.user_name,
//                 'updated_at', h->>'updated_at',
//                 'bank_acc_id', h->>'bank_acc_id',
//                 'nick_name', h->>'nick_name',
//                 'user', p.user,
//                 'amount', h->>'amount',
//                 'status', p.status,
//                 'merchant_order_id', p.merchant_order_id,
//                 'bank_res_details', json_build_object(
//                   'utr', h->>'utr',
//                   'amount', h->>'amount'
//                 ),
//                 'merchant_details', json_build_object(
//                   'merchant_code', COALESCE(r.config->>'sub_code', r.code)
//                 ),
//                 'payin_vendor_commission', h->>'payin_vendor_commission',
//                 'payin_merchant_commission', h->>'payin_merchant_commission'
//               ) ORDER BY (h->>'updated_at')::timestamp DESC
//             )
//             FROM jsonb_array_elements(p.config::jsonb->'history') AS h
//             LEFT JOIN public."User" upd_user ON upd_user.id = (h->>'updated_by')::text
//           )
//           ELSE NULL
//         END AS history,
//           p.created_at,
//           p.updated_at
//         FROM public."${PAYIN}" p
//         LEFT JOIN public."Merchant" r ON p.merchant_id = r.id
//         LEFT JOIN public."BankAccount" b ON p.bank_acc_id = b.id
//         LEFT JOIN public."BankResponse" br ON p.bank_response_id = br.id
//         LEFT JOIN public."Vendor" v ON v.user_id = b.user_id
//         LEFT JOIN public."User" u ON p.created_by = u.id
//         LEFT JOIN public."User" uu ON p.updated_by = uu.id
//         WHERE ${conditions.join(' AND ')}
//       )
//       SELECT * FROM filtered_payins
//       ORDER BY sno DESC
//       ${limitcondition.value}
//     `;

//     const expectedParamCount = (baseQuery.match(/\$\d+/g) || []).length;
//     if (expectedParamCount !== queryParams.length) {
//       logger.warn(
//         `Expected: ${expectedParamCount}, Got: ${queryParams.length}`,
//       );
//     }
//     const result = await executeQuery(baseQuery, queryParams);
//     return {
//       payins: result.rows,
//     };
//   } catch (error) {
//     logger.error('Error getting PayIn URL:', error);
//     throw error;
//   }
// };

// export const getAllPayInsDao = async (
//   filters,
//   company_id,
//   page,
//   limit,
//   role,
// ) => {
//   try {
//     const { PAYIN } = tableName;

//     if (typeof company_id === 'string') {
//       company_id = company_id.trim();
//     }

//     const conditions = [`p.is_obsolete = false`, `p.company_id = $1`];
//     const queryParams = [company_id];
//     const limitcondition = { value: '' };

//     const handledKeys = new Set([
//       'search',
//       'startDate',
//       'endDate',
//       'status',
//       'sortBy',
//       'sortOrder',
//       'nick_name',
//     ]);

//     const conditionBuilders = {
//       search: (filters, PAYIN) => {
//         if (!filters.search || typeof filters.search !== 'string') return;
//         try {
//           filters.or = buildSearchFilterObj(filters.search, PAYIN);
//           delete filters.search;
//         } catch (error) {
//           logger.warn(`Invalid search filter: ${filters.search}`, error);
//           delete filters.search;
//         }
//       },
//       dateRange: (filters, conditions, queryParams) => {
//         if (!filters.startDate || !filters.endDate) return;
//         const nextParamIdx = queryParams.length + 1;
//         conditions.push(
//           `p.created_at BETWEEN $${nextParamIdx} AND $${nextParamIdx + 1}`,
//         );
//         queryParams.push(filters.startDate, filters.endDate);
//       },
//       bankName: (filters, conditions, queryParams) => {
//         if (!filters.nick_name) return;
//         const nextParamIdx = queryParams.length + 1;
//         conditions.push(`LOWER(b.nick_name) LIKE LOWER($${nextParamIdx})`);
//         queryParams.push(filters.nick_name);
//       },
//       status: (filters, conditions, queryParams) => {
//         if (!filters.status) return;
//         const statusArray = filters.status.split(',').map((s) => s.trim());
//         const nextParamIdx = queryParams.length + 1;
//         const placeholders = statusArray
//           .map((_, idx) => `$${nextParamIdx + idx}`)
//           .join(', ');
//         conditions.push(
//           statusArray.length > 1
//             ? `p.status IN (${placeholders})`
//             : `p.status = $${nextParamIdx}`,
//         );
//         queryParams.push(...statusArray);
//       },
//       updated: (filters, conditions) => {
//         if (!filters.updatedPayin) return;
//         conditions.push(
//           `(p.config->>'history' IS NOT NULL AND p.config::jsonb ? 'history')`,
//         );
//         delete filters.updatedPayin;
//       },
//       pagination: (page, limit, queryParams, limitconditionRef) => {
//         if (!page || !limit) return;
//         const nextParamIdx = queryParams.length + 1;
//         limitconditionRef.value = `LIMIT $${nextParamIdx} OFFSET $${nextParamIdx + 1}`;
//         queryParams.push(limit, (page - 1) * limit);
//       },
//     };

//     conditionBuilders.search(filters, PAYIN);
//     conditionBuilders.dateRange(filters, conditions, queryParams);
//     conditionBuilders.bankName(filters, conditions, queryParams);
//     conditionBuilders.status(filters, conditions, queryParams);
//     conditionBuilders.updated(filters, conditions);
//     conditionBuilders.pagination(page, limit, queryParams, limitcondition);

//     Object.entries(filters).forEach(([key, value]) => {
//       if (handledKeys.has(key) || value == null) return;
//       const nextParamIdx = queryParams.length + 1;

//       if (Array.isArray(value)) {
//         const placeholders = value
//           .map((_, idx) => `$${nextParamIdx + idx}`)
//           .join(', ');
//         conditions.push(`p.${key} IN (${placeholders})`);
//         queryParams.push(...value);
//       } else if (key === 'user_ids') {
//         const isMultiValue = typeof value === 'string' && value.includes(',');
//         const valueArray = isMultiValue
//           ? value.split(',').map((v) => v.trim())
//           : [value];
//         const placeholders = valueArray
//           .map((_, idx) => `$${nextParamIdx + idx}`)
//           .join(', ');
//         conditions.push(
//           isMultiValue
//             ? `b.user_id IN (${placeholders})`
//             : `b.user_id = $${nextParamIdx}`,
//         );
//         queryParams.push(...valueArray);
//       } else {
//         const isMultiValue = typeof value === 'string' && value.includes(',');
//         const valueArray = isMultiValue
//           ? value.split(',').map((v) => v.trim())
//           : [value];
//         const placeholders = valueArray
//           .map((_, idx) => `$${nextParamIdx + idx}`)
//           .join(', ');
//         conditions.push(
//           isMultiValue
//             ? `p.${key} IN (${placeholders})`
//             : `p.${key} = $${nextParamIdx}`,
//         );
//         queryParams.push(...valueArray);
//       }
//     });

//     let commissionSelect = '';
//     if (role === 'MERCHANT') {
//       commissionSelect = `
//         p.is_notified,
//         p.payin_merchant_commission,
//         p.merchant_id,
//         p.user,
//         p.merchant_order_id,
//         p.config AS payin_details,
//         json_build_object(
//           'merchant_code', r.code,
//           'dispute', r.dispute_enabled,
//           'return_url', r.config->>'return_url',
//           'notify_url', r.config->>'notify_url'
//         ) AS merchant_details
//       `;
//     } else if (role === 'VENDOR') {
//       commissionSelect = `
//         p.payin_vendor_commission,
//         v.code AS vendor_code
//       `;
//     } else {
//       commissionSelect = `
//         p.is_notified,
//         p.payin_merchant_commission,
//         json_build_object(
//           'merchant_code', COALESCE(r.config->>'sub_code', r.code),
//           'dispute', r.dispute_enabled,
//           'return_url', r.config->>'return_url',
//           'notify_url', r.config->>'notify_url'
//         ) AS merchant_details,
//         p.payin_vendor_commission,
//         p.config AS payin_details,
//         p.merchant_order_id,
//         p.user,
//         u.user_name AS created_by,
//         uu.user_name AS updated_by,
//         p.merchant_id,
//         v.code AS vendor_code,
//         v.user_id AS vendor_user_id,
//         p.upi_short_code,
//         p.is_url_expires,
//         p.approved_at,
//         p.created_by,
//         p.updated_by,
//         p.created_at,
//         p.updated_at
//       `;
//     }

//     const baseQuery = `
//       WITH filtered_payins AS (
//         SELECT DISTINCT ON (p.id)
//           p.id,
//           p.sno,
//           p.amount,
//           p.status,
//           p.user_submitted_utr,
//           p.user_submitted_image,
//           p.duration,
//           b.nick_name,
//           ${commissionSelect},
//           json_build_object(
//             'utr', br.utr,
//             'amount', br.amount
//           ) AS bank_res_details,
//           CASE
//           WHEN p.config::jsonb ? 'history'
//           THEN (
//             SELECT json_agg(
//               json_build_object(
//                 'updated_by', upd_user.user_name,
//                 'updated_at', h->>'updated_at',
//                 'bank_acc_id', h->>'bank_acc_id',
//                 'nick_name', h->>'nick_name',
//                 'user', p.user,
//                 'amount', h->>'amount',
//                 'status', p.status,
//                 'merchant_order_id', p.merchant_order_id,
//                 'bank_res_details', json_build_object(
//                   'utr', h->>'utr',
//                   'amount', h->>'amount'
//                 ),
//                 'merchant_details', json_build_object(
//                   'merchant_code', COALESCE(r.config->>'sub_code', r.code)
//                 ),
//                 'payin_vendor_commission', h->>'payin_vendor_commission',
//                 'payin_merchant_commission', h->>'payin_merchant_commission'
//               ) ORDER BY (h->>'updated_at')::timestamp DESC
//             )
//             FROM jsonb_array_elements(p.config::jsonb->'history') AS h
//             LEFT JOIN public."User" upd_user ON upd_user.id = (h->>'updated_by')::text
//           )
//           ELSE NULL
//         END AS history,
//           p.created_at,
//           p.updated_at
//         FROM public."${PAYIN}" p
//         LEFT JOIN public."Merchant" r ON p.merchant_id = r.id
//         LEFT JOIN public."BankAccount" b ON p.bank_acc_id = b.id
//         LEFT JOIN public."BankResponse" br ON p.bank_response_id = br.id
//         LEFT JOIN public."Vendor" v ON v.user_id = b.user_id
//         LEFT JOIN public."User" u ON p.created_by = u.id
//         LEFT JOIN public."User" uu ON p.updated_by = uu.id
//         WHERE ${conditions.join(' AND ')}
//       )
//       SELECT * FROM filtered_payins
//       ORDER BY sno DESC
//       ${limitcondition.value}
//     `;

//     const expectedParamCount = (baseQuery.match(/\$\d+/g) || []).length;
//     if (expectedParamCount !== queryParams.length) {
//       logger.warn(
//         `Expected: ${expectedParamCount}, Got: ${queryParams.length}`,
//       );
//     }
//     const result = await executeQuery(baseQuery, queryParams);
//     return {
//       payins: result.rows,
//     };
//   } catch (error) {
//     logger.error('Error getting PayIn URL:', error);
//     throw error;
//   }
// };

export const getPayinsWithoutHistoryDao = async (
  filters,
  searchTerms,
  limitNum,
  offset,
  role,
  designation,
  conn = null,
) => {
  try {
    // if (filters.search) {
    //   const filterPayinByRole = (payin, role) => {
    //     let allowedKeys;
    //     switch (role) {
    //       case Role.VENDOR:
    //         allowedKeys = PayinResponses.VENDOR;
    //         break;
    //       case Role.MERCHANT:
    //         allowedKeys = PayinResponses.MERCHANT;
    //         break;
    //       case Role.ADMIN:
    //       default:
    //         allowedKeys = PayinResponses.ADMIN;
    //         break;
    //     }
    //     return Object.fromEntries(
    //       Object.entries(payin).filter(([key]) => allowedKeys.includes(key)),
    //     );
    //   };

    //   delete filters.page;
    //   delete filters.limit;

    //   const { results, totalCount, totalPages } = await getPayinsByESSearch(
    //     filters.search,
    //     filters,
    //     offset,
    //     limitNum,
    //   );

    //   const filteredPayins = results.map((payin) =>
    //     filterPayinByRole(payin, role),
    //   );

    //   const data = {
    //     totalCount,
    //     totalPages,
    //     payins: filteredPayins,
    //   };

    //   return data;
    // }
    
    const conditions = [`p.is_obsolete = false`, `p.company_id = $1`];
    const queryParams = [filters.company_id];
    let paramIndex = 2;
    const validColumns = new Set([
      'id',
      'sno',
      'amount',
      'status',
      'merchant_order_id',
      'is_notified',
      'user_submitted_utr',
      'user',
      'user_submitted_image',
      'duration',
      'config',
      'payin_merchant_commission',
      'payin_vendor_commission',
      'approved_at',
      'created_by',
      'updated_by',
      'created_at',
      'updated_at',
      'is_obsolete',
      'company_id',
      'merchant_id',
      'bank_acc_id',
      'bank_response_id',
    ]);

    let commissionSelect = '';
    if (role === 'MERCHANT') {
      commissionSelect = `
        p.payin_merchant_commission,
        p.merchant_order_id,
        p.user,
        p.is_notified,
        p.config AS payin_details,
        json_build_object(
          'merchant_code', m.code,
          'dispute', m.dispute_enabled,
          'return_url', m.config->>'return_url',
          'notify_url', m.config->>'notify_url'
        ) AS merchant_details`;
    } else if (role === 'VENDOR') {
      commissionSelect = `
        p.payin_vendor_commission,
        COALESCE((p.config->>'actual_vendor_commission')::numeric, 0) AS actual_vendor_commission,
        COALESCE((p.config->>'brokerage_commission')::numeric, 0) AS brokerage_commission,
        v.code AS vendor_code`;
    } else if (role === 'ADMIN' && designation === 'ADMIN') {
      commissionSelect = `
        p.payin_merchant_commission,
        json_build_object(
          'merchant_code', COALESCE(m.config->>'sub_code', m.code),
          'dispute', m.dispute_enabled,
          'return_url', m.config->>'return_url',
          'notify_url', m.config->>'notify_url'
        ) AS merchant_details,
        p.merchant_order_id,
        p.config AS payin_details,
        p.payin_vendor_commission,
        COALESCE((p.config->>'actual_vendor_commission')::numeric, 0) AS actual_vendor_commission,
        COALESCE((p.config->>'brokerage_commission')::numeric, 0) AS brokerage_commission,
        v.code AS vendor_code,
        v.user_id AS vendor_user_id,
        p.upi_short_code,
        p.is_url_expires,
        p.approved_at,
        u.user_name AS created_by,
        uu.user_name AS updated_by,
        p.is_notified,
        p.user,
        p.created_at,
        p.updated_at`;
    } else {
      
      commissionSelect = `
        p.payin_merchant_commission,
        json_build_object(
          'merchant_code', COALESCE(m.config->>'sub_code', m.code),
          'dispute', m.dispute_enabled,
          'return_url', m.config->>'return_url',
          'notify_url', m.config->>'notify_url'
        ) AS merchant_details,
        p.merchant_order_id,
        p.config AS payin_details,
        p.payin_vendor_commission,
        v.code AS vendor_code,
        v.user_id AS vendor_user_id,
        p.is_url_expires,
        p.approved_at,
        u.user_name AS created_by,
        uu.user_name AS updated_by,
        p.is_notified,
        p.user,
        p.created_at,
        p.updated_at`;
    }

    let queryText = `
      SELECT
        p.id,
        p.sno,
        p.amount,
        p.status,
        p.user_submitted_utr,
        p.user_submitted_image,
        p.duration,
        b.nick_name,
        b.id AS bank_acc_id,
        ${commissionSelect ? `${commissionSelect},` : ''}
        json_build_object(
          'utr', br.utr,
          'amount', br.amount
        ) AS bank_res_details,
        p.created_at,
        p.updated_at
      FROM public."Payin" p
      LEFT JOIN public."Merchant" m ON p.merchant_id = m.id
      LEFT JOIN public."BankAccount" b ON p.bank_acc_id = b.id
      LEFT JOIN public."BankResponse" br ON p.bank_response_id = br.id
      LEFT JOIN public."Vendor" v ON v.user_id = b.user_id
      LEFT JOIN public."User" u ON p.created_by = u.id 
      LEFT JOIN public."User" uu ON p.updated_by = uu.id
      WHERE ${conditions.join(' AND ')}
    `;

    // if (searchTerms && searchTerms.length > 0) {
    //   searchTerms.forEach((term) => {
    //     if (term.toLowerCase() === 'true' || term.toLowerCase() === 'false') {
    //       const boolValue = term.toLowerCase() === 'true';
    //       conditions.push(`
    //         (
    //           p.is_notified = $${paramIndex}
    //           OR p.is_url_expires = $${paramIndex}
    //           OR p.one_time_used = $${paramIndex}
    //         )
    //       `);
    //       queryParams.push(boolValue);
    //       paramIndex++;
    //     } else {
    //       conditions.push(`
    //         (
    //           p.id::text ILIKE $${paramIndex}
    //           OR p.sno::text ILIKE $${paramIndex}
    //           OR p.upi_short_code ILIKE $${paramIndex}
    //           OR p.status ILIKE $${paramIndex}
    //           OR p.merchant_order_id ILIKE $${paramIndex}
    //           OR p.user_submitted_utr ILIKE $${paramIndex}
    //           OR p.user ILIKE $${paramIndex}
    //           OR b.nick_name ILIKE $${paramIndex}
    //           OR br.utr ILIKE $${paramIndex}
    //           OR m.code ILIKE $${paramIndex}
    //           OR v.code ILIKE $${paramIndex}
    //           OR p.amount::text ILIKE $${paramIndex}
    //           OR br.amount::text ILIKE $${paramIndex}
    //           OR (p.config->>'user') ILIKE $${paramIndex}
    //           OR (p.config->'urls'->>'site') ILIKE $${paramIndex}
    //           OR (p.config->'urls'->>'notify') ILIKE $${paramIndex}
    //         )
    //       `);
    //       queryParams.push(`%${term}%`);
    //       paramIndex++;
    //     }
    //   });
    // }

    const handledKeys = new Set([
      'status',
      'user_ids',
      'updated_at',
      'nick_name',
    ]);

    if (filters.status) {
      const statusArray = filters.status.split(',').map((s) => s.trim());
      queryText += ` AND p.status IN (${statusArray.map((_, i) => `$${paramIndex + i}`).join(', ')})`;
      queryParams.push(...statusArray);
      paramIndex += statusArray.length;
      delete filters.status;
    }
    if (filters.user_submitted_utr && filters.user_submitted_utr.trim()) {
      conditions.push(`
        (
          p.user_submitted_utr = $${paramIndex}
          OR p.bank_response_id IN (
            SELECT id FROM public."BankResponse" WHERE utr = $${paramIndex}
          )
        )
      `);
      queryParams.push(filters.user_submitted_utr.trim());
      paramIndex++;
      delete filters.user_submitted_utr;
    }
    if (filters.user_ids) {
      const userArray = filters.user_ids.split(',').map((s) => s.trim());
      queryText += ` AND v.user_id IN (${userArray.map((_, i) => `$${paramIndex + i}`).join(', ')})`;
      queryParams.push(...userArray);
      paramIndex += userArray.length;
      delete filters.user_ids;
    }
    if (filters.nick_name) {
      conditions.push(`b.nick_name = $${paramIndex}`);
      queryParams.push(filters.nick_name.trim());
      paramIndex++;
      delete filters.nick_name;
    }
    if (filters.updated_at) {
      const [day, month, year] = filters.updated_at.split('-');
      if (
        !day ||
        !month ||
        !year ||
        isNaN(new Date(`${year}-${month}-${day}`))
      ) {
        logger.error(
          `Invalid date format for updated_at: ${filters.updated_at}`,
        );
        throw new Error(
          'Invalid date format for updated_at. Expected DD-MM-YYYY',
        );
      }
      const properDateStr = `${year}-${month}-${day}`;
      let startDate = dayjs
        .tz(`${properDateStr} 00:00:00`, 'Asia/Kolkata')
        .utc()
        .format();
      let endDate = dayjs
        .tz(`${properDateStr} 23:59:59.999`, 'Asia/Kolkata')
        .utc()
        .format();
      conditions.push(
        `p.updated_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`,
      );
      queryParams.push(startDate, endDate);
      paramIndex += 2;
      delete filters.updated_at;
    }

    Object.entries(filters).forEach(([key, value]) => {
      if (handledKeys.has(key) || value == null || !validColumns.has(key)) {
        return;
      }
      const nextParamIdx = queryParams.length + 1;
      if (Array.isArray(value)) {
        const placeholders = value
          .map((_, idx) => `$${nextParamIdx + idx}`)
          .join(', ');
        conditions.push(`p.${key} IN (${placeholders})`);
        queryParams.push(...value);
      } else {
        const isMultiValue = typeof value === 'string' && value.includes(',');
        const valueArray = isMultiValue
          ? value.split(',').map((v) => v.trim())
          : [value];
        const placeholders = valueArray
          .map((_, idx) => `$${nextParamIdx + idx}`)
          .join(', ');
        conditions.push(
          isMultiValue
            ? `p.${key} IN (${placeholders})`
            : `p.${key} = $${nextParamIdx}`,
        );
        queryParams.push(...valueArray);
      }
    });

    if (conditions.length > 2) {
      queryText += ' AND (' + conditions.slice(2).join(' AND ') + ')';
    }

    const countQuery = `SELECT COUNT(*) AS total FROM (${queryText}) AS count_table`;
    queryText += `
      ORDER BY p.created_at DESC
      LIMIT $${queryParams.length + 1}
      OFFSET $${queryParams.length + 2}
    `;
    queryParams.push(limitNum, offset);

    const countResult = await executeQuery(
      countQuery,
      queryParams.slice(0, -2),
      conn
    );
    let searchResult = await executeQuery(queryText, queryParams, conn);
    const totalItems = parseInt(countResult.rows[0].total);
    let totalPages = Math.ceil(totalItems / limitNum);

    if (totalItems > 0 && searchResult.rows.length === 0 && offset > 0) {
      queryParams[queryParams.length - 1] = 0;
      searchResult = await executeQuery(queryText, queryParams, conn);
      totalPages = Math.ceil(totalItems / limitNum);
    }

    const result = {
      totalCount: totalItems,
      totalPages,
      payins: searchResult.rows,
    };
    return result;
  } catch (error) {
    logger.error('Error in getPayinsWithoutHistoryDao:', error);
    throw error;
  }
};
export const getPayinsWithHistoryDao = async (
  filters,
  searchTerms,
  limitNum,
  offset,
  role,
  designation,
  updatedPayin = false,
  conn = null,
) => {
  try {
    // const params = {
    //   filters,
    //   searchTerms: searchTerms || [],
    //   limitNum,
    //   offset,
    //   role,
    //   designation,
    //   updatedPayin,
    // };
    // const cacheKey = generateCacheKey(params, 'payins:search');
    // const cachedResult = await getCachedData(cacheKey);
    // if (cachedResult && cachedResult.totalCount>0) {
    //   return cachedResult;
    // }
    const conditions = [`p.is_obsolete = false`, `p.company_id = $1`];
    const queryParams = [filters.company_id];
    let paramIndex = 2;
    const validColumns = new Set([
      'id',
      'sno',
      'amount',
      'status',
      'merchant_order_id',
      'is_notified',
      'user_submitted_utr',
      'user',
      'user_submitted_image',
      'duration',
      'config',
      'payin_merchant_commission',
      'payin_vendor_commission',
      'approved_at',
      'created_by',
      'updated_by',
      'created_at',
      'updated_at',
      'is_obsolete',
      'company_id',
      'merchant_id',
      'bank_acc_id',
      'bank_response_id',
    ]);

    let commissionSelect = '';
    if (role === 'MERCHANT') {
      commissionSelect = `
        p.payin_merchant_commission,
        p.merchant_order_id,
        p.user,
        p.is_notified,
        p.config AS payin_details,
        json_build_object(
          'merchant_code', m.code,
          'dispute', m.dispute_enabled,
          'return_url', m.config->>'return_url',
          'notify_url', m.config->>'notify_url'
        ) AS merchant_details`;
    } else if (role === 'VENDOR') {
      commissionSelect = `
        p.payin_vendor_commission,
        COALESCE((p.config->>'actual_vendor_commission')::numeric, 0) AS actual_vendor_commission,
        COALESCE((p.config->>'brokerage_commission')::numeric, 0) AS brokerage_commission,
        v.code AS vendor_code`;
    } else if (role === 'ADMIN' && designation === 'ADMIN') {
      commissionSelect = `
        p.payin_merchant_commission,
        json_build_object(
          'merchant_code', COALESCE(m.config->>'sub_code', m.code),
          'dispute', m.dispute_enabled,
          'return_url', m.config->>'return_url',
          'notify_url', m.config->>'notify_url'
        ) AS merchant_details,
        p.merchant_order_id,
        p.config AS payin_details,
        p.payin_vendor_commission,
        COALESCE((p.config->>'actual_vendor_commission')::numeric, 0) AS actual_vendor_commission,
        COALESCE((p.config->>'brokerage_commission')::numeric, 0) AS brokerage_commission,
        v.code AS vendor_code,
        v.user_id AS vendor_user_id,
        p.upi_short_code,
        p.is_url_expires,
        p.approved_at,
        u.user_name AS created_by,
        uu.user_name AS updated_by,
        p.is_notified,
        p.user,
        p.created_at,
        p.updated_at`;
    } else {
      commissionSelect = `
        p.payin_merchant_commission,
        json_build_object(
          'merchant_code', COALESCE(m.config->>'sub_code', m.code),
          'dispute', m.dispute_enabled,
          'return_url', m.config->>'return_url',
          'notify_url', m.config->>'notify_url'
        ) AS merchant_details,
        p.merchant_order_id,
        p.config AS payin_details,
        p.payin_vendor_commission,
        v.code AS vendor_code,
        v.user_id AS vendor_user_id,
        p.is_url_expires,
        p.approved_at,
        u.user_name AS created_by,
        uu.user_name AS updated_by,
        p.is_notified,
        p.user,
        p.created_at,
        p.updated_at`;
    }

    let queryText = `
      SELECT
        p.id,
        p.sno,
        p.amount,
        p.status,
        p.user_submitted_utr,
        p.user_submitted_image,
        p.duration,
        b.nick_name,
        b.id AS bank_acc_id  
        ${commissionSelect ? `,${commissionSelect}` : ''},
        json_build_object(
          'utr', br.utr,
          'amount', br.amount
        ) AS bank_res_details,
        p.created_at,
        p.updated_at,
        CASE 
          WHEN p.config::jsonb ? 'history' 
          THEN (
            SELECT json_agg(
              json_build_object(
                'updated_by', upd_user.user_name,
                'updated_at', h->>'updated_at',
                'amount', h->>'amount',
                'bank_acc_id', h->>'bank_acc_id',
                'user', p.user,
                'nick_name', h->>'nick_name',
                'status', p.status,
                'merchant_order_id', p.merchant_order_id,
                'bank_res_details', json_build_object(
                  'utr', h->>'utr',
                  'amount', h->>'amount'
                ),
                'merchant_details', json_build_object(
                  'merchant_code', COALESCE(m.config->>'sub_code', m.code)
                ),
                'payin_vendor_commission', h->>'payin_vendor_commission',
                'payin_merchant_commission', h->>'payin_merchant_commission'
              ) ORDER BY (h->>'updated_at')::timestamp DESC
            )
            FROM jsonb_array_elements(p.config::jsonb->'history') AS h
            LEFT JOIN public."User" upd_user ON upd_user.id = (h->>'updated_by')::text
          )
          ELSE NULL
        END AS history
      FROM public."Payin" p
      LEFT JOIN public."Merchant" m ON p.merchant_id = m.id
      LEFT JOIN public."BankAccount" b ON p.bank_acc_id = b.id
      LEFT JOIN public."BankResponse" br ON p.bank_response_id = br.id
      LEFT JOIN public."Vendor" v ON v.user_id = b.user_id
      LEFT JOIN public."User" u ON p.created_by = u.id 
      LEFT JOIN public."User" uu ON p.updated_by = uu.id
      WHERE ${conditions.join(' AND ')}
    `;
//     if (searchTerms && searchTerms.length > 0) {
//       searchTerms.forEach((term) => {
//         if (term.toLowerCase() === 'true' || term.toLowerCase() === 'false') {
//           const boolValue = term.toLowerCase() === 'true';
//           conditions.push(`
//             (
//               p.is_notified = $${paramIndex}
//               OR p.is_url_expires = $${paramIndex}
//               OR p.one_time_used = $${paramIndex}
//             )
//           `);
//           queryParams.push(boolValue);
//           paramIndex++;
//         } else {
//           conditions.push(`
//           (
//   p.id::text ILIKE $${paramIndex}
//   OR p.sno::text ILIKE $${paramIndex}
//   OR p.upi_short_code ILIKE $${paramIndex}
//   OR p.status ILIKE $${paramIndex}
//   OR p.merchant_order_id ILIKE $${paramIndex}
//   OR p.user_submitted_utr ILIKE $${paramIndex}
//   OR p.user ILIKE $${paramIndex}
//   OR b.nick_name ILIKE $${paramIndex}
//   OR br.utr ILIKE $${paramIndex}
//   OR m.code ILIKE $${paramIndex}
//   OR v.code ILIKE $${paramIndex}
//   OR p.amount::text ILIKE $${paramIndex}
//   OR br.amount::text ILIKE $${paramIndex}
//   OR (p.config->>'user') ILIKE $${paramIndex}
//   OR (p.config->'urls'->>'site') ILIKE $${paramIndex}
//   OR (p.config->'urls'->>'notify') ILIKE $${paramIndex}
// )
//           `);
//           queryParams.push(`%${term}%`);
//           paramIndex++;
//         }
//       });
//     }
    const handledKeys = new Set([
      'status',
      'user_ids',
      'updated_at',
      'nick_name',
    ]);
    if (filters.status) {
      const statusArray = filters.status.split(',').map((s) => s.trim());
      queryText += ` AND p.status IN (${statusArray.map((_, i) => `$${paramIndex + i}`).join(', ')})`;
      queryParams.push(...statusArray);
      paramIndex += statusArray.length;
      delete filters.status;
    }
    if (filters.user_submitted_utr && filters.user_submitted_utr.trim()) {
      conditions.push(`
        (
          p.user_submitted_utr = $${paramIndex}
          OR p.bank_response_id IN (
            SELECT id FROM public."BankResponse" WHERE utr = $${paramIndex}
          )
        )
      `);
      queryParams.push(filters.user_submitted_utr.trim());
      paramIndex++;
      delete filters.user_submitted_utr;
    }
    if (filters.user_ids) {
      const userArray = filters.user_ids.split(',').map((s) => s.trim());
      queryText += ` AND v.user_id IN (${userArray.map((_, i) => `$${paramIndex + i}`).join(', ')})`;
      queryParams.push(...userArray);
      paramIndex += userArray.length;
      delete filters.user_ids;
    }
    if (filters.nick_name) {
      conditions.push(`b.nick_name = $${paramIndex}`);
      queryParams.push(filters.nick_name.trim());
      paramIndex++;
      delete filters.nick_name;
    }
    if (filters.updated_at) {
      const [day, month, year] = filters.updated_at.split('-');
      if (
        !day ||
        !month ||
        !year ||
        isNaN(new Date(`${year}-${month}-${day}`))
      ) {
        logger.error(
          `Invalid date format for updated_at: ${filters.updated_at}`,
        );
        throw new Error(
          'Invalid date format for updated_at. Expected DD-MM-YYYY',
        );
      }
      const properDateStr = `${year}-${month}-${day}`;
      let startDate = dayjs
        .tz(`${properDateStr} 00:00:00`, 'Asia/Kolkata')
        .utc()
        .format();
      let endDate = dayjs
        .tz(`${properDateStr} 23:59:59.999`, 'Asia/Kolkata')
        .utc()
        .format();
      conditions.push(
        `p.updated_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`,
      );
      queryParams.push(startDate, endDate);
      paramIndex += 2;
      delete filters.updated_at;
    }
    Object.entries(filters).forEach(([key, value]) => {
      if (handledKeys.has(key) || value == null || !validColumns.has(key)) {
        return;
      }
      const nextParamIdx = queryParams.length + 1;
      if (Array.isArray(value)) {
        const placeholders = value
          .map((_, idx) => `$${nextParamIdx + idx}`)
          .join(', ');
        conditions.push(`p.${key} IN (${placeholders})`);
        queryParams.push(...value);
      } else {
        const isMultiValue = typeof value === 'string' && value.includes(',');
        const valueArray = isMultiValue
          ? value.split(',').map((v) => v.trim())
          : [value];
        const placeholders = valueArray
          .map((_, idx) => `$${nextParamIdx + idx}`)
          .join(', ');
        conditions.push(
          isMultiValue
            ? `p.${key} IN (${placeholders})`
            : `p.${key} = $${nextParamIdx}`,
        );
        if (updatedPayin) {
          conditions.push(
            `(p.config->>'history' IS NOT NULL AND p.config::jsonb ? 'history')`,
          );
        }
        queryParams.push(...valueArray);
      }
    });

    if (conditions.length > 2) {
      queryText += ' AND (' + conditions.slice(2).join(' AND ') + ')';
    }

    const countQuery = `SELECT COUNT(*) AS total FROM (${queryText}) AS count_table`;
    queryText += `
      ORDER BY ${updatedPayin ? 'p.updated_at DESC' : 'p.created_at DESC'}
      LIMIT $${queryParams.length + 1}
      OFFSET $${queryParams.length + 2}
    `;
    queryParams.push(limitNum, offset);
    const countResult = await executeQuery(
      countQuery,
      queryParams.slice(0, -2),
      conn
    );
    let searchResult = await executeQuery(queryText, queryParams, conn);
    const totalItems = parseInt(countResult.rows[0].total);
    let totalPages = Math.ceil(totalItems / limitNum);
    if (totalItems > 0 && searchResult.rows.length === 0 && offset > 0) {
      queryParams[queryParams.length - 1] = 0;
      searchResult = await executeQuery(queryText, queryParams, conn);
      totalPages = Math.ceil(totalItems / limitNum);
    }
    const result = {
      totalCount: totalItems,
      totalPages,
      payins: searchResult.rows,
    };
    // await setCachedData(cacheKey, result, 500);
    return result;
  } catch (error) {
    logger.error('Error in getPayinSearch:', error);
    throw error;
  }
};
export const getPayinsSumAndCountByStatusDao = async (filters, conn = null) => {
  try {

    const queryParams = [filters.company_id];

    const statusQuery = `
      SELECT DISTINCT status
      FROM public."Payin"
      WHERE is_obsolete = false AND company_id = $1
    `;
    const statusResult = await executeQuery(statusQuery, [filters.company_id], conn);
    const validStatuses = statusResult.rows.map((row) => row.status);

    if (validStatuses.length === 0) {
      return { results: [] };
    }

    const today = dayjs().tz('Asia/Kolkata').format('YYYY-MM-DD');
    const startDate = dayjs
      .tz(`${today} 00:00:00`, 'Asia/Kolkata')
      .utc()
      .format();
    const endDate = dayjs
      .tz(`${today} 23:59:59.999`, 'Asia/Kolkata')
      .utc()
      .format();
    queryParams.push(startDate, endDate, validStatuses);

    const queryText = `
      SELECT
        s.status,
        COALESCE(SUM(p.amount), 0) AS total_amount,
        COALESCE(COUNT(p.id), 0) AS total_count
      FROM (
        SELECT unnest($4::text[]) AS status
      ) s
      LEFT JOIN public."Payin" p
        ON p.status = s.status
       AND p.company_id = $1
       AND p.is_obsolete = false
       AND p.updated_at BETWEEN $2 AND $3
      GROUP BY s.status
      ORDER BY s.status
    `;

    const result = await executeQuery(queryText, queryParams, conn);

    const results = result.rows.map((row) => ({
      status: row.status,
      totalAmount: Number.parseFloat(row.total_amount) || 0,
      totalCount: Number.parseInt(row.total_count, 10) || 0,
    }));

    return { results };
  } catch (error) {
    logger.error('Error in getPayinsSumAndCountByStatusDao:', error);
    throw error;
  }
};
export const getPayInsForResetBankResDao = async (filters = {}, conn = null) => {
  try {
    const selectColumns = `
      id,
      merchant_id,
      merchant_order_id, 
      user_submitted_utr,
      upi_short_code,
      amount,
      status,
      bank_acc_id,
      bank_response_id, 
      created_at,
      updated_at
    `;

    const [sql, params] = buildSelectQuery(
      `SELECT ${selectColumns} FROM "${tableName.PAYIN}" WHERE is_obsolete = false and status != 'FAILED' and status != 'DUPLICATE'`,
      filters,
    );
    const result = await executeQuery(sql, params, conn);
    return result.rows || [];
  } catch (error) {
    logger.error('Error in getPayInsForResetDao:', error);
    throw error;
  }
};

// export const getPayInUrlsDao = async (filters = {}) => {
//   try {
//     const [sql, params] = buildSelectQuery(
//       `SELECT * FROM "${tableName.PAYIN}" WHERE 1=1`,
//       filters,
//       // , page, limit
//     );
//     const result = await executeQuery(sql, params);
//     return result.rows;
//   } catch (error) {
//     logger.error('Error getting PayIn URLs:', error);
//     throw error;
//   }
// };

//process payin  dao fro geting payin for duplicate
export const getPayInForCheckDao = async (filters = {}, conn = null) => {
  try {
    const [sql, params] = buildSelectQuery(
      `SELECT id FROM "${tableName.PAYIN}" WHERE 1=1`,
      filters,
      // , page, limit
    );
    const result = await executeQuery(sql, params, conn);
    return result.rows;
  } catch (error) {
    logger.error('Error getting PayIn URLs:', error);
    throw error;
  }
};

export const getPayInForDuplicate = async (filters = {}, conn = null) => {
  try {
    // Adjusted query to match 3 parameters: orderid, user_submitted_utr, company_id
    const [sql, params] = buildSelectQuery(
      `SELECT id FROM "${tableName.PAYIN}" WHERE status != 'DUPLICATE' AND is_obsolete = false`,
      filters,
      // , page, limit
    );
    const result = await executeQuery(sql, params, conn);
    return result.rows;
  } catch (error) {
    logger.error('Error getting PayIn URLs:', error);
    throw error;
  }
};

export const updatePayInUrlDao = async (id, data, conn = null) => {
  try {
    // additionalData is temporary parameter for utr and amount (not used currently)
    const [sql, params] = buildUpdateQuery(tableName.PAYIN, data, { id });
    const result = await executeQuery(sql, params, conn);
    // if (data.status === Status.SUCCESS) {
    //   await newTableEntry('SUM');
    // }
    // let insertedEntry =
    // {
    //   ...result.rows[0]
    // }
    // if (data.bank_acc_id) {
    //   const bank =await getBankAccountNickNameForPayinEsDao(data.bank_acc_id);
    //   // insertedEntry.nick_name = bank.nick_name;
    //   // insertedEntry.vendor_user_id = bank.vendor_user_id;
    //   // insertedEntry.vendor_code = bank.vendor_code;
    //   insertedEntry = {
    //     ...insertedEntry,
    //     nick_name: bank.nick_name,
    //     vendor_user_id: bank.vendor_user_id,
    //     vendor_code: bank.vendor_code,
    //   };
    // }
    // if (data.bank_response_id) {
    //   const bankres = await getBankResponseForEsDao(data.bank_response_id);
    //   let bank_res_details
    //   if (bankres) {
    //     bank_res_details = {
    //       utr: bankres.utr,
    //       amount: bankres.amount,
    //     };
    //   }
    //   if (Adddata) {
    //     bank_res_details = {
    //       utr: Adddata.utr,
    //       amount: Adddata.amount,
    //     }; 
    //    }
    //    insertedEntry = {
    //      ...insertedEntry,
    //       bank_res_details,        
    //    };
    // }
    // await updatePayinInES(id, insertedEntry);
    return result.rows[0];
  } catch (error) {
    logger.error('Error updating PayIn URL:', error);
    throw error;
  }
};

/**
 * Atomically claims the payin URL by setting one_time_used = true.
 * Uses a conditional UPDATE so only the first concurrent caller wins. as we are using cluster and multiple instance can try to claim the same url so this will ensure only one instance can claim it.
 * Returns the updated row if the claim succeeded, null if already claimed.
 */
export const atomicClaimPayInUrlDao = async (id, config) => {
  try {
    const sql = `
      UPDATE "${tableName.PAYIN}"
      SET one_time_used = true, config = $2
      WHERE id = $1 AND one_time_used = false
      RETURNING *
    `;
    const result = await executeQuery(sql, [id, config]);
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error atomically claiming PayIn URL:', error);
    throw error;
  }
};

export const getPayinDetailsByMerchantOrderId = async (merchantOrderId, conn = null) => {
  if (!merchantOrderId || typeof merchantOrderId !== 'string') {
    throw new BadRequestError('Valid merchantOrderId is required');
  }

  const baseQuery = `
    SELECT 
      p.id AS payin_id,
      p.bank_acc_id,
      p.merchant_id,
      ba.user_id AS vendor_user_id,
      m.user_id AS merchant_user_id,
      p.created_at,
      p.status,
      p.user,
      p.config->'user'->>'user_ip' AS user_ip,
      p.user_submitted_utr,
      p.bank_response_id
    FROM public."Payin" p
    LEFT JOIN public."BankAccount" ba ON p.bank_acc_id = ba.id
    JOIN public."Merchant" m ON p.merchant_id = m.id
    WHERE p.merchant_order_id = $1
    AND p.is_obsolete = false
    LIMIT 1;
  `;

  try {
    const result = await executeQuery(baseQuery, [merchantOrderId], conn);

    return result.rows;
  } catch (error) {
    const errorMessage = `Error fetching payin details for merchantOrderId ${merchantOrderId}: ${error.message}`;
    logger.error(errorMessage);
    throw error;
  }
};
