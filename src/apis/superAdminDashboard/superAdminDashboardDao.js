import { executeQuery } from '../../utils/db.js';
import { tableName } from '../../constants/index.js';
import { logger } from '../../utils/logger.js';

/**
 * Sanitises a date string and returns a safe YYYY-MM-DD value for SQL.
 * Rejects anything that doesn't match the expected pattern to prevent
 * SQL injection via malformed date inputs (defence-in-depth on top of
 * Joi validation in the request schema).
 *
 * @param {string} dateStr – raw date string (expected: YYYY-MM-DD)
 * @returns {string}       – clean YYYY-MM-DD string
 * @throws {Error}         if the value is not a valid date
 */
const sanitizeDateString = (dateStr) => {
  if (!dateStr) return null;
  const match = String(dateStr).trim().match(/^(\d{4}-\d{2}-\d{2})$/);
  if (!match) {
    throw new Error(`Invalid date format: expected YYYY-MM-DD, got "${dateStr}"`);
  }
  const d = new Date(match[1]);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid date value: "${dateStr}"`);
  }
  return match[1];
};

/**
 * Builds the WHERE clause and parameter array for a date range filter.
 * Dates are fully parameterised ($N placeholders) for SQL-injection safety.
 *
 * @param {{ startDate?: string, endDate?: string }} dates
 * @returns {{ conditions: string[], params: string[], nextIndex: number }}
 */
const buildDateConditions = ({ startDate, endDate } = {}) => {
  const conditions = ['is_obsolete = false'];
  const params = [];
  let nextIndex = 1;

  if (startDate) {
    conditions.push(`"created_at" >= $${nextIndex++}`);
    params.push(sanitizeDateString(startDate));
  }
  if (endDate) {
    conditions.push(`"created_at" <= $${nextIndex++}`);
    params.push(sanitizeDateString(endDate));
  }

  return { conditions, params, nextIndex };
};

/**
 * Platform Overview — counts of all key entities.
 */
export const getPlatformOverviewDao = async (conn = null) => {
  try {
    const sql = `
      SELECT
        (SELECT COUNT(*) FROM "${tableName.COMPANY}"    WHERE is_obsolete IS NOT TRUE) AS total_companies,
        (SELECT COUNT(*) FROM "${tableName.MERCHANT}"   WHERE is_obsolete IS NOT TRUE) AS total_merchants,
        (SELECT COUNT(*) FROM "${tableName.VENDOR}"     WHERE is_obsolete IS NOT TRUE) AS total_vendors,
        (SELECT COUNT(*) FROM "${tableName.USER}"       WHERE is_obsolete IS NOT TRUE) AS total_users,
        (SELECT COUNT(*) FROM "${tableName.BANK_ACCOUNT}" WHERE is_obsolete IS NOT TRUE) AS total_bank_accounts
    `;
    const result = await executeQuery(sql, [], conn);
    return result.rows[0] || {};
  } catch (error) {
    logger.error('Error in getPlatformOverviewDao:', error);
    throw error;
  }
};

/**
 * Transaction Summary — aggregated PayIn / PayOut from Calculation table.
 *
 * Aggregate-only SELECTs (no GROUP BY) are incompatible with ORDER BY on
 * non-aggregated columns in PostgreSQL, so we build the query manually
 * using parameterised placeholders for SQL-injection safety.
 */
export const getTransactionSummaryDao = async (
  { startDate, endDate } = {},
  conn = null,
) => {
  try {
    const { conditions, params } = buildDateConditions({ startDate, endDate });

    const sql = `
      SELECT
        COALESCE(SUM(total_payin_count), 0)   AS total_payin_count,
        COALESCE(SUM(total_payin_amount), 0)  AS total_payin_amount,
        COALESCE(SUM(total_payout_count), 0)  AS total_payout_count,
        COALESCE(SUM(total_payout_amount), 0) AS total_payout_amount
      FROM "${tableName.CALCULATION}"
      WHERE ${conditions.join(' AND ')}`;

    const result = await executeQuery(sql, params, conn);
    return result.rows[0] || {};
  } catch (error) {
    logger.error('Error in getTransactionSummaryDao:', error);
    throw error;
  }
};

/**
 * Revenue Summary — total commissions from Calculation table.
 *
 * Same pattern as getTransactionSummaryDao — aggregate SELECT with
 * parameterised WHERE conditions.
 */
export const getRevenueSummaryDao = async (
  { startDate, endDate } = {},
  conn = null,
) => {
  try {
    const { conditions, params } = buildDateConditions({ startDate, endDate });

    const sql = `
      SELECT
        COALESCE(SUM(total_payin_commission), 0)   AS total_payin_commission,
        COALESCE(SUM(total_payout_commission), 0)  AS total_payout_commission,
        COALESCE(SUM(total_payin_commission), 0)
          + COALESCE(SUM(total_payout_commission), 0) AS total_revenue
      FROM "${tableName.CALCULATION}"
      WHERE ${conditions.join(' AND ')}`;

    const result = await executeQuery(sql, params, conn);
    return result.rows[0] || {};
  } catch (error) {
    logger.error('Error in getRevenueSummaryDao:', error);
    throw error;
  }
};

/**
 * Transaction Status Breakdown — counts from Payin grouped by status.
 *
 * Needs GROUP BY + its own ORDER BY (count DESC), so we build the
 * query manually with parameterised date conditions.
 */
export const getTransactionStatusBreakdownDao = async (
  { startDate, endDate } = {},
  conn = null,
) => {
  try {
    const { conditions, params } = buildDateConditions({ startDate, endDate });

    const sql = `
      SELECT
        status,
        COUNT(*) AS count,
        COALESCE(SUM(amount), 0) AS total_amount
      FROM "${tableName.PAYIN}"
      WHERE ${conditions.join(' AND ')}
      GROUP BY status
      ORDER BY count DESC`;

    const result = await executeQuery(sql, params, conn);
    return result.rows || [];
  } catch (error) {
    logger.error('Error in getTransactionStatusBreakdownDao:', error);
    throw error;
  }
};
