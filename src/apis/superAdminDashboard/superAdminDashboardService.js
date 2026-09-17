import {
  getPlatformOverviewDao,
  getTransactionSummaryDao,
  getRevenueSummaryDao,
  getTransactionStatusBreakdownDao,
  getPayinVolumeMonthlySummaryDao,
  getPayinVolumeDailyGraphDao,
  getTopBanksDao,
} from './superAdminDashboardDao.js';
import { logger } from '../../utils/logger.js';
import dayjs from 'dayjs';
import redisClient from '../../utils/redisClient.js';

const SUPER_ADMIN_OVERVIEW_CACHE_TTL_SEC = Number.parseInt(
  process.env.SUPER_ADMIN_OVERVIEW_CACHE_TTL_SEC || '300',
  10,
);

const SUPER_ADMIN_REVENUE_CACHE_TTL_SEC = Number.parseInt(
  process.env.SUPER_ADMIN_REVENUE_CACHE_TTL_SEC || '60',
  10,
);

const SUPER_ADMIN_PAYIN_MONTHLY_CACHE_TTL_SEC = Number.parseInt(
  process.env.SUPER_ADMIN_PAYIN_MONTHLY_CACHE_TTL_SEC || '120',
  10,
);

const SUPER_ADMIN_PAYIN_GRAPH_CACHE_TTL_SEC = Number.parseInt(
  process.env.SUPER_ADMIN_PAYIN_GRAPH_CACHE_TTL_SEC || '120',
  10,
);

const SUPER_ADMIN_TOP_BANKS_CACHE_TTL_SEC = Number.parseInt(
  process.env.SUPER_ADMIN_TOP_BANKS_CACHE_TTL_SEC || '120',
  10,
);


/**
 * Super Admin Overview — returns platform-wide entity counts.
 */
export const getSuperAdminOverviewService = async ({ company_id } = {}) => {
  const cacheKey = `superAdmin:overview:${company_id}`;
  const cached = await redisClient.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  try {
    const overview = await getPlatformOverviewDao({ company_id });

    const result = {
      total_companies: parseInt(overview.total_companies, 10) || 0,
      total_merchants: parseInt(overview.total_merchants, 10) || 0,
      total_vendors: parseInt(overview.total_vendors, 10) || 0,
      total_users: parseInt(overview.total_users, 10) || 0,
      total_bank_accounts: parseInt(overview.total_bank_accounts, 10) || 0,
    };

    await redisClient.set(
      cacheKey,
      JSON.stringify(result),
      'EX',
      SUPER_ADMIN_OVERVIEW_CACHE_TTL_SEC,
    );

    return result;
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
  const cacheKey = `superAdmin:revenue:${company_id}:${startDate}:${endDate}`;
  const cached = await redisClient.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

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

    const result = {
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

    await redisClient.set(
      cacheKey,
      JSON.stringify(result),
      'EX',
      SUPER_ADMIN_REVENUE_CACHE_TTL_SEC,
    );

    return result;
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
  const cacheKey = `superAdmin:payin-monthly:${company_id}:${months}`;
  const cached = await redisClient.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

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

    const result = {
      months: monthlyGrowth,
      summary: {
        total_count: totalCount,
        total_amount: totalAmount,
        average_monthly_count: Math.round(totalCount / months),
        average_monthly_amount: totalAmount / months,
      },
    };

    await redisClient.set(
      cacheKey,
      JSON.stringify(result),
      'EX',
      SUPER_ADMIN_PAYIN_MONTHLY_CACHE_TTL_SEC,
    );

    return result;
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
  const cacheKey = `superAdmin:payin-graph:${company_id}:${month}`;
  const cached = await redisClient.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

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

    const result = {
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

    await redisClient.set(
      cacheKey,
      JSON.stringify(result),
      'EX',
      SUPER_ADMIN_PAYIN_GRAPH_CACHE_TTL_SEC,
    );

    return result;
  } catch (error) {
    logger.error('Error in getPayinVolumeDailyGraphService:', error);
    throw error;
  }
};

/**
 * Top Banks — returns list of top banks ranked by payin volume or count,
 * along with payin and payout transaction metrics (counts and volumes).
 * Excludes balance, today_balance, and acc_no.
 */
export const getTopBanksService = async ({
  company_id,
  startDate,
  endDate,
  limit = 5,
  sortBy = 'volume',
  sortOrder = 'desc',
} = {}) => {
  const cacheKey = `superAdmin:top-banks:${company_id}:${startDate || 'all'}:${endDate || 'all'}:${limit}:${sortBy}:${sortOrder}`;
  const cached = await redisClient.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  try {
    const rows = await getTopBanksDao({
      company_id,
      startDate,
      endDate,
      limit,
      sortBy,
      sortOrder,
    });

    const banks = rows.map((row) => {
      const payinCount = parseInt(row.payin_count, 10) || 0;
      const payinSuccessCount = parseInt(row.payin_success_count, 10) || 0;
      const payinVolume = parseFloat(row.payin_volume) || 0;
      const payinTotalVolume = parseFloat(row.payin_total_volume) || 0;

      const payoutCount = parseInt(row.payout_count, 10) || 0;
      const payoutSuccessCount = parseInt(row.payout_success_count, 10) || 0;
      const payoutVolume = parseFloat(row.payout_volume) || 0;
      const payoutTotalVolume = parseFloat(row.payout_total_volume) || 0;

      const totalCount = payinCount + payoutCount;
      const totalVolume = parseFloat((payinVolume + payoutVolume).toFixed(2));

      const successRate = payinCount > 0
        ? ((payinSuccessCount / payinCount) * 100).toFixed(2)
        : '0.00';

      return {
        bank_id: row.bank_id,
        bank_name: row.bank_name,
        acc_holder_name: row.acc_holder_name,
        payin_count: payinCount,
        payin_success_count: payinSuccessCount,
        payin_volume: payinVolume,
        payin_total_volume: payinTotalVolume,
        payout_count: payoutCount,
        payout_success_count: payoutSuccessCount,
        payout_volume: payoutVolume,
        payout_total_volume: payoutTotalVolume,
        total_count: totalCount,
        total_volume: totalVolume,
        success_rate_percent: parseFloat(successRate),
      };
    });

    // Summary calculations across the top banks
    const totalPayinCount = banks.reduce((sum, b) => sum + b.payin_count, 0);
    const totalPayinSuccessCount = banks.reduce((sum, b) => sum + b.payin_success_count, 0);
    const totalPayinVolume = parseFloat(
      banks.reduce((sum, b) => sum + b.payin_volume, 0).toFixed(2),
    );
    const totalPayoutCount = banks.reduce((sum, b) => sum + b.payout_count, 0);
    const totalPayoutSuccessCount = banks.reduce((sum, b) => sum + b.payout_success_count, 0);
    const totalPayoutVolume = parseFloat(
      banks.reduce((sum, b) => sum + b.payout_volume, 0).toFixed(2),
    );
    const totalTransactionCount = totalPayinCount + totalPayoutCount;
    const totalTransactionVolume = parseFloat(
      (totalPayinVolume + totalPayoutVolume).toFixed(2),
    );

    const overallSuccessRate = totalPayinCount > 0
      ? ((totalPayinSuccessCount / totalPayinCount) * 100).toFixed(2)
      : '0.00';

    const result = {
      dateRange: {
        startDate: startDate || null,
        endDate: endDate || null,
      },
      summary: {
        total_top_banks: banks.length,
        total_payin_count: totalPayinCount,
        total_payin_success_count: totalPayinSuccessCount,
        total_payin_volume: totalPayinVolume,
        total_payout_count: totalPayoutCount,
        total_payout_success_count: totalPayoutSuccessCount,
        total_payout_volume: totalPayoutVolume,
        total_transaction_count: totalTransactionCount,
        total_transaction_volume: totalTransactionVolume,
        overall_success_rate_percent: parseFloat(overallSuccessRate),
      },
      banks,
    };

    await redisClient.set(
      cacheKey,
      JSON.stringify(result),
      'EX',
      SUPER_ADMIN_TOP_BANKS_CACHE_TTL_SEC,
    );

    return result;
  } catch (error) {
    logger.error('Error in getTopBanksService:', error);
    throw error;
  }
};

