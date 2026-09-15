import {
  getPlatformOverviewDao,
  getTransactionSummaryDao,
  getRevenueSummaryDao,
  getTransactionStatusBreakdownDao,
  getPayinVolumeMonthlySummaryDao,
  getPayinVolumeDailyGraphDao,
} from './superAdminDashboardDao.js';
import { logger } from '../../utils/logger.js';
import dayjs from 'dayjs';

/**
 * Super Admin Overview — returns platform-wide entity counts.
 */
export const getSuperAdminOverviewService = async ({ company_id } = {}) => {
  try {
    const overview = await getPlatformOverviewDao({ company_id });

    return {
      total_companies: parseInt(overview.total_companies, 10) || 0,
      total_merchants: parseInt(overview.total_merchants, 10) || 0,
      total_vendors: parseInt(overview.total_vendors, 10) || 0,
      total_users: parseInt(overview.total_users, 10) || 0,
      total_bank_accounts: parseInt(overview.total_bank_accounts, 10) || 0,
    };
  } catch (error) {
    logger.error('Error in getSuperAdminOverviewService:', error);
    throw error;
  }
};

/**
 * Transaction & Revenue Summary — returns aggregated transaction volumes,
 * commissions, success rates, and status breakdown for a date range.
 */
export const getTransactionRevenueSummaryService = async ({ startDate, endDate, company_id }) => {
  try {
    const [transactionSummary, revenueSummary, statusBreakdown] = await Promise.all([
      getTransactionSummaryDao({ startDate, endDate, company_id }),
      getRevenueSummaryDao({ startDate, endDate, company_id }),
      getTransactionStatusBreakdownDao({ startDate, endDate, company_id }),
    ]);

    // Parse transaction counts
    const totalPayinCount = parseInt(transactionSummary.total_payin_count, 10) || 0;
    const totalPayoutCount = parseInt(transactionSummary.total_payout_count, 10) || 0;
    const totalTransactionCount = totalPayinCount + totalPayoutCount;

    // Parse amounts
    const totalPayinAmount = parseFloat(transactionSummary.total_payin_amount) || 0;
    const totalPayoutAmount = parseFloat(transactionSummary.total_payout_amount) || 0;
    const netFlow = totalPayinAmount - totalPayoutAmount;

    // Build status lookup
    const statusMap = {};
    for (const row of statusBreakdown) {
      statusMap[row.status] = {
        count: parseInt(row.count, 10),
        amount: parseFloat(row.total_amount),
      };
    }

    // Success / Failed / Dropped rates
    const successCount = statusMap.SUCCESS?.count || 0;
    const failedCount = (statusMap.FAILED?.count || 0)
      + (statusMap.BANK_MISMATCH?.count || 0);
    const droppedCount = (statusMap.DROPPED?.count || 0)
      + (statusMap.USER_DROPPED?.count || 0);

    const successRate = totalTransactionCount > 0
      ? ((successCount / totalTransactionCount) * 100).toFixed(2)
      : '0.00';
    const failedRate = totalTransactionCount > 0
      ? ((failedCount / totalTransactionCount) * 100).toFixed(2)
      : '0.00';
    const droppedRate = totalTransactionCount > 0
      ? ((droppedCount / totalTransactionCount) * 100).toFixed(2)
      : '0.00';

    return {
      transactionSummary: {
        total_payin_count: totalPayinCount,
        total_payin_amount: totalPayinAmount,
        total_payout_count: totalPayoutCount,
        total_payout_amount: totalPayoutAmount,
        total_transaction_count: totalTransactionCount,
        net_flow: netFlow,
      },
      rates: {
        success_rate_percent: parseFloat(successRate),
        failed_rate_percent: parseFloat(failedRate),
        dropped_rate_percent: parseFloat(droppedRate),
      },
      revenue: {
        total_payin_commission: parseFloat(revenueSummary.total_payin_commission) || 0,
        total_payout_commission: parseFloat(revenueSummary.total_payout_commission) || 0,
        total_revenue: parseFloat(revenueSummary.total_revenue) || 0,
      },
      statusBreakdown: statusBreakdown.map((row) => ({
        status: row.status,
        count: parseInt(row.count, 10),
        amount: parseFloat(row.total_amount),
      })),
    };
  } catch (error) {
    logger.error('Error in getTransactionRevenueSummaryService:', error);
    throw error;
  }
};

/**
 * Payin Volume Monthly Summary — returns aggregated payin count & amount
 * for each of the last N months (default 6).
 */
export const getPayinVolumeMonthlySummaryService = async ({ months = 6, company_id } = {}) => {
  try {
    const rows = await getPayinVolumeMonthlySummaryDao({ months, company_id });

    // Build a map for quick lookup
    const dataMap = {};
    for (const row of rows) {
      dataMap[row.month] = {
        payin_count: parseInt(row.payin_count, 10) || 0,
        payin_amount: parseFloat(row.payin_amount) || 0,
      };
    }

    // Fill in missing months with zeros
    const months_list = [];
    for (let i = months - 1; i >= 0; i--) {
      const monthKey = dayjs().subtract(i, 'month').format('YYYY-MM');
      months_list.push({
        month: monthKey,
        label: dayjs(monthKey + '-01').format('MMM YYYY'),
        payin_count: dataMap[monthKey]?.payin_count ?? 0,
        payin_amount: dataMap[monthKey]?.payin_amount ?? 0,
      });
    }

    // Calculate totals
    const totalCount = months_list.reduce((sum, m) => sum + m.payin_count, 0);
    const totalAmount = months_list.reduce((sum, m) => sum + m.payin_amount, 0);

    // Calculate month-over-month growth
    const monthlyGrowth = months_list.map((m, idx) => {
      if (idx === 0) return { ...m, growth_percent: 0, growth_amount: 0 };
      const prev = months_list[idx - 1];
      const growthAmount = m.payin_amount - prev.payin_amount;
      const growthPercent = prev.payin_amount > 0
        ? ((growthAmount / prev.payin_amount) * 100).toFixed(2)
        : '0.00';
      return {
        ...m,
        growth_percent: parseFloat(growthPercent),
        growth_amount: growthAmount,
      };
    });

    return {
      months: monthlyGrowth,
      summary: {
        total_count: totalCount,
        total_amount: totalAmount,
        average_monthly_count: Math.round(totalCount / months),
        average_monthly_amount: totalAmount / months,
      },
    };
  } catch (error) {
    logger.error('Error in getPayinVolumeMonthlySummaryService:', error);
    throw error;
  }
};

/**
 * Payin Volume Daily Graph — returns daily payin count & amount
 * for a specific month (YYYY-MM format).
 */
export const getPayinVolumeDailyGraphService = async ({ month, company_id }) => {
  try {
    const rows = await getPayinVolumeDailyGraphDao({ month, company_id });

    // Build a map for quick lookup
    const dataMap = {};
    for (const row of rows) {
      dataMap[row.day] = {
        payin_count: parseInt(row.payin_count, 10) || 0,
        payin_amount: parseFloat(row.payin_amount) || 0,
      };
    }

    // Fill in missing days with zeros
    const daysInMonth = dayjs(month + '-01').daysInMonth();
    const dailyData = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dayKey = dayjs(month + '-01').date(d).format('YYYY-MM-DD');
      dailyData.push({
        day: dayKey,
        label: dayjs(dayKey).format('DD'),
        full_label: dayjs(dayKey).format('DD MMM'),
        payin_count: dataMap[dayKey]?.payin_count ?? 0,
        payin_amount: dataMap[dayKey]?.payin_amount ?? 0,
      });
    }

    // Calculate totals for the month
    const totalCount = dailyData.reduce((sum, d) => sum + d.payin_count, 0);
    const totalAmount = dailyData.reduce((sum, d) => sum + d.payin_amount, 0);

    return {
      month,
      days: dailyData,
      summary: {
        total_count: totalCount,
        total_amount: totalAmount,
        average_daily_count: Math.round(totalCount / daysInMonth),
        average_daily_amount: totalAmount / daysInMonth,
        peak_day: dailyData.reduce((max, d) => d.payin_count > max.payin_count ? d : max, dailyData[0]),
      },
    };
  } catch (error) {
    logger.error('Error in getPayinVolumeDailyGraphService:', error);
    throw error;
  }
};
