import { executeQuery } from '../../utils/db.js';
import { tableName } from '../../constants/index.js';
import { logger } from '../../utils/logger.js';
import dayjs from 'dayjs';

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
const buildDateConditions = ({ startDate, endDate, company_id } = {}) => {
  const conditions = ['is_obsolete = false'];
  const params = [];
  let nextIndex = 1;

  if (company_id) {
    conditions.push(`"company_id" = $${nextIndex++}`);
    params.push(company_id);
  }

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
export const getPlatformOverviewDao = async ({ company_id } = {}, conn = null) => {
  try {
    const tenantCondition = company_id ? `AND "company_id" = $1` : '';
    const tenantParams = company_id ? [company_id] : [];

    const sql = `
      SELECT
        ${company_id ? '1' : '(SELECT COUNT(*) FROM "${tableName.COMPANY}"    WHERE is_obsolete IS NOT TRUE)'} AS total_companies,
        (SELECT COUNT(*) FROM "${tableName.MERCHANT}"   WHERE is_obsolete IS NOT TRUE ${tenantCondition}) AS total_merchants,
        (SELECT COUNT(*) FROM "${tableName.VENDOR}"     WHERE is_obsolete IS NOT TRUE ${tenantCondition}) AS total_vendors,
        (SELECT COUNT(*) FROM "${tableName.USER}"       WHERE is_obsolete IS NOT TRUE ${tenantCondition}) AS total_users,
        (SELECT COUNT(*) FROM "${tableName.BANK_ACCOUNT}" WHERE is_obsolete IS NOT TRUE ${tenantCondition}) AS total_bank_accounts
    `;
    const result = await executeQuery(sql, tenantParams, conn);
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
  { startDate, endDate, company_id } = {},
  conn = null,
) => {
  try {
    const { conditions, params } = buildDateConditions({ startDate, endDate, company_id });

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
  { startDate, endDate, company_id } = {},
  conn = null,
) => {
  try {
    const { conditions, params } = buildDateConditions({ startDate, endDate, company_id });

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
  { startDate, endDate, company_id } = {},
  conn = null,
) => {
  try {
    const { conditions, params } = buildDateConditions({ startDate, endDate, company_id });

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

/**
 * Payin Volume Monthly Summary — aggregated payin count & amount
 * grouped by month for the last N months (default 6).
 *
 * Returns rows like: { month: '2026-09', payin_count: 123, payin_amount: 45678.90 }
 */
export const getPayinVolumeMonthlySummaryDao = async (
  { months = 6, company_id } = {},
  conn = null,
) => {
  try {
    const conditions = ['is_obsolete = false'];
    const params = [];
    let nextIndex = 1;

    if (company_id) {
      conditions.push(`"company_id" = $${nextIndex++}`);
      params.push(company_id);
    }

    // Filter to the last N months
    conditions.push(`"created_at" >= $${nextIndex++}`);
    params.push(sanitizeDateString(dayjs().subtract(months - 1, 'month').startOf('month').format('YYYY-MM-DD')));

    const sql = `
      SELECT
        TO_CHAR("created_at", 'YYYY-MM') AS month,
        COUNT(*)                          AS payin_count,
        COALESCE(SUM(amount), 0)          AS payin_amount
      FROM "${tableName.PAYIN}"
      WHERE ${conditions.join(' AND ')}
      GROUP BY TO_CHAR("created_at", 'YYYY-MM')
      ORDER BY month ASC`;

    const result = await executeQuery(sql, params, conn);
    return result.rows || [];
  } catch (error) {
    logger.error('Error in getPayinVolumeMonthlySummaryDao:', error);
    throw error;
  }
};

/**
 * Payin Volume Daily Graph — aggregated payin count & amount
 * grouped by day for a given month (YYYY-MM).
 *
 * Returns rows like: { day: '2026-09-01', payin_count: 45, payin_amount: 12345.67 }
 */
export const getPayinVolumeDailyGraphDao = async (
  { month, company_id } = {},
  conn = null,
) => {
  try {
    const conditions = ['is_obsolete = false'];
    const params = [];
    let nextIndex = 1;

    if (company_id) {
      conditions.push(`"company_id" = $${nextIndex++}`);
      params.push(company_id);
    }

    // Filter to the specific month
    const monthStart = sanitizeDateString(dayjs(month + '-01').startOf('month').format('YYYY-MM-DD'));
    const monthEnd = sanitizeDateString(dayjs(month + '-01').endOf('month').format('YYYY-MM-DD'));

    conditions.push(`"created_at" >= $${nextIndex++}`);
    params.push(monthStart);
    conditions.push(`"created_at" <= $${nextIndex++}`);
    params.push(monthEnd);

    const sql = `
      SELECT
        TO_CHAR("created_at", 'YYYY-MM-DD') AS day,
        COUNT(*)                             AS payin_count,
        COALESCE(SUM(amount), 0)             AS payin_amount
      FROM "${tableName.PAYIN}"
      WHERE ${conditions.join(' AND ')}
      GROUP BY TO_CHAR("created_at", 'YYYY-MM-DD')
      ORDER BY day ASC`;

    const result = await executeQuery(sql, params, conn);
    return result.rows || [];
  } catch (error) {
    logger.error('Error in getPayinVolumeDailyGraphDao:', error);
    throw error;
  }
};
