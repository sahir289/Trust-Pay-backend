import {
  getPlatformOverviewDao,
  getTransactionSummaryDao,
  getRevenueSummaryDao,
  getTransactionStatusBreakdownDao,
} from './superAdminDashboardDao.js';
import { logger } from '../../utils/logger.js';

/**
 * Super Admin Overview — returns platform-wide entity counts.
 */
export const getSuperAdminOverviewService = async () => {
  try {
    const overview = await getPlatformOverviewDao();

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
export const getTransactionRevenueSummaryService = async ({ startDate, endDate }) => {
  try {
    const [transactionSummary, revenueSummary, statusBreakdown] = await Promise.all([
      getTransactionSummaryDao({ startDate, endDate }),
      getRevenueSummaryDao({ startDate, endDate }),
      getTransactionStatusBreakdownDao({ startDate, endDate }),
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
