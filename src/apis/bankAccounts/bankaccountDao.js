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
    console.error('Error in getBankaccountDao:', error);
    throw error.message;
  }
};

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
  createBankaccountDao,
  updateBankaccountDao,
  deleteBankaccountDao,
  getMerchantBankDao,
  getBankaccountDaoNickName,
};
