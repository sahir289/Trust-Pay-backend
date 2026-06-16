import {
  tableName
  // , PayoutResponses, Role
} from '../../constants/index.js';
import {
  buildAndExecuteUpdateQuery,
  buildInsertQuery,
  buildUpdateQuery,
  executeQuery,
} from '../../utils/db.js';
import { buildSelectQuery } from '../../utils/db.js';
// import { createPayoutInES ,updatePayoutInES} from '../../elasticSearch/payout/common.js';
// import { getPayoutByESSearch } from '../../elasticSearch/payout/common.js';
// import { getMerchantForEsDao } from '../merchants/merchantDao.js';
// import { getVendorCodeDao } from '../vendors/vendorDao.js';
import { logger } from '../../utils/logger.js';
// import { getUsersNameDao } from '../users/userDao.js';
// import { getBankAccountNickNameForPayinEsDao } from '../bankAccounts/bankaccountDao.js';
import dayjs from 'dayjs';
const IST = 'Asia/Kolkata';

export const createPayoutDao = async (data, conn = null) => {
  try {
    // Ensure `config` is initialized if not provided
    if (!data.config) {
      data.config = {}; // Default to an empty JSON object
    }

    const [sql, params] = buildInsertQuery(tableName.PAYOUT, data);
    const result = await executeQuery(sql, params, conn);
    // const insertedEntry = result.rows[0];
    // const merchant = await getMerchantForEsDao(insertedEntry.merchant_id);
    // insertedEntry.merchant_details = {
    //   merchant_code: merchant.code,
    //   return_url: merchant.config?.return_url || null,
    //   notify_url: merchant.config?.notify_url || null,
    //   public_key: merchant.config?.keys?.public || null,
    //   private_key: merchant.config?.keys?.private || null
    // };
    // insertedEntry.user_bank_details = {
    //   account_holder_name:insertedEntry.acc_holder_name,
    //   account_no:insertedEntry.acc_no,
    //   ifsc_code: insertedEntry.ifsc_code,
    //   bank_name: insertedEntry.bank_name
    // };
    // const user =await getUsersNameDao(insertedEntry.created_by);
    // insertedEntry.created_by = user.user_name;
    // insertedEntry.updated_by = user.user_name;
    // await createPayoutInES(insertedEntry);
    return result.rows[0];
  } catch (error) {
    logger.error('Error in createPayoutDao:', error);
    throw error;
  }
};

export const assignedPayoutDao = async (
  payoutData,
  vendorId,
  updated_by,
  company_id,
  conn,
) => {
  try {
    if (!Array.isArray(payoutData)) {
      throw new Error('payoutData must be an array');
    }
    const results = [];
    for (const data of payoutData) {
      const updatedData = {
        vendor_id: vendorId.id,
        updated_by: updated_by,
      };
      const [sql, params] = buildUpdateQuery(tableName.PAYOUT, updatedData, {
        id: data,
        company_id
      });
      const result = conn
        ? await conn.query(sql, params)
        : await executeQuery(sql, params, conn);
      // const vendor_code = await getVendorCodeDao(vendorId.id);
      // const user = await getUsersNameDao(updated_by);
      // const esResult = {
      //   ...updatedData,
      //   vendor_code: vendor_code?.code || null,
      //   updated_by: user?.user_name || null,
      //   updated_at: new Date().toISOString(),
      // };
      // await updatePayoutInES(data, esResult);
      results.push(result.rows[0].id);
    }
    return results;
  } catch (error) {
    logger.error('Error in assignedPayoutDao:', error);
    throw error;
  }
};

export const getPayoutsDao = async (
  filters,
  company_id,
  page,
  limit,
  sortOrder = 'DESC',
  role,
  conn,
) => {
  try {
    // Ensure sortOrder has a valid value
    if (!sortOrder) {
      sortOrder = 'DESC';
    }

    if (typeof company_id === 'string') {
      company_id = company_id.trim();
    }

    let conditions = [`u.is_obsolete = false`];
    let queryParams = [];
    let paramIndex = 1;
    if (company_id) {
      conditions.push(`u.company_id = $${paramIndex}`);
      queryParams.push(company_id);
      paramIndex++;
    }
    let limitcondition = '';

    if (filters?.startDate && filters?.endDate) {
      let start;
      let end;
      start = dayjs.tz(`${filters?.startDate} 00:00:00`, IST).utc().format(); // UTC ISO string
      end = dayjs.tz(`${filters?.endDate} 23:59:59.999`, IST).utc().format();

      conditions.push(
        `u.updated_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`,
      );
      queryParams.push(start, end);
      paramIndex += 2;
    }

    if (page && limit) {
      limitcondition = `LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      queryParams.push(limit, (page - 1) * limit);
      paramIndex += 2;
    }

    const handledKeys = new Set(['page', 'limit', 'startDate', 'endDate']);
    Object.entries(filters).forEach(([key, value]) => {
      if (handledKeys.has(key) || value == null || value === '') return;
      const nextParamIdx = paramIndex;
      if (Array.isArray(value)) {
        const placeholders = value
          .map((_, idx) => `$${nextParamIdx + idx}`)
          .join(', ');
        conditions.push(`u."${key}" IN (${placeholders})`);
        queryParams.push(...value);
        paramIndex += value.length;
      } else {
        const isMultiValue = typeof value === 'string' && value.includes(',');
        const valueArray = isMultiValue
          ? value.split(',').map((v) => v.trim())
          : [value];
        const placeholders = valueArray
          .map((_, idx) => `$${nextParamIdx + idx}`)
          .join(', ');
        if (key === 'startDate' || key === 'endDate') {
          conditions.push(isMultiValue ? `u."${key}"` : `u."${key}"`);
        } else {
          conditions.push(
            isMultiValue
              ? `u."${key}" IN (${placeholders})`
              : `u."${key}" = $${nextParamIdx}`,
          );
        }
        queryParams.push(...valueArray);
        paramIndex += valueArray.length;
      }
    });

    let commissionSelect = '';
    if (role === 'MERCHANT') {
      commissionSelect = `
        u.payout_merchant_commission, 
        u.merchant_order_id,
        u.user,
        json_build_object(
          'merchant_code', r.code,
          'return_url', r.config->>'return_url',
          'notify_url', r.config->>'notify_url'
        ) AS merchant_details
      `;
    } else if (role === 'VENDOR') {
      commissionSelect = `
        u.payout_vendor_commission, 
        ve.code AS vendor_code,
        ve.id AS vendor_id, 
        ve.user_id AS vendor_user_id,
        u.config->>'method' AS payout_method`;
    } else {
      commissionSelect = `
        u.merchant_id, 
        u.payout_merchant_commission, 
        u.payout_vendor_commission,     
        u.bank_acc_id,
        u.approved_at, 
        u.created_by, 
        u.updated_by, 
        u.created_at, 
        u.company_id,
        u.user,
        ve.code AS vendor_code, 
        ve.id AS vendor_id, 
        ve.user_id AS vendor_user_id,
        u.config AS payout_details,
        u.merchant_order_id,
        u.updated_at,
        b.user_id, 
        us.user_name AS created_by,  
        uu.user_name AS updated_by,
        json_build_object(
          'merchant_code', COALESCE(r.config->>'sub_code', r.code),
          'return_url', r.config->>'return_url',
          'notify_url', r.config->>'notify_url',
          'public_key', r.config->'keys'->>'public',
          'private_key', r.config->'keys'->>'private'
        ) AS merchant_details
      `;
    }

    let baseQuery = `
      WITH filtered_payOuts AS (
        SELECT DISTINCT ON (u.id) 
          u.id, 
          u.sno, 
          u.bank_acc_id, 
          u.amount,
          u.status, 
          u.merchant_order_id,
          u.failed_reason, 
          u.currency, 
          u.upi_id, 
          u.utr_id, 
          u.rejected_reason,
          ${commissionSelect}, 
          b.id AS bank_table_id, 
          b.user_id,
          b.nick_name,
          json_build_object(
            'account_holder_name', u.acc_holder_name,
            'account_no', u.acc_no,
            'ifsc_code', u.ifsc_code,
            'bank_name', u.bank_name
          ) AS user_bank_details,
          u.created_at,
          u.updated_at,
          u.approved_at,
          u.rejected_at
        FROM public."Payout" u
        LEFT JOIN public."Merchant" r ON u.merchant_id = r.id
        LEFT JOIN public."BankAccount" b ON u.bank_acc_id = b.id
        LEFT JOIN public."Vendor" ve ON u.vendor_id = ve.id
        LEFT JOIN public."User" us ON u.created_by = us.id 
        LEFT JOIN public."User" uu ON u.updated_by = uu.id
        WHERE ${conditions.join(' AND ')}  
      ),
      total_count AS (
        SELECT COUNT(*) AS total FROM filtered_payOuts
      )
      SELECT * FROM filtered_payOuts, total_count
      ORDER BY sno ${sortOrder}
      ${limitcondition}
    `;

    let result;

    if (conn && conn.query) {
      result = await conn.query(baseQuery, queryParams);
    } else {
      result = await executeQuery(baseQuery, queryParams, conn);
    }
    return result.rows;
  } catch (error) {
    logger.error('Error in getPayoutsDao:', error);
    throw error;
  }
};


export const getPayouStatusByIdDao = async (
  id,
  company_id,
  conn = null,
  lock = false,
) => {
  try {
    const sql = `
      SELECT id, status
      FROM "${tableName.PAYOUT}"
      WHERE id = $1
        AND company_id = $2
        AND is_obsolete = false
      ${lock ? 'FOR UPDATE' : ''}
    `;

    const queryParams = [id, company_id];

    const result = await executeQuery(
      sql,
      queryParams,
      conn,
    );

    return result.rows.length > 0
      ? result.rows[0]
      : null;
  } catch (error) {
    logger.error(
      'Error fetching payout status:',
      error.message,
    );
    throw error;
  }
};

export const getPayoutByMerchantOrderIdDao = async (merchant_order_id, company_id, conn = null) => {
  try {
    const sql = `SELECT id, merchant_order_id FROM "${tableName.PAYOUT}" WHERE merchant_order_id = $1 AND company_id = $2 AND is_obsolete = false`;
    const queryParams = [merchant_order_id, company_id];
    const result = await executeQuery(sql, queryParams, conn);
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    logger.error('Error fetching payout by merchant order id:', error.message);
    throw error;
  }
}

export const getPayoutByUtrIdDao = async (utr_id, company_id, conn = null) => {
  try {
    const sql = `SELECT id, utr_id FROM "${tableName.PAYOUT}" WHERE utr_id = $1 AND company_id = $2 AND is_obsolete = false`;
    const queryParams = [utr_id, company_id];
    const result = await executeQuery(sql, queryParams, conn);
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    logger.error('Error fetching payout by utr id:', error.message);
    throw error;
  }
}

export const getPayoutBankDetailsDao = async (filters, company_id, conn = null) => {
  try {
    const conditions = [`u.is_obsolete = false`];
    const queryParams = [];
    let paramIndex = 1;

    if (company_id) {
      conditions.push(`u.company_id = $${paramIndex}`);
      queryParams.push(company_id);
      paramIndex++;
    }

    // Handle payOutids array
    if (filters.payOutids && Array.isArray(filters.payOutids)) {
      conditions.push(`u.id = ANY($${paramIndex})`);
      queryParams.push(filters.payOutids);
      paramIndex++;
    }

    const baseQuery = `
      SELECT 
        u.id,
        u.amount,
        u.status,
        json_build_object(
          'account_holder_name', u.acc_holder_name,
          'account_no', u.acc_no,
          'ifsc_code', u.ifsc_code,
          'bank_name', u.bank_name
        ) AS user_bank_details
      FROM public."Payout" u
      WHERE ${conditions.join(' AND ')}
      ORDER BY u.sno DESC
    `;

    const result = await executeQuery(baseQuery, queryParams, conn);
    return result.rows;

  } catch (error) {
    logger.error('Error in getPayoutBankDetailsDao:', error);
    throw error.message;
  }
};
export const getPayoutsNotifyDao = async (filters = {}, company_id, conn = null) => {
  try {
    const selectColumns = `
      id,
      amount,
      status,
      utr_id,
      merchant_order_id,
      merchant_id,
      config AS payout_details
    `;

    const baseQuery = `
      SELECT ${selectColumns}
      FROM "${tableName.PAYOUT}"
      WHERE is_obsolete = false
    `;

    const queryFilters = { ...filters };
    if (company_id !== undefined && company_id !== null) {
      queryFilters.company_id = company_id;
    }
    const [sql, params] = buildSelectQuery(baseQuery, queryFilters);
    const result = await executeQuery(sql, params, conn);
    return result.rows || [];
  } catch (error) {
    logger.error('Error in getPayoutsDao:', error);
    throw error;
  }
};
export const getAllPayoutsDao = async (
  filters,
  company_id,
  page,
  limit,
  sortOrder = 'DESC',
  role,
  conn,
) => {
  try {
    if (typeof company_id === 'string') {
      company_id = company_id.trim();
    }

    let conditions = [`u.is_obsolete = false`];
    let queryParams = [];
    let paramIndex = 1;
    if (company_id) {
      conditions.push(`u.company_id = $${paramIndex}`);
      queryParams.push(company_id);
      paramIndex++;
    }
    let limitcondition = '';

    if (filters?.startDate && filters?.endDate) {
      let start;
      let end;
      start = dayjs.tz(`${filters?.startDate} 00:00:00`, IST).utc().format(); 
      end = dayjs.tz(`${filters?.endDate} 23:59:59.999`, IST).utc().format();

      conditions.push(
        `CASE 
          WHEN u.status = 'REJECTED' THEN u.rejected_at 
          WHEN u.status = 'PENDING' THEN u.updated_at 
          WHEN u.status IN ('APPROVED', 'REVERSED') THEN u.approved_at 
          ELSE u.updated_at 
        END BETWEEN $${paramIndex} AND $${paramIndex + 1}`,
      );
      queryParams.push(start, end);
      paramIndex += 2;
    }

    if (page && limit) {
      limitcondition = `LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      queryParams.push(limit, (page - 1) * limit);
      paramIndex += 2;
    }
    if (filters?.userId  && !filters.vendor_id) {
      const userIdsArray = typeof filters.userId === 'string' ? JSON.parse(filters.userId) : filters.userId;
      conditions.push(`u.vendor_id = ANY($${paramIndex})`);
      queryParams.push(userIdsArray);
      paramIndex += 1;
      delete filters.userId;
    }
    if (filters?.status) {
      const statusArray = typeof filters.status === 'string' ? JSON.parse(filters.status) : filters.status;
      conditions.push(`u.status = ANY($${paramIndex})`);
      queryParams.push(statusArray);
      paramIndex += 1;
      delete filters.status;
    }

    const handledKeys = new Set(['page', 'limit', 'startDate', 'endDate', 'userId', 'status']);
    Object.entries(filters).forEach(([key, value]) => {
      if (handledKeys.has(key) || value == null || value === '') return;
      const nextParamIdx = paramIndex;
      if (Array.isArray(value)) {
        const placeholders = value.map((_, idx) => `$${nextParamIdx + idx}`).join(', ');
        conditions.push(`u."${key}" IN (${placeholders})`);
        queryParams.push(...value);
        paramIndex += value.length;
      } else {
        const isMultiValue = typeof value === 'string' && value.includes(',');
        const valueArray = isMultiValue ? value.split(',').map((v) => v.trim()) : [value];
        const placeholders = valueArray.map((_, idx) => `$${nextParamIdx + idx}`).join(', ');
        if (key === 'startDate' || key === 'endDate') {
          conditions.push(isMultiValue ? `u."${key}"` : `u."${key}"`);
        } else {
          conditions.push(
            isMultiValue ? `u."${key}" IN (${placeholders})` : `u."${key}" = $${nextParamIdx}`,
          );
        }
        queryParams.push(...valueArray);
        paramIndex += valueArray.length;
      }
    });
    let commissionSelect = '';
    if (role === 'MERCHANT') {
      commissionSelect = `
        u.payout_merchant_commission, 
        u.merchant_order_id,
        u.user,
        json_build_object(
          'merchant_code', r.code,
          'return_url', r.config->>'return_url',
          'notify_url', r.config->>'notify_url'
        ) AS merchant_details
      `;
    } else if (role === 'VENDOR') {
      commissionSelect = `
        u.payout_vendor_commission, 
        ve.code AS vendor_code,
        u.config->>'method' AS payout_method`;
    } else {
      commissionSelect = `
        u.merchant_id, 
        u.payout_merchant_commission, 
        u.payout_vendor_commission,     
        u.bank_acc_id,
        u.approved_at, 
        u.created_by, 
        u.updated_by, 
        u.created_at, 
        u.user,
        ve.code AS vendor_code, 
        ve.id AS vendor_id, 
        ve.user_id AS vendor_user_id,
        u.config AS payout_details,
        u.merchant_order_id,
        u.updated_at,
        b.user_id, 
        us.user_name AS created_by,  
        uu.user_name AS updated_by,
        json_build_object(
          'merchant_code', COALESCE(r.config->>'sub_code', r.code),
          'return_url', r.config->>'return_url',
          'notify_url', r.config->>'notify_url',
          'public_key', r.config->'keys'->>'public',
          'private_key', r.config->'keys'->>'private'
        ) AS merchant_details
      `;
    }

    let baseQuery = `
      WITH filtered_payOuts AS (
        SELECT DISTINCT ON (u.id) 
          u.id, 
          u.sno, 
          u.amount,
          u.status, 
          u.failed_reason, 
          u.currency, 
          u.upi_id, 
          u.utr_id, 
          u.rejected_reason,
          ${commissionSelect}, 
          b.nick_name,
          COALESCE((u.config->>'actual_vendor_commission')::numeric, 0) AS actual_vendor_commission,
          COALESCE((u.config->>'brokerage_commission')::numeric, 0) AS brokerage_commission,
          json_build_object(
            'account_holder_name', u.acc_holder_name,
            'account_no', u.acc_no,
            'ifsc_code', u.ifsc_code,
            'bank_name', u.bank_name
          ) AS user_bank_details,
          u.created_at,
          u.updated_at,
          u.approved_at,
          u.rejected_at
        FROM public."Payout" u
        LEFT JOIN public."Merchant" r ON u.merchant_id = r.id
        LEFT JOIN public."BankAccount" b ON u.bank_acc_id = b.id
        LEFT JOIN public."Vendor" ve ON u.vendor_id = ve.id
        LEFT JOIN public."User" us ON u.created_by = us.id 
        LEFT JOIN public."User" uu ON u.updated_by = uu.id
        WHERE ${conditions.join(' AND ')}  
      ),
      total_count AS (
        SELECT COUNT(*) AS total FROM filtered_payOuts
      )
      SELECT * FROM filtered_payOuts, total_count
      ORDER BY sno ${sortOrder}
      ${limitcondition}
    `;

    let result;

    if (conn && conn.query) {
      result = await conn.query(baseQuery, queryParams);
    } else {
      result = await executeQuery(baseQuery, queryParams, conn);
    }
    return result.rows;
  } catch (error) {
    logger.error('Error in getPayoutsDao:', error);
    throw error;
  }
};

export const getCompanyIdByMerchantOrderIdDao = async (id, conn = null) => {
  try {
    const sql = `SELECT id, merchant_order_id, company_id FROM "${tableName.PAYOUT}" WHERE merchant_order_id = $1 AND is_obsolete = false`;
    const queryParams = [id];
    const result = await executeQuery(sql, queryParams, conn);
    return result.rows.length > 0 ? result.rows[0] : result.rows;
  } catch (error) {
    logger.error('Error fetching company:', error);
    throw error;
  }
};

export const getPayoutsBySearchDao = async (
  filters,
  searchTerms,
  limitNum,
  offset,
  role,
  ifamount = false,
  conn = null,
) => {
  try {
    const conditions = [`p.is_obsolete = false`, `p.company_id = $1`];
    
    // Parameters for main query
    const queryParams = [filters.company_id];
    let paramIndex = 2; // Start from 2 since $1 is used

    // Columns we allow filtering on
    const handledKeys = new Set(['status', 'updated_at' , 'amount', 'nick_name']);
    const validColumns = new Set([
      'id',
      'sno',
      'user',
      'bank_acc_id',
      'amount',
      'status',
      'merchant_order_id',
      'failed_reason',
      'currency',
      'upi_id',
      'utr_id',
      'rejected_reason',
      'config',
      'payout_merchant_commission',
      'payout_vendor_commission',
      'approved_at',
      'created_by',
      'updated_by',
      'created_at',
      'updated_at',
      'is_obsolete',
      'company_id',
      'merchant_id',
      'vendor_id',
      'acc_holder_name',
      'acc_no',
      'ifsc_code',
      'bank_name',
    ]);

    // Build SELECT fields based on role
    let commissionSelect = '';
    if (role === 'MERCHANT') {
      commissionSelect = `
        p.payout_merchant_commission, 
        p.merchant_order_id, 
        p.user, 
        json_build_object(
          'merchant_code', m.code,
          'return_url', m.config->>'return_url',
          'notify_url', m.config->>'notify_url'
        ) AS merchant_details
      `;
    } else if (role === 'VENDOR') {
      commissionSelect = `
        p.payout_vendor_commission, 
        v.code AS vendor_code,
        p.config->>'method' AS payout_method,
        b.nick_name
      `;
    } else {
      commissionSelect = `
        p.merchant_id, 
        p.payout_merchant_commission, 
        p.payout_vendor_commission, 
        p.merchant_order_id,
        p.bank_acc_id,
        p.approved_at, 
        cu.user_name AS created_by,
        uu.user_name AS updated_by,
        p.user, 
        p.created_at, 
        v.code AS vendor_code, 
        v.id AS vendor_id, 
        v.user_id AS vendor_user_id,
        (p.config::jsonb - 'slip') AS payout_details,
        p.updated_at,
        b.user_id,
        b.nick_name,
        json_build_object(
          'merchant_code', COALESCE(m.config->>'sub_code', m.code),
          'return_url', m.config->>'return_url',
          'notify_url', m.config->>'notify_url'
        ) AS merchant_details
      `;
    }

    // Build main query
    let queryText = `
      SELECT 
        p.id, 
        p.sno,
        p.amount,
        p.status, 
        p.failed_reason, 
        p.currency, 
        p.upi_id, 
        p.utr_id, 
        p.rejected_reason,
        p.config ->> 'slip' AS slip,
        ${commissionSelect},
        json_build_object(
          'account_holder_name', p.acc_holder_name,
          'account_no', p.acc_no,
          'ifsc_code', p.ifsc_code,
          'bank_name', p.bank_name
        ) AS user_bank_details,
        p.created_at,
        p.updated_at,
        p.approved_at,
        p.rejected_at
      FROM public."Payout" p
      LEFT JOIN public."Merchant" m ON p.merchant_id = m.id
      LEFT JOIN public."BankAccount" b ON p.bank_acc_id = b.id
      LEFT JOIN public."Vendor" v ON p.vendor_id = v.id
      LEFT JOIN public."User" cu ON p.created_by = cu.id
      LEFT JOIN public."User" uu ON p.updated_by = uu.id
      WHERE ${conditions.join(' AND ')}
    `;

    // Handle status filter
    if (filters.status) {
      let statusArray;
      if (Array.isArray(filters.status)) {
        statusArray = filters.status
          .map((s) => String(s).trim())
          .filter((s) => s);
      } else {
        statusArray = filters.status
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s);
      }
      statusArray = [...new Set(statusArray)];
      if (statusArray.length > 0) {
        queryText += ` AND p.status IN (${statusArray.map((_, i) => `$${paramIndex + i}`).join(', ')})`;
        queryParams.push(...statusArray);
        paramIndex += statusArray.length;
      }
    }
    if (filters.user_bank_details) {
      const searchTerm = `%${filters.user_bank_details.trim()}%`;
      queryText += `
        AND (
          LOWER(p.acc_holder_name) LIKE LOWER($${paramIndex})
          OR LOWER(p.acc_no) LIKE LOWER($${paramIndex})
          OR LOWER(p.ifsc_code) LIKE LOWER($${paramIndex})
          OR LOWER(p.bank_name) LIKE LOWER($${paramIndex})
        )
      `;
      queryParams.push(searchTerm);
      paramIndex += 1;
      delete filters.user_bank_details;
    }
    if (filters.nick_name) {
      queryText += ` AND b.nick_name = $${paramIndex}`;
      queryParams.push(filters.nick_name);
      paramIndex += 1;
      delete filters.nick_name;
    }
    if (filters.txnid) {
      queryText += ` AND (p.config->>'txnid') = $${paramIndex}`;
      queryParams.push(filters.txnid);
      paramIndex += 1;
      delete filters.txnid;
    }
    // Handle search terms

    // Handle updated_at filter
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
    }
    if (filters.amount) {
      const amountValue = String(filters.amount).trim();
      if (amountValue.includes(',')) {
        const [minAmount, maxAmount] = amountValue
          .split(',')
          .map((v) => parseFloat(v.trim()));
        conditions.push(
          `p.amount BETWEEN $${paramIndex} AND $${paramIndex + 1}`,
        );
        queryParams.push(
          Math.min(minAmount, maxAmount),
          Math.max(minAmount, maxAmount),
        );
        paramIndex += 2;
      } else if (amountValue.includes('-')) {
        // Handle hyphen-separated range (e.g., "300-50")
        const [minAmount, maxAmount] = amountValue
          .split('-')
          .map((v) => parseFloat(v.trim()));
        conditions.push(
          `p.amount BETWEEN $${paramIndex} AND $${paramIndex + 1}`,
        );
        queryParams.push(
          Math.min(minAmount, maxAmount),
          Math.max(minAmount, maxAmount),
        );
        paramIndex += 2;
      } else {
        const singleAmount = parseFloat(amountValue);
        conditions.push(`p.amount = $${paramIndex}`);
        queryParams.push(singleAmount);
        paramIndex += 1;
      }
      delete filters.amount;
    }
    // Handle other filters
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

    // Add all conditions to main query
    if (conditions.length > 2) {
      queryText += ' AND (' + conditions.slice(2).join(' AND ') + ')';
    }

    // Create count query
    const countQuery = `SELECT COUNT(*) as total FROM (${queryText}) as count_table`;

    // Initialize total amount
    let totalAmount = 0;

    // Handle total amount calculation if requested
    if (ifamount) {
      // Create fresh conditions and parameters for amount query
      const amountConditions = [`p.is_obsolete = false`, `p.company_id = $1`];
      const amountParams = [filters.company_id];
      let amountParamIndex = 2;

      // Reapply status filter
      if (filters.status) {
        let statusArray;
        if (Array.isArray(filters.status)) {
          statusArray = filters.status
            .map((s) => String(s).trim())
            .filter((s) => s);
        } else {
          statusArray = filters.status
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s);
        }
        statusArray = [...new Set(statusArray)];
        if (statusArray.length > 0) {
          amountConditions.push(
            `p.status IN (${statusArray.map((_, i) => `$${amountParamIndex + i}`).join(', ')})`,
          );
          amountParams.push(...statusArray);
          amountParamIndex += statusArray.length;
        }
      }
      // Reapply other filters
      Object.entries(filters).forEach(([key, value]) => {
        if (handledKeys.has(key) || value == null || !validColumns.has(key)) {
          return;
        }
        const nextParamIdx = amountParams.length + 1;
        if (Array.isArray(value)) {
          const placeholders = value
            .map((_, idx) => `$${nextParamIdx + idx}`)
            .join(', ');
          amountConditions.push(`p.${key} IN (${placeholders})`);
          amountParams.push(...value);
        } else {
          const isMultiValue = typeof value === 'string' && value.includes(',');
          const valueArray = isMultiValue
            ? value.split(',').map((v) => v.trim())
            : [value];
          const placeholders = valueArray
            .map((_, idx) => `$${nextParamIdx + idx}`)
            .join(', ');
          amountConditions.push(
            isMultiValue
              ? `p.${key} IN (${placeholders})`
              : `p.${key} = $${nextParamIdx}`,
          );
          amountParams.push(...valueArray);
        }
      });
      // Build amount query
      const amountQuery = `
        SELECT COALESCE(SUM(p.amount), 0) as total_amount
        FROM public."Payout" p
        LEFT JOIN public."Merchant" m ON p.merchant_id = m.id
        LEFT JOIN public."BankAccount" b ON p.bank_acc_id = b.id
        LEFT JOIN public."Vendor" v ON p.vendor_id = v.id
        WHERE ${amountConditions.join(' AND ')}
        ${amountConditions.length > 2 ? ' AND (' + amountConditions.slice(2).join(' AND ') + ')' : ''}
      `;

      // Execute amount query
      const amountResult = await executeQuery(amountQuery, amountParams, conn);
      totalAmount = parseFloat(amountResult.rows[0]?.total_amount || 0);
    }

    // Add pagination to main query
    queryText += `
  ORDER BY p.sno ${ifamount ? 'ASC' : 'DESC'} 
  LIMIT $${queryParams.length + 1}
  OFFSET $${queryParams.length + 2}
`;
    queryParams.push(limitNum, offset);

    // Execute main queries
    const countResult = await executeQuery(
      countQuery,
      queryParams.slice(0, -2),
      conn,
    );
    const searchResult = await executeQuery(queryText, queryParams, conn);
    let finalResult = searchResult;
    if (
      parseInt(countResult.rows[0].total) > 0 &&
      searchResult.rows.length === 0 &&
      offset > 0
    ) {
      queryParams[queryParams.length - 1] = 0; 
      finalResult = await executeQuery(queryText, queryParams, conn);
    }
    const data = {
      ...(ifamount && { totalAmount: totalAmount }),
      totalCount: parseInt(countResult.rows[0].total),
      totalPages: Math.ceil(parseInt(countResult.rows[0].total) / limitNum),
      payout: finalResult.rows,
    };
    // Return results
    return data
  } catch (error) {
    logger.error('Error in getPayoutsBySearchDao:', error);
    throw error;
  }
};
export const getInitiatedAndPendingSummaryByMerchant = async (company_id, conn = null) => { 
  try {
    const queryText = `
      SELECT 
        m.code AS merchant_code,
        COUNT(p.id) AS total_count,
        COALESCE(SUM(p.amount), 0) AS total_amount
      FROM public."Payout" p
      LEFT JOIN public."Merchant" m ON p.merchant_id = m.id
      WHERE p.company_id = $1
      AND p.is_obsolete = false
      AND m.is_obsolete = false
      AND p.status IN ('INITIATED', 'PENDING')
      GROUP BY m.code
      ORDER BY total_amount DESC, merchant_code;
    `;
    const result = await executeQuery(queryText, [company_id], conn); 
    return result?.rows?.map(row => ({
      merchant: row?.merchant_code,
      count: parseInt(row?.total_count, 10) || 0,
      amount: parseFloat(row?.total_amount) || 0,
    }));
  } catch (error) {
    logger.error('Error in getInitiatedAndPendingSummaryByMerchant:', error.message);
    throw error;
  }
};
export const getPayoutsCronDao = async (payload, conn = null) => {
  try {
    let baseQuery = `SELECT * FROM public."Payout" 
      WHERE is_obsolete = false AND status = $1
      ORDER BY created_at
    `;
    const queryParams = [payload];

    const result = await executeQuery(baseQuery, queryParams, conn);
    return result.rows;
  } catch (error) {
    logger.error('Error in createPayoutDao:', error);
    throw error;
  }
};

export const updatePayoutDao = async (ids, data, conn = null) => {
  try {
    // Clone the data object to avoid modifying the original
    const updateData = { ...data };
    
    // Move txnid to config if it exists as a direct field (it should always be in config)
    if (updateData.txnid !== undefined) {
      logger.warn('txnid found as direct field, moving to config', { txnid: updateData.txnid });
      updateData.config = updateData.config || {};
      updateData.config.txnid = updateData.txnid;
      delete updateData.txnid;
    }
    
    // If config is present, ensure it's properly formatted
    if (updateData.config && typeof updateData.config === 'object') {
      // Get existing config first to merge with new config
      const existingQuery = `SELECT config FROM "${tableName.PAYOUT}" WHERE id = $1`;
      const existingData = conn
        ? await conn.query(existingQuery, [ids.id])
        : await executeQuery(existingQuery, [ids.id], conn);
      if (existingData.rows.length > 0) {
        const existingConfig = existingData.rows[0].config || {};
        // Merge existing config with new config
        updateData.config = {
          ...existingConfig,
          ...updateData.config,
        };
      }
    }
  const result = await buildAndExecuteUpdateQuery(
    tableName.PAYOUT,
    updateData,
    ids,
    {}, // No special fields
    { returnUpdated: true },
    conn,
  );
   
//     let esResult = result;
//     delete esResult.updated_by;
//     if (data.updated_by) {
//     const user = await getUsersNameDao(data.updated_by);
//     esResult = {
//       ...esResult,
//       updated_by: user?.user_name || null,
//     };
//     console.log('data.updated_by', esResult);
//   }
//   if (esResult.config && typeof esResult.config === 'object') {
//     Object.entries(esResult.config).forEach(([key, value]) => {
//       esResult[key] = value ?? null;
//     });
//   }
//   if ('vendor_id' in data && data.vendor_id === null) {
//     esResult = {
//       ...esResult,
//       vendor_code: null,
//     };
//   }
// if (data.bank_acc_id) {
//       const vendor =await getBankAccountNickNameForPayinEsDao(data.bank_acc_id);
//       esResult = {
//         ...esResult,
//         nick_name: vendor?.nick_name || null,
//         vendor_code : vendor?.vendor_code || null
//       };
// }
//     delete esResult.created_by;
  // await updatePayoutInES(ids.id, esResult);
    // Use buildAndExecuteUpdateQuery
  return result;
  } catch (error) {
    logger.error('Error occurred while updating payout:', error);
    throw error;
  }
};

export const getPayoutByTxnId = async (txnId, conn = null) => {
  try {
    const query = `
      SELECT * FROM public."Payout"
      WHERE config->>'txnid' = $1
    `;
    const params = [txnId];
    const result = await executeQuery(query, params, conn);
    return result.rows[0];
  } catch (error) {
    logger.error('Error occurred while fetching payout by txnId:', error);
    throw error;
  }
}

export const deletePayoutDao = async (ids, data, conn = null) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.PAYOUT, data, ids);
    const result = await executeQuery(sql, params, conn);
    return result.rows[0];
  } catch (error) {
    logger.error('Error occurred while deleting payout:', error);
    throw error;
  }
};
