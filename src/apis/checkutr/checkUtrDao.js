import { tableName } from '../../constants/index.js';
import {
  buildInsertQuery,
  buildJoinQuery,
  buildSelectQuery,
  buildUpdateQuery,
  executeQuery,
} from '../../utils/db.js';
import { buildSearchFilterObj } from '../../utils/searchBuilder.js';
// const tableName = 'CheckUtr';

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

    const baseQuery = buildJoinQuery(
      CHECK_UTR_HISTORY,
      columns?.length ? columns : '*',
      joins,
    );
    if (filters.search) {
      filters.or = buildSearchFilterObj(filters.search, CHECK_UTR_HISTORY);
      delete filters.search;
    }

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
    console.error('Error getting CheckUtr:', error); // Log the error for debugging
    throw error; // Rethrow the error to propagate it
  }
};

const createCheckUtrDao = async (payload) => {
  try {
    const [sql, params] = buildInsertQuery(tableName.CHECK_UTR_HISTORY, payload);
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    console.error('Error creating CheckUtr:', error); // Log the error for debugging
    throw error; // Rethrow the error to propagate it
  }
};

const updateCheckUtrDao = async (id, data) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.CHECK_UTR_HISTORY, data, { id });
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    console.error('Error updating CheckUtr:', error); // Log the error for debugging
    throw error; // Rethrow the error to propagate it
  }
};

const deleteCheckUtrDao = async (id, data) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.CHECK_UTR_HISTORY, data, { id });
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    console.error('Error deleting CheckUtr:', error); // Log the error for debugging
    throw error; // Rethrow the error to propagate it
  }
};

export {
  getCheckUtrDao,
  createCheckUtrDao,
  updateCheckUtrDao,
  deleteCheckUtrDao,
};
