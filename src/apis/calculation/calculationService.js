// Importing DAO functions for database operations
import {
  createCalculationDao,
  updateCalculationDao,
  deleteCalculationDao,
  getCalculationsSumDao,
  getCalculationDao,
  calculatePayinDataDao,
  calculatePayoutDataDao,
  calculateSettlementDataDao,
  calculateChargebackDataDao,
  calculateAdjustmentDataDao,
} from './calculationDao.js';

// Importing transaction wrapper for handling database transactions
import {
  columns,
  merchantColumns,
  Role,
  vendorColumns,
} from '../../constants/index.js';
import { filterResponse } from '../../helpers/index.js';
// import { InternalServerError } from '../../utils/appErrors.js';
import { logger } from '../../utils/logger.js';
import { getMerchantsDao } from '../../apis/merchants/merchantDao.js';
import { getPayInUrlsDao } from '../../apis/payIn/payInDao.js';
import { getConnection } from '../../utils/db.js';
import dayjs from 'dayjs';
import { BadRequestError } from '../../utils/appErrors.js';

// Service to fetch calculation data
const getCalculationService = async (filters, role) => {
  try {
    // Validate required fields
    if (!filters || !role) {
      throw new BadRequestError('Missing required parameters');
    }
    const result = await getCalculationsSumDao({
      ...filters,
      role,
    });

    return (
      result || {
        vendor: [],
        merchant: [],
        netBalance: {
          vendor: 0,
          merchant: 0,
        },
        merchantTotalCalculations: {},
        vendorTotalCalculations: {},
      }
    );
  } catch (error) {
    logger.error('Error while fetching calculation data:', 'error', error);
    throw error;
  }
};

// Service to create a new calculation record
const createCalculationService = async (conn, payload, role) => {
  try {
    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.CALCULATION
        : role === Role.VENDOR
          ? vendorColumns.CALCULATION
          : columns.CALCULATION;
    const data = await createCalculationDao(conn, payload); // Ensuring transaction safety
    const finalResult = filterResponse(data, filterColumns);
    return finalResult;
  } catch (error) {
    logger.error('Error while creating calculation record:', error);
    throw error;
  }
};

// Service to update an existing calculation record
const updateCalculationService = async (conn, filters, payload, role) => {
  try {
    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.CALCULATION
        : role === Role.VENDOR
          ? vendorColumns.CALCULATION
          : columns.CALCULATION;
    const data = await updateCalculationDao(filters, payload, conn);
    const finalResult = filterResponse(data, filterColumns);
    return finalResult;
  } catch (error) {
    logger.error('Error while updating calculation record:', error);
    throw error;
  } finally {
    if (conn) {
      try {
        conn.release();
      } catch (releaseError) {
        logger.error('Error while releasing the connection:', releaseError);
      }
    }
  }
};

// Service to mark a calculation record as obsolete (soft delete)
const deleteCalculationService = async (conn, id, role) => {
  try {
    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.CALCULATION
        : role === Role.VENDOR
          ? vendorColumns.CALCULATION
          : columns.CALCULATION;
    const userData = { is_obsolete: true };
    const data = await deleteCalculationDao(conn, id, userData);
    const finalResult = filterResponse(data, filterColumns);
    return finalResult;
  } catch (error) {
    logger.error('Error while deleting calculation record:', error);
    throw error;
  }
};

const calculateSuccessRatios = async (merchants, date, user_id) => {
  try {
    const targetMerchant = merchants.find((m) => m.user_id === user_id);
    if (!targetMerchant) {
      logger.warn(`No merchant found for user_id: ${user_id}`);
      return null;
    }

    const selectedDate = date ? dayjs(date) : dayjs();
    const isCurrentDate = selectedDate.isSame(dayjs(), 'day');

    const intervals = isCurrentDate
      ? [
          { label: 'Last 5m', duration: 5 * 60 * 1000 },
          { label: 'Last 15m', duration: 15 * 60 * 1000 },
          { label: 'Last 30m', duration: 30 * 60 * 1000 },
          { label: 'Last 1h', duration: 60 * 60 * 1000 },
          { label: 'Last 3h', duration: 3 * 60 * 60 * 1000 },
          { label: 'Last 24h', duration: 24 * 60 * 60 * 1000 },
        ]
      : [
          { label: '04:00', start: 0, end: 4 },
          { label: '08:00', start: 4, end: 8 },
          { label: '12:00', start: 8, end: 12 },
          { label: '16:00', start: 12, end: 16 },
          { label: '20:00', start: 16, end: 20 },
          { label: '24:00', start: 20, end: 24 },
        ];

    // Modified: Use merchant_id instead of user_id
    const allPayins = await getPayInUrlsDao({
      merchant_id: targetMerchant.id,
    });

    // Process only the target merchant's transactions
    const merchantTransactions = allPayins.map((payin) => ({
      updated_at: new Date(payin.updated_at),
      status: payin.status,
      user_submitted_utr: payin.user_submitted_utr,
    }));

    const stats = intervals.map((interval) => {
      let filteredTx;

      if (isCurrentDate) {
        const startTime = new Date(dayjs().valueOf() - interval.duration);
        filteredTx = merchantTransactions.filter(
          (tx) => tx.updated_at >= startTime,
        );
      } else {
        const startTime = selectedDate
          .hour(interval.start)
          .startOf('hour')
          .toDate();
        const endTime = selectedDate
          .hour(interval.end)
          .startOf('hour')
          .toDate();
        filteredTx = merchantTransactions.filter(
          (tx) => tx.updated_at >= startTime && tx.updated_at < endTime,
        );
      }

      const total = filteredTx.length;
      const success = filteredTx.filter((tx) => tx.status === 'SUCCESS').length;
      const utrSubmitted = filteredTx.filter(
        (tx) => tx.user_submitted_utr?.length > 0,
      ).length;

      return {
        interval: interval.label,
        total,
        success,
        utrSubmitted,
        successRatio: total === 0 ? 0 : (success / total) * 100,
        utrRatio: total === 0 ? 0 : (utrSubmitted / total) * 100,
      };
    });

    return [
      {
        merchantCode: targetMerchant.code,
        stats,
        date: selectedDate.format('YYYY-MM-DD'),
      },
    ];
  } catch (error) {
    logger.error('Error calculating success ratios:', error);
    throw error;
  }
};

const updateCalculationsService = async (filters, role) => {
  let conn;
  try {
    conn = await getConnection();

    const { date, user_ids, startDate, endDate, company_id } = filters;

    logger.info(
      `Processing calculations update for ${user_ids.length} users on date: ${date}`,
    );

    // Get current calculations that need to be updated
    const existingCalculations = await getCalculationsSumDao({
      company_id,
      users: user_ids.join(','),
      startDate: startDate || date,
      endDate: endDate || date,
      role,
    });

    let processedUsers = [];
    let updatedCount = 0;
    let failedUsers = [];

    // Process each user_id
    for (const user_id of user_ids) {
      try {
        logger.info(`Processing calculations for user_id: ${user_id}`);

        // Find calculations for this specific user from both merchant and vendor data
        let userCalculations = [];
        
        if (existingCalculations?.merchant?.length > 0) {
          const merchantCalcs = existingCalculations.merchant.filter(m => 
            m.user_id === user_id || m.merchant_user_id === user_id
          );
          userCalculations.push(...merchantCalcs);
        }
        
        if (existingCalculations?.vendor?.length > 0) {
          const vendorCalcs = existingCalculations.vendor.filter(v => 
            v.user_id === user_id || v.vendor_user_id === user_id
          );
          userCalculations.push(...vendorCalcs);
        }

        // If no existing calculations found, get them directly from DAO
        if (userCalculations.length === 0) {
          const directCalculations = await getCalculationDao({
            user_id,
            company_id,
            startDate: startDate || date,
            endDate: endDate || date,
            role
          });
          userCalculations = directCalculations || [];
        }

        if (userCalculations.length > 0) {
          // Update calculations for this user on the specified date
          for (const calculation of userCalculations) {
            // Get actual transaction data from database using DAO functions
            // First get settlement data to check for reversed internal settlements
            const settlementData = await calculateSettlementDataDao(user_id, company_id, startDate || date, endDate || date);
            
            // Get payin data with additional data from reversed internal settlements
            const payinData = await calculatePayinDataDao(
              user_id, 
              company_id, 
              startDate || date, 
              endDate || date, 
              settlementData.reversed_internal_settlements
            );
            
            const payoutData = await calculatePayoutDataDao(user_id, company_id, startDate || date, endDate || date);
            const chargebackData = await calculateChargebackDataDao(user_id, company_id, startDate || date, endDate || date);
            const adjustmentData = await calculateAdjustmentDataDao(user_id, company_id, startDate || date, endDate || date);

            // Calculate current balance based on actual data
            const baseCalculation = 
              payinData.total_payin_amount -
              payoutData.total_payout_amount -
              (payinData.total_payin_commission -
               payoutData.total_payout_commission +
               payoutData.total_reverse_payout_commission) -
              chargebackData.total_chargeback_amount +
              payoutData.total_reverse_payout_amount;
            
            // Determine if user is merchant or vendor based on role
            const isMerchant = role === Role.MERCHANT;
            const calculatedCurrentBalance = isMerchant 
              ? baseCalculation + settlementData.total_settlement_amount
              : baseCalculation - settlementData.total_settlement_amount;

            // Calculate net balance (keep existing net balance + any new transactions)
            const previousNetBalance = parseFloat(calculation.net_balance || 0);
            const balanceChange = calculatedCurrentBalance;
            const calculatedNetBalance = previousNetBalance + balanceChange;

            // Prepare comprehensive update payload with recalculated values
            const updatePayload = {
              // Update timestamp
              updated_at: new Date(),
              
              // Core calculation fields - use actual calculated values from database
              total_payin_count: payinData.total_payin_count,
              total_payin_amount: payinData.total_payin_amount,
              total_payin_commission: payinData.total_payin_commission,
              
              total_payout_count: payoutData.total_payout_count,
              total_payout_amount: payoutData.total_payout_amount,
              total_payout_commission: payoutData.total_payout_commission,
              
              total_settlement_count: settlementData.total_settlement_count,
              total_settlement_amount: settlementData.total_settlement_amount,
              total_settlement_commission: settlementData.total_settlement_commission,
              
              total_chargeback_count: chargebackData.total_chargeback_count,
              total_chargeback_amount: chargebackData.total_chargeback_amount,
              
              total_reverse_payout_count: payoutData.total_reverse_payout_count,
              total_reverse_payout_amount: payoutData.total_reverse_payout_amount,
              total_reverse_payout_commission: payoutData.total_reverse_payout_commission,
              
              total_adjustment_count: adjustmentData.total_adjustment_count,
              total_adjustment_amount: adjustmentData.total_adjustment_amount,
              total_adjustment_commission: adjustmentData.total_adjustment_commission,
              
              // Calculated balances
              current_balance: calculatedCurrentBalance,
              net_balance: calculatedNetBalance,
              
              // Config fields - preserve existing config and add processing metadata
              config: {
                ...calculation.config,
                last_processed_date: date,
                last_update_timestamp: new Date().toISOString(),
                processed_by_bulk_update: true,
                update_metadata: {
                  processed_fields: [
                    'total_payin_count', 'total_payin_amount', 'total_payin_commission',
                    'total_payout_count', 'total_payout_amount', 'total_payout_commission',
                    'total_settlement_count', 'total_settlement_amount', 'total_settlement_commission',
                    'total_chargeback_count', 'total_chargeback_amount',
                    'total_reverse_payout_count', 'total_reverse_payout_amount', 'total_reverse_payout_commission',
                    'total_adjustment_count', 'total_adjustment_amount', 'total_adjustment_commission',
                    'current_balance', 'net_balance'
                  ],
                  original_values: {
                    current_balance: calculation.current_balance,
                    net_balance: calculation.net_balance,
                    total_payin_count: calculation.total_payin_count,
                    total_payout_count: calculation.total_payout_count,
                    total_settlement_count: calculation.total_settlement_count,
                  },
                  recalculated_values: {
                    current_balance: calculatedCurrentBalance,
                    net_balance: calculatedNetBalance,
                    balance_change: balanceChange,
                  },
                  reversed_internal_settlements: {
                    count: settlementData.reversed_internal_settlements.count,
                    amount: settlementData.reversed_internal_settlements.amount,
                    commission: settlementData.reversed_internal_settlements.commission,
                    note: "Reversed internal settlements added to payin calculations instead of subtracted from settlements"
                  }
                },
                settlement_details: {
                  ...settlementData.settlement_details,
                },
                calculation_summary: {
                  payin_total: payinData.total_payin_amount,
                  payout_total: payoutData.total_payout_amount,
                  commission_total: (
                    payinData.total_payin_commission -
                    payoutData.total_payout_commission +
                    payoutData.total_reverse_payout_commission
                  ),
                  chargeback_total: chargebackData.total_chargeback_amount,
                  reverse_payout_total: payoutData.total_reverse_payout_amount,
                  settlement_total: settlementData.total_settlement_amount,
                  adjustment_total: adjustmentData.total_adjustment_amount,
                  base_calculation: baseCalculation,
                  final_current_balance: calculatedCurrentBalance,
                  reversed_internal_settlements_included_in_payin: settlementData.reversed_internal_settlements.amount
                }
              }
            };

            // Execute the update
            const updateResult = await updateCalculationDao(
              { 
                id: calculation.id, 
                company_id 
              }, 
              updatePayload,
              conn
            );

            if (updateResult) {
              updatedCount++;
              logger.info(`Successfully updated calculation ID: ${calculation.id} for user_id: ${user_id}`);
            }
          }
          
          processedUsers.push(user_id);
          logger.info(
            `Updated ${userCalculations.length} calculations for user_id: ${user_id}`,
          );
        } else {
          logger.warn(
            `No calculations found for user_id: ${user_id} on date: ${date}`,
          );
          failedUsers.push({
            user_id,
            reason: 'No calculations found for the specified date range'
          });
        }
      } catch (userError) {
        logger.error(
          `Error processing calculations for user_id: ${user_id}:`,
          userError,
        );
        failedUsers.push({
          user_id,
          reason: userError.message || 'Processing error'
        });
        // Continue processing other users even if one fails
      }
    }

    return {
      updated_count: updatedCount,
      processed_users: processedUsers,
      failed_users: failedUsers,
      date: date,
      total_users_requested: user_ids.length,
      success_rate: `${processedUsers.length}/${user_ids.length}`,
      message: `Successfully recalculated and updated calculations for ${processedUsers.length} out of ${user_ids.length} users. ${updatedCount} total calculation records updated with fresh transaction data.`,
      processing_details: {
        date_range: {
          start: startDate || date,
          end: endDate || date
        },
        calculation_method: 'real_time_database_aggregation',
        data_sources: [
          'Payin transactions (SUCCESS status)',
          'Payout transactions (SUCCESS/REVERSED status)', 
          'Settlement transactions (SUCCESS/COMPLETED status)',
          'Chargeback transactions (APPROVED status)',
          'Adjustment transactions (APPROVED status)'
        ],
        fields_updated: [
          'updated_at', 'total_payin_count', 'total_payin_amount', 'total_payin_commission',
          'total_payout_count', 'total_payout_amount', 'total_payout_commission',
          'total_settlement_count', 'total_settlement_amount', 'total_settlement_commission',
          'total_chargeback_count', 'total_chargeback_amount',
          'total_reverse_payout_count', 'total_reverse_payout_amount', 'total_reverse_payout_commission',
          'total_adjustment_count', 'total_adjustment_amount', 'total_adjustment_commission',
          'current_balance', 'net_balance', 'config'
        ],
        balance_calculation_formula: {
          base_calculation: 'payin_amount - payout_amount - (payin_commission - payout_commission + reverse_payout_commission) - chargeback_amount + reverse_payout_amount',
          current_balance_merchant: 'base_calculation + settlement_amount',
          current_balance_vendor: 'base_calculation - settlement_amount',
          net_balance: 'previous_net_balance + balance_change'
        }
      }
    };
  } catch (error) {
    logger.error('Error in updateCalculationsService:', error);
    throw error;
  } finally {
    if (conn) {
      conn.release();
    }
  }
};

const calculateSuccessRatiosService = async (date, user_ids) => {
  let conn;
  try {
    conn = await getConnection();

    // Get merchants data using user_ids
    const merchants = await getMerchantsDao({
      user_id: user_ids,
    });

    // Process each merchant in parallel using user_ids
    const successRatiosPromises = user_ids.map(async (userId) => {
      return calculateSuccessRatios(merchants, date, userId);
    });

    const results = await Promise.all(successRatiosPromises);
    const successRatios = results.filter(Boolean).flat();

    return { successRatios };
  } catch (error) {
    logger.error('Error in calculateSuccessRatiosService:', error);
    throw error;
  } finally {
    if (conn) {
      conn.release();
    }
  }
};

// Exporting services for use in other modules
export {
  calculateSuccessRatiosService,
  getCalculationService,
  createCalculationService,
  updateCalculationService,
  deleteCalculationService,
  updateCalculationsService,
};
