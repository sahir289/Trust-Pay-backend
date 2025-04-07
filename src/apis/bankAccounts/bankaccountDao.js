import { tableName } from '../../constants/index.js';

import {
  buildInsertQuery,
  buildSelectQuery,
  buildUpdateQuery,
  buildAndExecuteUpdateQuery,
  executeQuery,
} from '../../utils/db.js';
import { DbError } from '../../utils/appErrors.js';
import { buildSearchFilterObj } from '../../utils/searchBuilder.js';
import { logger } from '../../utils/logger.js';

const getBankaccountDao = async (filters, page, limit, role) => {
  try {
    const { BANK_ACCOUNT } = tableName;
    let queryParams = [];
    let conditions = [`ba.is_obsolete = false`];
    if (filters.company_id) {
      queryParams.push(filters.company_id);
      conditions.push(`ba.company_id = $1`);
    }
    let limitcondition = '';

    if (page && limit) {
      limitcondition = `LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
      queryParams.push(limit, (page - 1) * limit);
    }
    if (filters.search) {
      filters.or = buildSearchFilterObj(filters.search, BANK_ACCOUNT);
      delete filters.search;
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
      conditions.push(
        `ba.bank_used_for = $${queryParams.length + 1}`,
      );
      queryParams.push(filters?.bank_used_for);
      // delete filters.bank_used_for
    }
    // if (filters && Object.keys(filters).length > 0) {
    //   Object.keys(filters).forEach((key) => {
    //     delete filters?.page;
    //     delete filters?.limit;
    //     const value = filters[key];
    //     if (value !== null && value !== undefined && value !== '') {
    //       if (Array.isArray(value)) {
    //         conditions.push(`ba."${key}" = ANY($${queryParams.length + 1})`);
    //         queryParams.push(value);
    //       } else {
    //         conditions.push(`ba."${key}" = $${queryParams.length + 1}`);
    //         queryParams.push(value);
    //       }
    //     }
    //   });
    // }
    let commissionSelect = '';
    if (role === 'MERCHANT') {
      commissionSelect = '';
    } else if (role === 'VENDOR') {
      commissionSelect =
        'ifsc_code, ba.payin_count, ba.balance, ba.today_balance, ba.bank_used_for, ';
    } else {
      commissionSelect = `
        ba.user_id, ba.ifsc, ba.min, 
        ba.max, ba.payin_count, ba.balance, ba.today_balance, ba.bank_used_for, ba.created_by, 
        ba.updated_by, ba.created_at, ba.updated_at
      `;
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
        ba.is_bank, 
        ba.is_enabled, 
        ba.config,  
        ${commissionSelect},
        v.code AS Vendor, 
        COALESCE(m.merchant_details, '[]'::jsonb) AS Merchant_Details
      FROM 
          public."BankAccount" ba
      LEFT JOIN public."Vendor" v 
          ON ba.user_id = v.user_id
      LEFT JOIN LATERAL (
          SELECT 
              jsonb_agg(jsonb_build_object('id', m.id, 'code', m.code)) AS merchant_details
          FROM public."Merchant" m
          WHERE m.id::text IN (
                    SELECT jsonb_array_elements_text((ba.config->'merchants')::jsonb)
          )
      ) m ON TRUE
      WHERE 
          ${conditions.join(' AND ')}
      ORDER BY 
          ba.is_enabled DESC,  
          ba.updated_at DESC  
      ${limitcondition};
      `;
    const result = await executeQuery(baseQuery, queryParams);
    return result.rows;
  } catch (error) {
    logger.error('Error in get BankAccount Dao:', error);
    throw error.message;
  }
};

const getBankAccountBySearchDao = async (company_id, role, searchTerms, limitNum, offset) => {
  try {
    const conditions = [];
    const values = [company_id, role];
    let paramIndex = 3;
    let queryText = `
      SELECT 
        "CheckUtrHistory".*, 
        "Payin".merchant_order_id, 
        "Payin".amount, 
        "Payin".user_submitted_utr, 
        "Payin".amount as requested_amount, 
        "BankResponse".status, 
        "BankResponse".utr, 
        "BankResponse".amount, 
        "BankResponse".is_used, 
        "BankResponse".upi_short_code 
      FROM "CheckUtrHistory" 
      JOIN "Payin" ON "CheckUtrHistory".payin_id = "Payin".id 
      LEFT JOIN "BankResponse" ON "Payin".bank_acc_id = "BankResponse".bank_id 
      WHERE 1=1 
      AND "CheckUtrHistory".is_obsolete = false 
      AND "CheckUtrHistory"."company_id" = $1
    `;

    searchTerms.forEach(term => {
      // here it will handle boolean terms separately
      if (term.toLowerCase() === 'true' || term.toLowerCase() === 'false') {
        const boolValue = term.toLowerCase() === 'true';
        conditions.push(`
          (
            "CheckUtrHistory"."is_obsolete" = $${paramIndex}
            OR "BankResponse".is_used = $${paramIndex}
          )
        `);
        values.push(boolValue);
        paramIndex++;
      } else {
        // it will handle text/numeric terms
        conditions.push(`
          (
            LOWER("CheckUtrHistory"."id"::text) LIKE LOWER($${paramIndex})
            OR LOWER("Payin".merchant_order_id) LIKE LOWER($${paramIndex})
            OR LOWER("Payin".user_submitted_utr) LIKE LOWER($${paramIndex})
            OR LOWER("BankResponse".status) LIKE LOWER($${paramIndex})
            OR LOWER("BankResponse".utr) LIKE LOWER($${paramIndex})
            OR LOWER("BankResponse".upi_short_code) LIKE LOWER($${paramIndex})
            OR "Payin".amount::text LIKE $${paramIndex}
            OR "BankResponse".amount::text LIKE $${paramIndex}
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
      ORDER BY "CheckUtrHistory"."created_at" DESC
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
      checkUtr: searchResult.rows,
    };
    return data;
    
  } catch (error) {
    logger.error(error);
    throw error.message;
  }
}

const getMerchantBankDao = async (filters) => {
  try {
    const query = `SELECT * FROM  "${tableName.BANK_ACCOUNT}" WHERE 1=1`;
    const [sql, parameters] = buildSelectQuery(query, filters);
    const result = await executeQuery(sql, parameters);
    return result.rows;
  } catch (error) {
    console.error(error);
    throw error.message;
  }
};

const createBankaccountDao = async (payload) => {
  try {
    const [sql, params] = buildInsertQuery(tableName.BANK_ACCOUNT, payload);
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    console.error(error);
    throw error.message;
  }
};

const getBankaccountDaoNickName = async (conn, company_id, type) => {
  const baseQuery = `SELECT nick_name as label, id as value FROM "${tableName.BANK_ACCOUNT}" WHERE company_id = $1 AND bank_used_for= $2 AND is_obsolete = false`;
  const queryParams = [company_id, type];
  const result = await conn.query(baseQuery, queryParams);
  return { totalCount: result.rowCount, bankNames: result.rows };
};

const updateBankaccountDao = async (id, payload, conn) => {
  try {
    // Handle nested JSON updates for the `config` column
    if (payload.config && typeof payload.config === 'object') {
      const configUpdates = payload.config;
      delete payload.config; // Remove `config` from the main payload

      // Merge the new `config` data into the existing JSON structure
      payload.config = {
        ...configUpdates,
      };
    }

    // Use buildAndExecuteUpdateQuery to update the bank account
    return await buildAndExecuteUpdateQuery(
      tableName.BANK_ACCOUNT,
      payload,
      id,
      {}, // No special fields
      { returnUpdated: true }, // Return the updated row
      conn, // Use the provided connection
    );
  } catch (error) {
    console.error('Error in updateBankaccountDao:', error);
    throw error.message;
  }
};

const deleteBankaccountDao = async (conn, id, data) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.BANK_ACCOUNT, data, id);
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
      tableName.BANK_ACCOUNT,
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
    console.error(error);
    throw error.message;
  }
};

export {
  getBankaccountDao,
  getBankAccountBySearchDao,
  createBankaccountDao,
  updateBankaccountDao,
  deleteBankaccountDao,
  getMerchantBankDao,
  getBankaccountDaoNickName,
};
