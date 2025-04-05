import { tableName } from '../../constants/index.js';
import {
  buildInsertQuery,
  buildJoinQuery,
  buildSelectQuery,
  buildUpdateQuery,
  executeQuery,
} from '../../utils/db.js';
import { logger } from '../../utils/logger.js';
// import {
//   buildSearchFilterObj
// } from '../../utils/searchBuilder.js';

const getCheckUtrDao = async (filters,
  page,
  pageSize,
  sortBy,
  sortOrder,
  // columns to select from db (optional)
  columns = [],
) => {
  try {
    const { BANK_RESPONSE, CHECK_UTR_HISTORY, PAYIN } = tableName;
    const joins = [
      {
        table: PAYIN,
        // first is source key
        // second is target key
        keys: ['payin_id', 'id'],
        type: 'JOIN',
        columns: ['merchant_order_id', 'amount', 'user_submitted_utr'],
        columnAs: [`"${PAYIN}".amount as requested_amount`],
      },
      {
        table: BANK_RESPONSE,
        // first is source key
        // second is target key
        keys: [`bank_acc_id`, 'bank_id'],
        columns: ['status', 'utr', 'amount', 'is_used', 'upi_short_code'],
        type: 'LEFT JOIN',
        referenceTable: PAYIN,
      },
    ];

    let baseQuery = buildJoinQuery(  // this will create a query with the joins
      CHECK_UTR_HISTORY,
      columns?.length ? columns : '*',
      joins,
    );

    const [sql, queryParams] = buildSelectQuery(
      baseQuery,
      filters,
      page,
      pageSize,
      sortBy,
      sortOrder,
      tableName.CHECK_UTR_HISTORY,
    );
    const result = await executeQuery(sql, queryParams);
    return { totalCount: result.rowCount, checkutr: result.rows };
  } catch (error) {
    logger.error('Error getting all CheckUtr:', error);
    throw error.message;
  }
};

const getCheckUtrBySearchDao = async (company_id, searchTerms, limitNum, offset) => {
  try {
    const conditions = [];
    const values = [company_id];
    let paramIndex = 2;
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

const createCheckUtrDao = async (payload) => {
  try {
    const [sql, params] = buildInsertQuery(tableName.CHECK_UTR_HISTORY, payload);
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    logger.error('Error creating CheckUtr:', error);
    throw error; // Rethrow the error to propagate it
  }
};

const updateCheckUtrDao = async (id, data) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.CHECK_UTR_HISTORY, data, { id });
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    logger.error('Error updating CheckUtr:', error);
    throw error; // Rethrow the error to propagate it
  }
};

const deleteCheckUtrDao = async (id, data) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.CHECK_UTR_HISTORY, data, { id });
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    logger.error('Error deleting CheckUtr:', error);
    throw error; // Rethrow the error to propagate it
  }
};

export {
  getCheckUtrDao,
  getCheckUtrBySearchDao,
  createCheckUtrDao,
  updateCheckUtrDao,
  deleteCheckUtrDao,
};
