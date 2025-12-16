import dayjs from 'dayjs';
import {
  tableName,
  // Role
} from '../../constants/index.js';
// import {
//   // getBankResponseByESSearch,
//   updateBankResponseInES,
// } from '../../elasticSearch/bankResponse/common.js';
// import { createBankResponseInES } from '../../elasticSearch/bankResponse/common.js';
// import { InternalServerError } from '../../utils/appErrors.js';
// import { generateUUID } from '../utils/generateUUID.js';
// import { generateCacheKey,getCachedData,setCachedData } from '../../utils/redishashkey.js';
// import { getBankAccountNickNameForEsDao } from '../bankAccounts/bankaccountDao.js';
import {
  executeQuery,
  buildSelectQuery,
  buildInsertQuery,
  buildUpdateQuery,
} from '../../utils/db.js';
// import { generateUUID } from '../../utils/generateUUID.js';
import { logger } from '../../utils/logger.js';
import { buildSearchFilterObj } from '../../utils/searchBuilder.js';
import { getBankaccountDao } from '../bankAccounts/bankaccountDao.js';
// import { BankResponseKeys } from '../../constants/index.js';
// import { newTableEntry } from '../../utils/sockets.js';
const IST = 'Asia/Kolkata';

const getBankResponseDao = async (
  filters,
  startDate = new Date(),
  endDate = new Date(),
  page = 0,
  pageSize = 10,
  // sortBy,
  // sortOrder,
  columns = [],
  conn = null,
) => {
  try {
    const columnList = columns || [];
    let baseQuery = `SELECT ${columnList.length ? columnList.join(', ') : '*'} FROM "${tableName.BANK_RESPONSE}" WHERE 1=1`;
    if (filters.search) {
      filters.or = buildSearchFilterObj(
        filters.search,
        tableName.BANK_RESPONSE,
      );
      delete filters.search;
    }
    const [sql, queryParams] = buildSelectQuery(
      baseQuery,
      filters,
      page,
      pageSize,
    );
    if (startDate && endDate) {
      baseQuery += ` AND created_at BETWEEN $${Object.keys(queryParams).length + 1} AND $${Object.keys(queryParams).length + 2}`;
      queryParams[`created_at_start`] = startDate;
      queryParams[`created_at_end`] = endDate;
    }
    const result = conn ? await conn.query(sql, queryParams) : await executeQuery(sql, queryParams);
    return result.rows[0];
  } catch (error) {
    logger.error('Error in getBankResponseDao:', error);
    throw error;
  }
};

const getBankResponseByJustUTRDao = async (utr, conn = null) => {
  try {
    const sql = `
      SELECT 
        id,
        bank_id,
        utr,
        amount,
        status,
        is_used
      FROM "${tableName.BANK_RESPONSE}"
      WHERE utr = $1
        AND is_obsolete = false
    `;
    const result = conn ? await conn.query(sql, [utr]) : await executeQuery(sql, [utr]);
    return result.rows[0];
  } catch (error) {
    logger.error('Error in getBankResponseByJustUTRDao:', error);
    throw error;
  }
}

export const getBankResponsePayinDao = async (filters, conn = null) => {
  try {
    let query = `
      SELECT 
        br.id,
        br.bank_id,
        br.utr,
        br.amount,
        br.status,
        br.is_used,
        ba.nick_name,
        ba.user_id
      FROM "${tableName.BANK_RESPONSE}" br
      LEFT JOIN "${tableName.BANK_ACCOUNT}" ba ON ba.id = br.bank_id
      WHERE ba.company_id = $1
      AND br.is_obsolete = false
    `;
    const params = [filters.company_id];
    let paramIndex = 2;
    const conditions = [];
    const keysUsed = ['company_id'];
    if (filters.utr) {
      conditions.push(`br.utr = $${paramIndex}`);
      params.push(filters.utr);
      keysUsed.push('utr');
      paramIndex++;
    }
    if (filters.status) {
      if (typeof filters.status === 'string') {
        conditions.push(`br.status = $${paramIndex}`);
        params.push(filters.status);
      } else if (Array.isArray(filters.status) && filters.status.length > 0) {
        conditions.push(`br.status = ANY($${paramIndex}::text[])`);
        params.push(filters.status);
      }
      keysUsed.push('status');
      paramIndex++;
    }
    if (conditions.length > 0) {
      query += ` AND ${conditions.join(' AND ')}`;
    }
    const result = conn ? await conn.query(query, params) : await executeQuery(query, params);
    return result.rows[0];
  } catch (error) {
    logger.error('Error in getBankResponseDao:', error);
    throw error;
  }
};
export const getBankResponseDaoById = async (filters, conn = null) => {
  try {
    const base = ` SELECT 
    br.id,
    br.bank_id,
    br.utr,
    ba.nick_name,
    ba.user_id
  FROM "${tableName.BANK_RESPONSE}" br
  LEFT JOIN "${tableName.BANK_ACCOUNT}" ba ON ba.id = br.bank_id
  WHERE br.id = $1 AND ba.company_id = $2`;

    const result = conn ? await conn.query(base, [filters.id, filters.company_id]) : await executeQuery(base, [filters.id, filters.company_id]);
    return result.rows[0];
  } catch (error) {
    logger.error('Error in getBankResponseDaoById:', error);
    throw error;
  }
};

export const getCheckBankResponseDao = async (
  filters = {},
  filterColumns = `
    id
  `,
  conn = null,
) => {
  try {
    const [sql, params] = buildSelectQuery(
      `SELECT ${filterColumns} FROM "${tableName.BANK_RESPONSE}" WHERE 1=1`,
      filters,
    );
    const result = conn ? await conn.query(sql, params) : await executeQuery(sql, params);
    return result.rows && result.rows.length > 0;
  } catch (error) {
    logger.error('Error fetching bank response data:', error);
    throw error;
  }
};

export const getForCreateBankResponseDao = async (
  filters = {},
  filterColumns = `
    id,
    utr,
    upi_short_code,
    company_id,
    is_used,
    amount,
    bank_id,
    created_by,
    updated_by,
    created_at,
    updated_at
  `,
  conn = null,
) => {
  try {
    const [sql, params] = buildSelectQuery(
      `SELECT ${filterColumns} FROM "${tableName.BANK_RESPONSE}" WHERE 1=1`,
      filters,
    );
    const result = conn ? await conn.query(sql, params) : await executeQuery(sql, params);
    return result.rows || [];
  } catch (error) {
    logger.error('Error fetching bank response data:', error);
    throw error;
  }
};

const getBankResponseBySearchDao = async (
  filters,
  page = 1,
  pageSize = 10,
  columns = [],
  updated,
  sortBy = 'created_at',
  sortOrder = 'DESC',
  start_date,
  end_date,
  // role
  conn = null,
) => {
  try {
    let data;
    // if (filters.search) {
    //   const filterBankResponseByRole = (bankResponse, role) => {
    //     let allowedKeys;
    //     switch (role) {
    //       case Role.VENDOR:
    //         allowedKeys = BankResponseKeys.VENDOR;
    //         break;
    //       case Role.MERCHANT:
    //         allowedKeys = BankResponseKeys.MERCHANT;
    //         break;
    //       case Role.ADMIN:
    //       default:
    //         allowedKeys = BankResponseKeys.ADMIN;
    //         break;
    //     }
    //     return Object.fromEntries(
    //       Object.entries(bankResponse).filter(([key]) =>
    //         allowedKeys.includes(key),
    //       ),
    //     );
    //   };

    //   delete filters.page;
    //   delete filters.limit;
    //   page = page - 1;
    //   const { results, totalCount, totalPages } =
    //     await getBankResponseByESSearch(
    //       filters.search,
    //       filters,
    //       page,
    //       pageSize,
    //       sortBy,
    //       sortOrder,
    //     );
    //   const filteredBankResponses = results.map((bankResponse) =>
    //     filterBankResponseByRole(bankResponse, role),
    //   );

    //   // 🔹 Build final response
    //   const data = {
    //     totalCount,
    //     totalPages,
    //     rows: filteredBankResponses,
    //   };

    //   return data;
    // }

    const selectCols = columns.length
      ? `DISTINCT ON ("BankResponse".sno) ${columns.map((col) => `"BankResponse".${col}`).join(', ')}`
      : `DISTINCT ON ("BankResponse".sno) ` +
        [
          `"BankResponse".*`,
          `"BankAccount".user_id`,
          `"BankAccount".nick_name`,
          `"BankAccount".bank_name`,
          `"Vendor".code AS vendor_code`,
        ].join(', ');
    let start;
    let end;
    let dateParams = [];
    if (start_date && end_date) {
      start = dayjs.tz(`${start_date} 00:00:00`, IST).utc().format();
      end = dayjs.tz(`${end_date} 23:59:59.999`, IST).utc().format();
      dateParams = [start, end];
    }
    let baseQuery = `
      SELECT ${selectCols}, 
        "BankResponse".created_at,
        "BankAccount".nick_name,
        "Vendor".user_id AS vendor_user_id,
        "Vendor".code AS vendor_code
      FROM "BankResponse"
      JOIN "BankAccount" ON "BankResponse".bank_id = "BankAccount".id
      LEFT JOIN "Vendor" ON "BankAccount".user_id = "Vendor".user_id
    `;

    const whereConditions = [];
    const values = [];
    let paramIndex = dateParams.length ? 3 : 1;

    if (start_date && end_date) {
      whereConditions.push(`"BankResponse".created_at BETWEEN $1 AND $2`);
      values.push(...dateParams);
    }

    // if (filters.search) {
    //   const searchTerm = filters.search.trim().split(/\s+/);
    //   if (searchTerm?.length) {
    //     const searchConditions = [];
    //     searchTerm.forEach((term) => {
    //       if (term.toLowerCase() === 'true' || term.toLowerCase() === 'false') {
    //         const boolValue = term.toLowerCase() === 'true';
    //         searchConditions.push(`"BankResponse".is_used = $${paramIndex}`);
    //         values.push(boolValue);
    //         paramIndex++;
    //       } else {
    //         const likeVal = `%${term}%`;
    //         searchConditions.push(`
    //           (
    //             "BankResponse".id::text ILIKE $${paramIndex}
    //             OR "BankResponse".status ILIKE $${paramIndex}
    //             OR "BankResponse".bank_id::text ILIKE $${paramIndex}
    //             OR "BankResponse".amount::text ILIKE $${paramIndex}
    //             OR "BankResponse".upi_short_code ILIKE $${paramIndex}
    //             OR "BankResponse".utr ILIKE $${paramIndex}
    //             OR "BankResponse".sno::text ILIKE $${paramIndex}
    //             OR "BankResponse".created_by ILIKE $${paramIndex}
    //             OR "BankResponse".updated_by ILIKE $${paramIndex}
    //             OR "BankAccount".user_id::text ILIKE $${paramIndex}
    //             OR "BankAccount".nick_name ILIKE $${paramIndex}
    //           )
    //         `);
    //         values.push(likeVal);
    //         paramIndex++;
    //       }
    //     });
    //     whereConditions.push(`(${searchConditions.join(' OR ')})`);
    //   }
    //   delete filters.search;
    // }

    whereConditions.push(`"BankResponse".is_obsolete = false`);

    if (filters.bank_id) {
      if (
        typeof filters.bank_id === 'string' &&
        filters.bank_id.includes(',')
      ) {
        filters.bank_id = filters.bank_id.split(',');
      }
      if (Array.isArray(filters.bank_id)) {
        whereConditions.push(`"BankResponse"."bank_id" = ANY($${paramIndex})`);
        values.push(filters.bank_id);
      } else {
        whereConditions.push(`"BankResponse"."bank_id" = $${paramIndex}`);
        values.push(filters.bank_id);
      }
      paramIndex++;
    }
    if (filters.nick_name) {
      whereConditions.push(`"BankAccount"."nick_name" = $${paramIndex}`);
      values.push(filters.nick_name);
      paramIndex++;
    }

    if (filters.utr) {
      whereConditions.push(`"BankResponse"."utr" = $${paramIndex}`);
      values.push(filters.utr);
      paramIndex++;
    }

    if (filters.company_id) {
      whereConditions.push(`"BankResponse"."company_id" = $${paramIndex}`);
      values.push(filters.company_id);
      paramIndex++;
    }

    if (filters.updated_by) {
      whereConditions.push(`"BankResponse"."updated_by" = $${paramIndex}`);
      values.push(filters.updated_by);
      paramIndex++;
    }

    if (filters.status) {
      filters.status = filters.status.split(',');
      whereConditions.push(`"BankResponse".status = ANY($${paramIndex})`);
      values.push(filters.status);
      paramIndex++;
    }

    if (filters.amount) {
      filters.amount = [filters.amount];
      whereConditions.push(`"BankResponse".amount = ANY($${paramIndex})`);
      values.push(filters.amount);
      paramIndex++;
    }

    if (filters.upi_short_code) {
      filters.upi_short_code = [filters.upi_short_code];
      whereConditions.push(
        `"BankResponse".upi_short_code = ANY($${paramIndex})`,
      );
      values.push(filters.upi_short_code);
      paramIndex++;
    }

    if (filters.is_used) {
      filters.is_used = [filters.is_used];
      whereConditions.push(`"BankResponse".is_used = ANY($${paramIndex})`);
      values.push(filters.is_used);
      paramIndex++;
    }

    if (updated) {
      whereConditions.push(
        `"BankResponse".updated_at IS NOT NULL 
        AND "BankResponse".updated_at != "BankResponse".created_at`,
      );
    }

    if (filters.updated_at) {
      const [day, month, year] = filters.updated_at.split('-');
      const properDateStr = `${year}-${month}-${day}`;

      let startDate = dayjs.tz(`${properDateStr} 00:00:00`, IST).utc().format();
      let endDate = dayjs
        .tz(`${properDateStr} 23:59:59.999`, IST)
        .utc()
        .format();
      whereConditions.push(
        `"BankResponse".updated_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`,
      );
      values.push(startDate, endDate);
      paramIndex += 2;
    }
    const queryIs = baseQuery;

    let queryText = queryIs;
    if (whereConditions.length) {
      queryText += ' WHERE ' + whereConditions.join(' AND ');
    }

    const countQuery = `SELECT COUNT(*) AS total FROM (${queryText}) AS count_table`;

    const validSortColumns = [
      'created_at',
      'updated_at',
      'id',
      'bank_id',
      'company_id',
      'status',
      'amount',
      'sno',
    ];
    const safeSortBy = validSortColumns.includes(sortBy)
      ? sortBy
      : 'created_at';
    const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Always order by sno first for DISTINCT ON, then by created_at DESC for latest entry
    queryText += ` ORDER BY "BankResponse"."sno" DESC, "BankResponse"."${safeSortBy}" ${safeSortOrder}`;

    const offset = (page - 1) * pageSize;
    queryText += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    values.push(Number(pageSize), offset);
    const countResult = conn ? await conn.query(countQuery, values.slice(0, -2)) : await executeQuery(countQuery, values.slice(0, -2), conn);
    let searchResult = conn ? await conn.query(queryText, values) : await executeQuery(queryText, values, conn);

    const totalCount = parseInt(countResult.rows[0].total);
    let totalPages = Math.ceil(totalCount / Number(pageSize));
    if (totalCount > 0 && searchResult.rows.length === 0 && offset > 0) {
      values[values.length - 1] = 0;
      searchResult = conn ? await conn.query(queryText, values) : await executeQuery(queryText, values, conn);
      totalPages = Math.ceil(totalCount / pageSize);
    }
    data = {
      totalCount,
      totalPages,
      rows: searchResult.rows,
    };
    // await setCachedData(cacheKey, result, 500);
    return data;
  } catch (error) {
    logger.error('Error in getBankResponseBySearchDao:', error);
    throw error;
  }
};

const getClaimResponseDao = async (filters, conn = null) => {
  try {
    // Normalize banks and vendors to arrays if not already
    let banks = filters.banks;
    let vendors = filters.vendors;
    if (banks && !Array.isArray(banks)) {
      banks = [banks];
    }
    if (vendors && !Array.isArray(vendors)) {
      vendors = [vendors];
    }
    const startDate = filters.startDate
      ? dayjs.tz(filters.startDate, IST).startOf('day')
      : dayjs().tz(IST).startOf('day');

    const endDate = filters.endDate
      ? dayjs.tz(filters.endDate, IST).endOf('day')
      : dayjs().tz(IST).endOf('day');

    const hasBankIds = Array.isArray(banks) && banks.length > 0;
    const hasVendorIds = Array.isArray(vendors) && vendors.length > 0;

    const params = [startDate.format(), endDate.format(), filters.company_id];
    let paramIndex = 4;

    let bankFilter = '';
    if (hasBankIds) {
      bankFilter = `AND br.bank_id = ANY($${paramIndex}::text[])`;
      params.push(banks);
      paramIndex++;
    }

    let vendorFilter = '';
    if (hasVendorIds) {
      vendorFilter = `AND ba.user_id = ANY($${paramIndex}::text[])`;
      params.push(vendors);
      paramIndex++;
    }

    const query = `
      WITH claimed_data AS (
        SELECT 
          COALESCE(SUM(amount), 0) AS claimed_amount,
          COUNT(*) AS claimed_count
        FROM "BankResponse" br
        LEFT JOIN "BankAccount" ba ON br.bank_id = ba.id
        WHERE br.is_used = true
          AND br.status = '/success'
          AND br.created_at BETWEEN $1 AND $2
          AND br.company_id = $3
          AND br.is_obsolete = false
          AND ba.bank_used_for = 'PayIn'
          ${bankFilter}
          ${vendorFilter}
      ),
      unclaimed_24h AS (
        SELECT 
          COALESCE(SUM(amount), 0) AS unclaimed_24h_amount,
          COUNT(*) AS unclaimed_24h_count
        FROM "BankResponse" br
        LEFT JOIN "BankAccount" ba ON br.bank_id = ba.id
        WHERE br.is_used = false
          AND br.status = '/success'
          AND br.created_at BETWEEN $1 AND $2
          AND br.company_id = $3
          AND br.is_obsolete = false
          AND ba.bank_used_for = 'PayIn'
          ${bankFilter}
          ${vendorFilter}
      ),
      total_unclaimed AS (
        SELECT 
          COALESCE(SUM(amount), 0) AS total_unclaimed_amount,
          COUNT(*) AS total_unclaimed_count
        FROM "BankResponse" br
        LEFT JOIN "BankAccount" ba ON br.bank_id = ba.id
        WHERE br.is_used = false
          AND br.status = '/success'
          AND br.company_id = $3
          AND br.is_obsolete = false
          AND ba.bank_used_for = 'PayIn'
          ${bankFilter}
          ${vendorFilter}
      ),
      banks_unclaims_amount AS (
        SELECT 
          ba.bank_name,
          ba.nick_name,
          COALESCE(SUM(br.amount), 0) AS amount,
          COUNT(br.id) AS count
        FROM "BankAccount" ba
        LEFT JOIN "BankResponse" br
          ON ba.id = br.bank_id
        WHERE ba.company_id = $3
          AND ba.bank_used_for = 'PayIn'
          AND br.is_used = false
          AND br.status = '/success'
          AND br.is_obsolete = false
          ${bankFilter}
          ${vendorFilter}
        GROUP BY ba.bank_name, ba.nick_name
      )

      SELECT 
        cd.claimed_amount,
        cd.claimed_count,
        u24.unclaimed_24h_amount,
        u24.unclaimed_24h_count,
        tu.total_unclaimed_amount,
        tu.total_unclaimed_count,
        bua.bank_name,
        bua.nick_name,
        bua.amount,
        bua.count
      FROM claimed_data cd, unclaimed_24h u24, total_unclaimed tu
      LEFT JOIN banks_unclaims_amount bua ON TRUE;
    `;

    const result = conn ? await conn.query(query, params) : await executeQuery(query, params);

    if (!result || result.rows.length === 0) {
      return {
        claimed24h: { amount: 0, count: 0 },
        unclaimed24h: { amount: 0, count: 0 },
        totalUnclaimed: { amount: 0, count: 0 },
        banks_unclaims_amount: [],
      };
    }

    const firstRow = result.rows[0];

    const banks_unclaims_amount = result.rows
      .filter((row) => row.bank_name)
      .map((row) => ({
        bank_name: row.bank_name,
        nick_name: row.nick_name,
        amount: parseFloat(row.amount) || 0,
        count: parseInt(row.count) || 0,
      }));

    return {
      claimed24h: {
        amount: parseFloat(firstRow.claimed_amount) || 0,
        count: parseInt(firstRow.claimed_count) || 0,
      },
      unclaimed24h: {
        amount: parseFloat(firstRow.unclaimed_24h_amount) || 0,
        count: parseInt(firstRow.unclaimed_24h_count) || 0,
      },
      totalUnclaimed: {
        amount: parseFloat(firstRow.total_unclaimed_amount) || 0,
        count: parseInt(firstRow.total_unclaimed_count) || 0,
      },
      banks_unclaims_amount,
    };
  } catch (error) {
    logger.error('Error getting claim response:', error);
    throw error;
  }
};
const getBankResponseForEsDao = async (bankId, conn = null) => {
  try {
    const sql = `
      SELECT 
        utr,
        amount
      FROM "${tableName.BANK_RESPONSE}"
      WHERE id = $1
    `;
    const result = conn ? await conn.query(sql, [bankId]) : await executeQuery(sql, [bankId]);
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error getting bank account nickname:', error);
    throw error;
  }
};
const getBankResponsesforFreeze = async (filters, conn = null) => {
  try {
    const { bank_id, status, is_used } = filters;

    let query = `
      SELECT id, status, bank_id, is_used
      FROM public."BankResponse"
      WHERE is_obsolete = false
    `;

    const params = [];
    let index = 1;

    if (bank_id) {
      query += ` AND bank_id = $${index++}`;
      params.push(bank_id);
    }

    if (status) {
      query += ` AND status = $${index++}`;
      params.push(status);
    }

    if (typeof is_used === 'boolean') {
      query += ` AND is_used = $${index++}`;
      params.push(is_used);
    }

    query += ` ORDER BY created_at ASC`;

    const result = conn ? await conn.query(query, params) : await executeQuery(query, params);
    return result.rows;
  } catch (error) {
    logger.error('Error in getBankResponsesDao:', error);
    throw error;
  }
};
export const getBankResponsePendingDao = async (filters, conn = null) => {
  try {
    const sql = `
      SELECT 
        br.id,
        br.amount,
        br.utr,
        br.bank_id,
        br.company_id,
        br.status,
        br.is_used,
        br.created_at,
        ba.config
      FROM "${tableName.BANK_RESPONSE}" br
      INNER JOIN "${tableName.BANK_ACCOUNT}" ba 
        ON br.bank_id = ba.id
      WHERE 1=1
        AND (
          ba.config IS NULL
          OR ba.config->>'is_freeze' IS NULL
          OR (ba.config->>'is_freeze')::boolean = false
        )
        AND br.is_obsolete = false
        AND br.is_used = $1
        AND br.status = $2
        AND br.utr = $3
        AND br.company_id = $4
      ORDER BY br.created_at DESC
    `;
    const params = [
      filters.is_used,
      filters.status,
      filters.utr,
      filters.company_id,
    ];

    const result = conn ? await conn.query(sql, params) : await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    logger.error('Error getting BankResponse:', error);
    throw error;
  }
};

const getBankResponseDaoAll = async (
  filters,
  page = 1,
  pageSize = 10,
  columns = [],
  updated,
  sortBy = 'created_at',
  sortOrder = 'DESC',
  start_date,
  end_date,
) => {
  try {
    let values = [];
    let bankId;
    let bankDetails;
    if (filters?.bank_id) {
      bankId = filters?.bank_id;
      bankDetails = await getBankaccountDao({ id: bankId }, null, null);
    }
    // Use DISTINCT ON to avoid duplicate rows for same BankResponse.sno
    const selectCols = columns.length
      ? `DISTINCT ON ("BankResponse".sno) ${columns.map((col) => `"BankResponse".${col}`).join(', ')}`
      : `DISTINCT ON ("BankResponse".sno) ` +
        [
          `"BankResponse".*`,
          `"BankAccount".user_id`,
          `"BankAccount".nick_name`,
          `"BankAccount".bank_name`,
          `"Vendor".code AS vendor_code`,
        ].join(', ');

    let start;
    let end;
    if (start_date && end_date) {
      start = dayjs.tz(`${start_date} 00:00:00`, IST).utc().format(); // UTC ISO string
      end = dayjs.tz(`${end_date} 23:59:59.999`, IST).utc().format();
    }
    let baseQueryDate = `
      WITH filtered_accounts AS (
        SELECT 
          "BankAccount".*, 
          jsonb_object_agg(key, value) FILTER (
            WHERE key ~ '^\\d{4}-\\d{2}-\\d{2}' 
              AND (key)::timestamp BETWEEN '${start}'::timestamp AND '${end}'::timestamp
          ) AS filtered_merchant_added
        FROM "BankAccount",
             jsonb_each(("BankAccount".config -> 'merchant_added')::jsonb)
        GROUP BY "BankAccount".id
      )
      SELECT ${selectCols}, 
        "BankResponse".created_at,
        jsonb_set("BankAccount".config::jsonb, '{merchant_added}', COALESCE(filtered_merchant_added, '{}'::jsonb)) AS details,
        "BankAccount".nick_name,
        "Vendor".user_id AS vendor_user_id,
        "Merchant".code AS merchant_code
      FROM "BankResponse"
      JOIN filtered_accounts AS "BankAccount" 
        ON "BankResponse".bank_id = "BankAccount".id
      LEFT JOIN "Vendor" 
        ON "BankAccount".user_id = "Vendor".user_id
          LEFT JOIN "Payin"
        ON "BankResponse".id = "Payin".bank_response_id
        AND "BankResponse".is_used = true
      LEFT JOIN "Merchant"
        ON "Payin".merchant_id = "Merchant".id
    `;

    let baseQuery = `
      SELECT ${selectCols}, "BankResponse".created_at,
        "BankAccount".config AS details,
        "BankAccount".nick_name,
        "Vendor".user_id AS vendor_user_id,
        "Merchant".code AS merchant_code
      FROM "BankResponse"
      JOIN "BankAccount" ON "BankResponse".bank_id = "BankAccount".id
      LEFT JOIN "Vendor" ON "BankAccount".user_id = "Vendor".user_id
      LEFT JOIN "Payin"
        ON "BankResponse".id = "Payin".bank_response_id
      LEFT JOIN "Merchant"
        ON "Payin".merchant_id = "Merchant".id
      `;

    let baseQueryVendor = '';
    const whereConditions = [];

    if (start_date && end_date) {
      if (updated) {
        whereConditions.push(
          `"BankResponse".updated_at BETWEEN '${start}' AND '${end}'`,
        );
      } else {
        whereConditions.push(
          `"BankResponse".created_at BETWEEN '${start}' AND '${end}'`,
        );
      }
    }
    if (filters.userId) {
      let userIdsArray;
      try {
        userIdsArray =
          typeof filters.userId === 'string'
            ? JSON.parse(filters.userId)
            : filters.userId;
      } catch (error) {
        logger.error('Invalid userId format:', error);
        throw new Error('Invalid userId format');
      }
      baseQueryVendor = `
      SELECT DISTINCT ON (br.sno)
      br.created_at,
      br.sno,
      br.utr,
      br.is_used,
      br.amount,
      br.status,
      ba.nick_name,
      "Merchant".code AS merchant_code,
      v.code AS vendor_code
      FROM "BankResponse" AS br
      JOIN "BankAccount" AS ba 
      ON br.bank_id = ba.id
      LEFT JOIN "Vendor" AS v
      ON ba.user_id = v.user_id
      LEFT JOIN "Payin"
      ON br.id = "Payin".bank_response_id
      LEFT JOIN "Merchant"
      ON "Payin".merchant_id = "Merchant".id
      WHERE ba.user_id = ANY($1)
      `;

      values = [userIdsArray];
      let paramIndex = 2;
      if (start && end) {
        baseQueryVendor += ` AND br.created_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
        values.push(start, end);
        paramIndex += 2;
      }
      if (filters.is_used) {
        const isUsedValues = filters.is_used
          .split(',')
          .map((val) => val === 'true');

        if (isUsedValues.length === 1) {
          baseQueryVendor += ` AND br.is_used = $${paramIndex}`;
          values.push(isUsedValues[0]);
          paramIndex++;
        } else {
          const placeholders = isUsedValues
            .map((_, i) => `$${paramIndex + i}`)
            .join(', ');
          baseQueryVendor += ` AND br.is_used IN (${placeholders})`;
          values.push(...isUsedValues);
          paramIndex += isUsedValues.length;
        }
      }

      if (filters.status) {
        const statuses = filters.status.split(',').filter(Boolean);
        if (statuses.length === 1) {
          baseQueryVendor += ` AND br.status = $${paramIndex}`;
          values.push(statuses[0]);
          paramIndex++;
        } else {
          const placeholders = statuses
            .map((_, i) => `$${paramIndex + i}`)
            .join(', ');
          baseQueryVendor += ` AND br.status IN (${placeholders})`;
          values.push(...statuses);
          paramIndex += statuses.length;
        }
      } else {
        baseQueryVendor += ` AND br.status IN ('/success', '/freezed', '/internalTransfer')`;
      }
    }

    if (filters.search) {
      const searchValue = filters.search.trim();
      filters.or = {
        reference_id: searchValue,
        status: searchValue,
      };
      delete filters.search;
    }

    whereConditions.push(`"BankResponse".is_obsolete = false`);

    if (filters.bank_id) {
      if (Array.isArray(filters.bank_id)) {
        const bankIds = filters.bank_id.map((id) => `'${id}'`).join(',');
        whereConditions.push(`"BankResponse"."bank_id" IN (${bankIds})`);
      } else {
        whereConditions.push(`"BankResponse"."bank_id" = '${filters.bank_id}'`);
      }
    }

    if (filters.company_id) {
      whereConditions.push(
        `"BankResponse"."company_id" = '${filters.company_id}'`,
      );
    }

    if (filters.status) {
      filters.status = filters.status.split(',');
    }

    if (whereConditions.length) {
      baseQuery += ' WHERE ' + whereConditions.join(' AND ');
      baseQueryDate += ' WHERE ' + whereConditions.join(' AND ');
    }
    const queryIs =
      start && end && bankDetails && bankDetails[0]?.config?.merchant_added
        ? baseQueryDate
        : baseQuery;

    // const validSortColumns = [
    //   'created_at',
    //   'updated_at',
    //   'id',
    //   'bank_id',
    //   'company_id',
    //   'status',
    //   'amount',
    //   'sno',
    // ];
    // const safeSortBy = validSortColumns.includes(sortBy)
    //   ? sortBy
    //   : 'created_at';
    // const safeSortOrder = sortOrder && sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    let result;
    if (filters.userId && filters.userId.length > 0) {
      result = await executeQuery(baseQueryVendor, values);
    } else {
      let [query, finalQueryValues] = buildSelectQuery(
        queryIs,
        filters,
        page,
        pageSize,
        sortBy,
        sortOrder,
        'BankResponse',
      );
      // --- Use sno for DISTINCT ON and order ---
      query = query.replace(
        /ORDER BY[\s\S]+?(?=LIMIT|OFFSET|$)/i,
        `ORDER BY "BankResponse"."sno" DESC`,
      );
      result = await executeQuery(query, finalQueryValues);
    }
    return { totalCount: result.rows.length, rows: result.rows };
  } catch (error) {
    logger.error('Error getting Bank Response:', error);
    throw error;
  }
};

const getBankResponseByUTR = async (utr) => {
  try {
    const baseQuery = `SELECT 
        br.id, 
        br.sno, 
        br.status, 
        br.bank_id, 
        br.amount, 
        br.upi_short_code, 
        br.utr, 
        br.is_used, 
        br.created_at, 
        br.updated_at, 
        br.created_by, 
        br.config, 
        br.updated_by, 
        "BankAccount".user_id, 
        "BankAccount".nick_name, 
        "BankAccount".bank_name, 
        "Vendor".code 
    FROM 
        "BankResponse" AS br 
    JOIN 
        "BankAccount" ON br.bank_id = "BankAccount".id 
    LEFT JOIN 
        "Vendor" ON "BankAccount".user_id = "Vendor".user_id 
    WHERE 
        1=1 
        AND br.is_obsolete = false 
        AND br.status = '/success'
        AND br.utr = $1 
    ORDER BY 
        br.created_at DESC`;
    const queryParams = [utr];
    const result = await executeQuery(baseQuery, queryParams);
    return result.rows[0];
  } catch (error) {
    logger.error('Error getting Bank Response by utr', error);
    throw error;
  }
};

const getInternalBankResponseByUTR = async (utr) => {
  try {
    const baseQuery = `SELECT 
        br.id, 
        br.sno, 
        br.status, 
        br.bank_id, 
        br.amount, 
        br.upi_short_code, 
        br.utr, 
        br.is_used, 
        br.created_at, 
        br.updated_at, 
        br.created_by, 
        br.config, 
        br.updated_by, 
        "BankAccount".user_id, 
        "BankAccount".nick_name, 
        "BankAccount".bank_name, 
        "Vendor".code 
    FROM 
        "BankResponse" AS br 
    JOIN 
        "BankAccount" ON br.bank_id = "BankAccount".id 
    LEFT JOIN 
        "Vendor" ON "BankAccount".user_id = "Vendor".user_id 
    WHERE 
        1=1 
        AND br.is_obsolete = false 
        AND br.status = '/internalTransfer'
        AND br.utr = $1 
    ORDER BY 
        br.created_at DESC`;
    const queryParams = [utr];
    const result = await executeQuery(baseQuery, queryParams);
    return result.rows[0];
  } catch (error) {
    logger.error('Error getting Bank Response by utr', error);
    throw error;
  }
};

const createBankResponseDao = async (data, conn) => {
  try {
    // data.id = generateUUID();
    const [sql, params] = buildInsertQuery(tableName.BANK_RESPONSE, data);
    const result = await conn.query(sql, params);
    const insertedEntry = result.rows[0];
    // const nickName = await getBankAccountNickNameForEsDao(
    //   insertedEntry.bank_id,
    // );
    // insertedEntry.nick_name = nickName.nick_name;
    // await createBankResponseInES(insertedEntry);
    return insertedEntry;
  } catch (error) {
    logger.error('Error in createBankResponseDao:', error);
    throw error;
  }
};

export const updateBankResponseDao = async (id, data, conn = null) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.BANK_RESPONSE, data, id);
    const result = conn 
      ? await conn.query(sql, params)
      : await executeQuery(sql, params);
    // let insertedEntry = {
    //   ...data,
    //   updated_at: result.rows[0].updated_at,
    // };
    // if (data.bank_id) {
    //   const nickName = await getBankAccountNickNameForEsDao(data.bank_id);
    //   insertedEntry = {
    //     ...insertedEntry,
    //     nick_name: nickName.nick_name,
    //   }
    // }
    // await updateBankResponseInES(result.rows[0].id, insertedEntry);
    // await newTableEntry(tableName.BANK_RESPONSE);
    return result.rows[0];
  } catch (error) {
    logger.error('Error in updateBankResponseDao:', error);
    throw error;
  }
};

const getBankMessageDao = async (
  bank_id,
  startDate,
  endDate,
  company_id,
  // page,
  // pageSize,
  // sortBy,
  // sortOrder
  conn = null,
) => {
  try {
    const query = `SELECT * FROM "BankResponse" 
      WHERE 1=1 
      AND "bank_id" = $1 
      AND is_obsolete = false 
      AND "created_at" BETWEEN $2 AND $3 
      AND "company_id" = $6
      ORDER BY "created_at" DESC 
      LIMIT $4 OFFSET $5`;
    const values = [bank_id, startDate, endDate, 10, 0, company_id];
    const result = conn ? await conn.query(query, values) : await executeQuery(query, values, conn);
    return result.rows;
  } catch (error) {
    logger.error('Error in getBankMessageDao:', error);
    throw error;
  }
};

const resetBankResponseDao = async (id, data, conn = null) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.BANK_RESPONSE, data, {
      id,
    });
    const result = conn
      ? await conn.query(sql, params)
      : await executeQuery(sql, params);
    // let insertedEntry = {
    //   ...data,
    //   updated_at: result.rows[0].updated_at,
    // };
    // if (data.bank_id) {
    //   const nickName = await getBankAccountNickNameForEsDao(
    //     data.bank_id
    //   );
    //   insertedEntry = {
    //     ...insertedEntry,
    //     nick_name: nickName.nick_name,
    //   };
    // }
    // await updateBankResponseInES(result.rows[0].id, insertedEntry);
    return result.rows[0];
  } catch (error) {
    logger.error('Error in resetBankResponseDao:', error);
    throw error;
  }
};

const updateBotResponseDao = async (id, data, conn = null) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.BANK_RESPONSE, data, {
      id,
    });
    const result = conn
      ? await conn.query(sql, params)
      : await executeQuery(sql, params);
    // await newTableEntry(tableName.BANK_RESPONSE);
    // let insertedEntry = {
    //   ...data,
    //   updated_at: result.rows[0].updated_at,
    // };
    // if (data.bank_id) {
    //   const nickName = await getBankAccountNickNameForEsDao(data.bank_id);
    //   insertedEntry = {
    //     ...insertedEntry,
    //     nick_name: nickName.nick_name,
    //   };
    // }
    // await updateBankResponseInES(result.rows[0].id, insertedEntry);
    return result.rows[0];
  } catch (error) {
    logger.error('Error in updateBotResponseDao:', error);
    throw error;
  }
};

export {
  getBankResponseDao,
  getBankResponseByJustUTRDao,
  getClaimResponseDao,
  getInternalBankResponseByUTR,
  createBankResponseDao,
  getBankResponseDaoAll,
  getBankResponseByUTR,
  getBankResponseBySearchDao,
  getBankMessageDao,
  resetBankResponseDao,
  updateBotResponseDao,
  getBankResponsesforFreeze,
  getBankResponseForEsDao,
};
