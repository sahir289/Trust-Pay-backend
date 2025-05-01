import { tableName } from '../../constants/index.js';
import { InternalServerError } from '../../utils/appErrors.js';
// import { generateUUID } from '../utils/generateUUID.js';

import {
  executeQuery,
  buildSelectQuery,
  buildInsertQuery,
  buildUpdateQuery,
  buildJoinQuery,
} from '../../utils/db.js';
import { generateUUID } from '../../utils/generateUUID.js';
import { logger } from '../../utils/logger.js';
import { buildSearchFilterObj } from '../../utils/searchBuilder.js';

const getBankResponseDao = async (
  filters,
  startDate =new Date(),
  endDate = new Date(),
  page = 0,
  pageSize = 10,
  // sortBy,
  // sortOrder,
  columns = [],
) => {
  try {
    let baseQuery = `SELECT ${columns.length ? columns.join(', ') : '*'} FROM "${tableName.BANK_RESPONSE}" WHERE 1=1`;
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
      pageSize
    );
    if (startDate && endDate) {
      baseQuery += ` AND created_at BETWEEN $${Object.keys(queryParams).length + 1} AND $${Object.keys(queryParams).length + 2}`;
      queryParams[`created_at_start`] = startDate;
      queryParams[`created_at_end`] = endDate;
    }
    const result = await executeQuery(sql, queryParams);
    return result.rows[0];
  } catch {
    throw new InternalServerError('Error executing query');
  }
};

const getBankResponseBySearchDao = async (
  company_id,
  searchTerm,
  limitNum,
  offset,
) => {
  try {
    const conditions = [];
    const values = [company_id];
    let paramIndex = 2;

    let queryText = `
      SELECT 
        br.id,
        br.status,
        br.bank_id,
        br.amount,
        br.upi_short_code,
        br.utr,
        br.sno,
        br.is_used,
        br.created_at,
        br.updated_at,
        br.created_by,
        br.config,
        br.updated_by,
        ba.user_id ,
        ba.nick_name,
        ba.bank_name,
        v.code 
      FROM public."BankResponse" br 
      JOIN public."BankAccount" ba ON br.bank_id = ba.id
      LEFT JOIN public."Vendor" v ON ba.user_id = v.user_id
      WHERE br.is_obsolete = false
      AND br.company_id = $1  
    `;

    searchTerm.forEach((term) => {
      if (term.toLowerCase() === 'true' || term.toLowerCase() === 'false') {
        const boolValue = term.toLowerCase() === 'true';
        conditions.push(`br.is_used = $${paramIndex}`);
        values.push(boolValue);
        paramIndex++;
      } else {
        conditions.push(`
          (
            LOWER(br.id::text) LIKE LOWER($${paramIndex})
            OR LOWER(br.status) LIKE LOWER($${paramIndex})
            OR LOWER(br.bank_id::text) LIKE LOWER($${paramIndex})
            OR LOWER(br.amount::text) LIKE LOWER($${paramIndex})
            OR LOWER(br.upi_short_code) LIKE LOWER($${paramIndex})
            OR LOWER(br.utr) LIKE LOWER($${paramIndex})
            OR LOWER(br.is_used::text) LIKE LOWER($${paramIndex})
            OR LOWER(br.created_at::text) LIKE LOWER($${paramIndex})
            OR LOWER(br.updated_at::text) LIKE LOWER($${paramIndex})
            OR LOWER(br.created_by) LIKE LOWER($${paramIndex})
            OR LOWER(br.config->>'from_UI') LIKE LOWER($${paramIndex})
            OR LOWER(br.updated_by) LIKE LOWER($${paramIndex})
            OR LOWER(ba.user_id::text) LIKE LOWER($${paramIndex})
            OR LOWER(ba.nick_name) LIKE LOWER($${paramIndex})
            OR LOWER(v.code) LIKE LOWER($${paramIndex})
          )
        `);
        values.push(`%${term}%`);
        paramIndex++;
      }
    });

    if (conditions.length > 0) {
      queryText += ' AND (' + conditions.join(' OR ') + ')';
    }

    const countQuery = `SELECT COUNT(*) as total FROM (${queryText}) as count_table`;

    queryText += `
      ORDER BY br.created_at DESC
      LIMIT $${values.length + 1}
      OFFSET $${values.length + 2}
    `;
    values.push(limitNum, offset);

    const countResult = await executeQuery(countQuery, values.slice(0, -2));
    const searchResult = await executeQuery(queryText, values);

    const totalItems = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(totalItems / limitNum);

    const data = {
      totalCount: totalItems,
      totalPages,
      bankResponses: searchResult.rows,
    };
    return data;
  } catch (error) {
    logger.error('Error in getBankResponseBySearchDao:', error);
    throw new Error('Error executing query');
  }
};
const getBankResponseDaoAll = async (
  filters,
  page = 1,
  pageSize = 10,
  sortBy = 'created_at',
  sortOrder = 'DESC',
  columns = [],
) => {
  try {
    //changed to raw query , as build join function doesnt accept alias 
    const values = [];
    const offset = (page - 1) * pageSize;

    const selectCols = columns.length
      ? columns.map(col => `"BankResponse".${col}`).join(', ')
      : [
          `"BankResponse".*`,
          `"BankAccount".user_id`,
          `"BankAccount".nick_name`,
          `"BankAccount".bank_name`,
          `"Vendor".code`,
          `u.user_name AS createdby_username`,
          `uu.user_name AS updatedby_username`
        ].join(', ');

    const whereClauses = [`"BankResponse".is_obsolete = false`];

    if (filters.search) {
      const orConditions = [];
      const searchValue = filters.search.trim();
      values.push(searchValue);
      orConditions.push(`"BankResponse"."reference_id" = $${values.length}`);
      orConditions.push(`"BankResponse"."status" = $${values.length}`);
      whereClauses.push(`(${orConditions.join(' OR ')})`);
    }

    for (const key in filters) {
      if (key === 'search' || key === 'startDate' || key === 'endDate') continue;
      values.push(filters[key]);
      whereClauses.push(`"BankResponse"."${key}" = $${values.length}`);
    }

    if (filters.startDate && filters.endDate) {
      values.push(filters.startDate);
      values.push(filters.endDate);
      whereClauses.push(`"BankResponse".created_at BETWEEN $${values.length - 1} AND $${values.length}`);
    }

    const where = `WHERE ${whereClauses.join(' AND ')}`;

    const sql = `
      SELECT ${selectCols}
      FROM "BankResponse"
      JOIN "BankAccount" ON "BankResponse".bank_id = "BankAccount".id
      LEFT JOIN "Vendor" ON "BankAccount".user_id = "Vendor".user_id
      LEFT JOIN public."User" u ON "BankResponse".created_by = u.id 
      LEFT JOIN public."User" uu ON "BankResponse".updated_by = uu.id
      ${where}
      ORDER BY "BankResponse"."${sortBy}" ${sortOrder === 'ASC' ? 'ASC' : 'DESC'}
      LIMIT $${values.length + 1}
      OFFSET $${values.length + 2}
    `;

    values.push(pageSize, offset);

    const result = await executeQuery(sql, values);
    return { totalCount: result.rows.length, rows: result.rows };
  } catch (error) {
    logger.error('Error getting Bank Response:', error);
    throw error.message;
  }
};

const getBankResponseByUTR = async (
  company_id,
  utr,
) => {
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
        AND br.company_id = $1 
        AND br.utr = $2 
    ORDER BY 
        br.created_at DESC`;
    const queryParams = [company_id, utr];
    const result = await executeQuery(baseQuery, queryParams);
    return result.rows[0];
  } catch(error) {
    logger.error('Error getting Bank Response by utr', error);
    throw error.message;
  }
};


const createBankResponseDao = async (conn, data) => {
  try {
    data.id = generateUUID();

    const [sql, params] = buildInsertQuery(tableName.BANK_RESPONSE, data);
    let result;
    if (conn && conn.query) {
      result = await conn.query(sql, params); // Use connection to execute query
    } else {
      result = await executeQuery(sql, params); // Use executeQuery if no connection
    }
    return result.rows[0];
  } catch {
    throw new InternalServerError('Error executing query');
  }
};

export const updateBankResponseDao = async (id, data, conn) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.BANK_RESPONSE, data, id);
    if (conn && conn.query) {
      const result = await conn.query(sql, params);
      return result.rows[0];
    }
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    console.error('Error in updateBankResponseDao:', error);
    throw error.message;
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
    const result = await executeQuery(query, values);
    return result.rows;
  } catch {
    throw new InternalServerError('Error executing query');
  }
};

const resetBankResponseDao = async (id, data) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.BANK_RESPONSE, data, {
      id,
    });
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch {
    throw new InternalServerError('Error executing query');
  }
};

const updateBotResponseDao = async (id, data, conn) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.BANK_RESPONSE, data, {
      id,
    });
    let result;
    
    if (conn && conn.query) {
      result = await conn.query(sql, params); // Use connection to execute query
    } else {
      result = await executeQuery(sql, params); // Use executeQuery if no connection
    }
    return result.rows[0];
  } catch {
    throw new InternalServerError('Error executing query');
  }
};

export {
  getBankResponseDao,
  createBankResponseDao,
  getBankResponseDaoAll,
  getBankResponseByUTR,
  getBankResponseBySearchDao,
  getBankMessageDao,
  resetBankResponseDao,
  updateBotResponseDao,
};
