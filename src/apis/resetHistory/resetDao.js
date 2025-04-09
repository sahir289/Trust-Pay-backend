import { tableName } from '../../constants/index.js';
import {
  buildInsertQuery,
  buildUpdateQuery,
  executeQuery,
} from '../../utils/db.js';

const getResetHistoryDao = async (
  filters = {},
  page = 1,
  pageSize = 10,
  sortBy = 'sno',
  sortOrder = 'DESC',
  columns = []
) => {
  try {
    const { BANK_RESPONSE, RESET_DATA_HISTORY, PAYIN } = tableName;

    // Default columns if none provided
    const selectColumns = columns.length
      ? columns.map(col => `"${RESET_DATA_HISTORY}".${col}`).join(', ')
      : `"${RESET_DATA_HISTORY}".*`;

    // Base query with DISTINCT ON (sno)
    let sql = `
    SELECT DISTINCT ON ("${RESET_DATA_HISTORY}".sno)
      ${selectColumns},
      json_build_object(
        'status', "${PAYIN}".status,
        'user_submitted_utr', "${PAYIN}".user_submitted_utr
      ) AS new_details,
      CASE
        WHEN "${PAYIN}".bank_response_id IS NOT NULL THEN
          json_build_object(
            'amount', "${BANK_RESPONSE}".amount,
            'utr', "${BANK_RESPONSE}".utr,
            'previous_status', "${RESET_DATA_HISTORY}".pre_status
          )
        ELSE
          json_build_object(
            'amount', "${PAYIN}".amount,
            'utr', "${PAYIN}".user_submitted_utr,
            'previous_status', "${RESET_DATA_HISTORY}".pre_status
          )
      END AS previous_details,
      "${PAYIN}".merchant_order_id AS merchant_order_id
    FROM "${RESET_DATA_HISTORY}"
    JOIN "${PAYIN}" ON "${RESET_DATA_HISTORY}".payin_id = "${PAYIN}".id
    LEFT JOIN "${BANK_RESPONSE}" ON "${PAYIN}".bank_response_id = "${BANK_RESPONSE}".id
  `;

    // Handle filters
    const whereClauses = [];
    const queryParams = [];
    let paramIndex = 1;

    if (filters.search) {
      // Assuming search applies to a few key fields (e.g., utr, merchant_order_id)
      whereClauses.push(`
        ("${RESET_DATA_HISTORY}".sno::text ILIKE $${paramIndex}
        OR "${PAYIN}".merchant_order_id ILIKE $${paramIndex}
        OR "${BANK_RESPONSE}".utr ILIKE $${paramIndex})
      `);
      queryParams.push(`%${filters.search}%`);
      paramIndex++;
    }

    // Add additional filters (e.g., status, amount)
    for (const [key, value] of Object.entries(filters)) {
      if (key !== 'search' && value !== undefined) {
        whereClauses.push(`"${RESET_DATA_HISTORY}".${key} = $${paramIndex}`);
        queryParams.push(value);
        paramIndex++;
      }
    }

    if (whereClauses.length > 0) {
      sql += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    // Sorting
    const validSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    sql += ` ORDER BY "${RESET_DATA_HISTORY}".${sortBy} ${validSortOrder}`;

    // Pagination
    const offset = (page - 1) * pageSize;
    sql += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(pageSize, offset);
    paramIndex += 2;

    // Execute both queries
    const [result] = await Promise.all([
      executeQuery(sql, queryParams),
    ]);

    return {
      resetHistory: result.rows
    };
  } catch (error) {
    console.error('Error getting CheckUtr:', error);
    throw error;
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
  deleteResetHistoryDao,
};
