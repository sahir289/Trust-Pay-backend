import { tableName } from '../../constants/index.js';
import {
  buildInsertQuery,
  buildJoinQuery,
  buildSelectQuery,
  buildUpdateQuery,
  executeQuery,
} from '../../utils/db.js';
import { buildSearchFilterObj } from '../../utils/searchBuilder.js';

const getResetHistoryDao = async (
  filters,
  page,
  pageSize,
  sortBy,
  sortOrder,
  columns = []
) => {
  try {
    const { BANK_RESPONSE, RESET_DATA_HISTORY, PAYIN } = tableName;

    const joins = [
      {
        table: PAYIN,
        keys: ['payin_id', 'id'], 
        type: 'JOIN',
        columns: ['merchant_order_id', 'duration'],
        columnAs: [
          `json_build_object(
             'status', "${PAYIN}".status,
             'user_submitted_utr', "${PAYIN}".user_submitted_utr
          ) AS new_details`
        ],
      },
      {
        table: BANK_RESPONSE,
        keys: ['bank_acc_id', 'bank_id'], 
        columns: ['utr', 'amount'],
        columnAs: [
          `json_build_object(
             'amount', "${BANK_RESPONSE}".amount,
             'utr', "${BANK_RESPONSE}".utr,
             'previous_status', "${RESET_DATA_HISTORY}".pre_status 
          ) AS previous_details`
        ],
        type: 'LEFT JOIN',
        referenceTable: PAYIN,
      },
    ];

    const baseQuery = buildJoinQuery(
      RESET_DATA_HISTORY,
      columns.length ? columns : '*',
      joins
    );
    console.log(baseQuery, 'baseQuery');

    if (filters.search) {
      filters.or = buildSearchFilterObj(filters.search, RESET_DATA_HISTORY);
      delete filters.search;
    }

    const [sql, queryParams] = buildSelectQuery(
      baseQuery,
      filters,
      page,
      pageSize,
      sortBy,
      sortOrder,
      tableName.RESET_DATA_HISTORY
    );

    console.log('Generated SQL:', sql);
    console.log('Query Parameters:', queryParams);

    const result = await executeQuery(sql, queryParams);
    return { totalCount: result.rowCount, resetHistory: result.rows };
  } catch (error) {
    console.error('Error getting CheckUtr:', error);
    throw error;
  }
};

const getResetHistoryBySearchDao = async (
  company_id,
  searchTerms,
  limitNum,
  offset,
) => {
  console.log('getResetHistoryBySearchDao', searchTerms);
  try {
    const conditions = [];
    const values = [company_id];
    let paramIndex = 2;

    // Default columns with table aliases
  

let queryText = `
      SELECT 
        rdh.*,
        p.merchant_order_id,
        p.duration,
        json_build_object(
          'status', p.status,
          'user_submitted_utr', p.user_submitted_utr
        ) AS new_details,
        br.utr,
        br.amount,
        json_build_object(
          'amount', br.amount,
          'utr', br.utr,
          'previous_status', rdh.pre_status
        ) AS previous_details
      FROM public."ResetDataHistory" rdh
      JOIN public."Payin" p ON rdh.payin_id = p.id
      LEFT JOIN LATERAL (
    SELECT utr, amount
    FROM public."BankResponse" 
    WHERE bank_id = p.bank_acc_id
    ORDER BY created_at DESC  
    LIMIT 1
) br ON true
    WHERE rdh.is_obsolete = false
      AND rdh.company_id = $1
    `;

    searchTerms.forEach((term) => {
      if (term.toLowerCase() === 'true' || term.toLowerCase() === 'false') {
        const boolValue = term.toLowerCase() === 'true';
        conditions.push(`rdh.is_obsolete = $${paramIndex}`);
        values.push(boolValue);
        paramIndex++;
      } else {
        conditions.push(`
          (
            LOWER(rdh.id::text) LIKE LOWER($${paramIndex})
            OR LOWER(rdh.sno::text) LIKE LOWER($${paramIndex})
            OR LOWER(rdh.payin_id::text) LIKE LOWER($${paramIndex})
            OR LOWER(rdh.created_by) LIKE LOWER($${paramIndex})
            OR LOWER(rdh.updated_by) LIKE LOWER($${paramIndex})
            OR LOWER(p.merchant_order_id) LIKE LOWER($${paramIndex})
            OR LOWER(p.status) LIKE LOWER($${paramIndex})
            OR LOWER(p.user_submitted_utr) LIKE LOWER($${paramIndex})
            OR LOWER(br.utr) LIKE LOWER($${paramIndex})
            OR LOWER(br.amount::text) LIKE LOWER($${paramIndex})
            OR LOWER(rdh.pre_status) LIKE LOWER($${paramIndex})
            OR LOWER(rdh.config->>'from_UI') LIKE LOWER($${paramIndex})
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
      ORDER BY rdh.created_at DESC
      LIMIT $${values.length + 1}
      OFFSET $${values.length + 2}
    `;
    values.push(limitNum, offset);
    console.log('Query Parameters:', limitNum, offset);
    
    const countResult = await executeQuery(countQuery, values.slice(0, -2));
    const searchResult = await executeQuery(queryText, values);

    const totalItems = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(totalItems / limitNum);

    return {
      totalCount: totalItems,
      totalPages,
      resetHistory: searchResult.rows,
    };
  } catch (error) {
    console.error('Error in getResetHistoryBySearchDao:', error);
    throw new Error('Error executing reset history query');
  }
};
const createResetHistoryDao = async (payload) => {
  try {
    const tableName = 'ResetDataHistory';
    const [sql, params] = buildInsertQuery(tableName, payload);
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    console.error('Error in createResetHistoryDao:', error);
    throw error;
  }
};

const updateResetHistoryDao = async (id, data) => {
  try {
    const tableName = 'ResetHistory';
    const [sql, params] = buildUpdateQuery(tableName, data, { id });
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    console.error('Error in updateResetHistoryDao:', error);
    throw error;
  }
};

const deleteResetHistoryDao = async (id, data) => {
  try {
    const tableName = 'ResetHistory';
    const [sql, params] = buildUpdateQuery(tableName, data, { id });
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    console.error('Error in deleteResetHistoryDao:', error);
    throw error;
  }
};

export {
  getResetHistoryDao,
  createResetHistoryDao,
  updateResetHistoryDao,
  getResetHistoryBySearchDao,
  deleteResetHistoryDao,
};
