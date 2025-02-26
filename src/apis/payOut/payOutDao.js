import { tableName } from '../../constants/index.js';
import {
  buildInsertQuery,
  buildSelectQuery,
  buildUpdateQuery,
  executeQuery,
} from '../../utils/db.js';

export const createPayoutDao = async (data) => {
  try {
    const [sql, params] = buildInsertQuery(tableName.PAYOUT, data);
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    console.error('Error in createPayoutDao:', error);
    throw new Error('Failed to create payout');
  }
};

export const getPayoutsDao = async (
  filters,
  page,
  pageSize,
  sortBy,
  sortOrder,
) => {
  const baseQuery = `SELECT id, user, merchant_id, bank_acc_id, amount, status, failed_reason, currency, merchant_order_id, acc_no, acc_holder_name, ifsc_code, bank_name, upi_id, utr_id, rejected_reason, payout_merchant_commission, payout_vendor_commission, from_bank_acc_id, approved_at, rejected_at FROM "${tableName.PAYOUT}" WHERE 1=1`;
  //TODO: columns.PAYOUT dynamic search
  const [sql, queryParams] = buildSelectQuery(
    baseQuery,
    filters,
    page,
    pageSize,
    sortBy,
    sortOrder
  );
  // Execute query
  const result = await executeQuery(sql, queryParams);
  return result.rows;
};

export const updatePayoutDao = async (ids, data, conn) => {
    try {
      const [sql, params] = buildUpdateQuery(tableName.PAYOUT, data, ids);
      
      let result;
      if (conn && conn.query) {
        result = await conn.query(sql, params);
      } else {
        result = await executeQuery(sql, params);
      }
      
      return result.rows[0];
    } catch (error) {
      console.error("Error occurred while updating payout:", error);
      throw new Error("An error occurred while processing the payout update.");
    }
  };
  

export const deletePayoutDao = async (ids,data) => {
    try {
      const [sql, params] = buildUpdateQuery(tableName.PAYOUT, data, ids);
      const result = await executeQuery(sql, params);
      return result.rows[0];
    } catch (error) {
      console.error("Error occurred while deleting payout:", error);
      throw new Error("An error occurred while processing the payout deletion.");
    }
  };
  