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
             'user_submitted_utr', "${PAYIN}".user_submitted_utr,
             'confirmed', "${PAYIN}".confirmed
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
