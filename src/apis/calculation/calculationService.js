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
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';
import { BadRequestError } from '../../utils/appErrors.js';

// Extend dayjs with timezone and utc plugins
dayjs.extend(utc);
dayjs.extend(timezone);

// Set default timezone to IST
dayjs.tz.setDefault('Asia/Kolkata');

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

const updateCalculationsService = async (conn, filters, role) => {
  try {
    const { date, user_id, startDate, endDate, company_id } = filters;

    // Validate user_id
    if (!user_id || typeof user_id !== 'string') {
      throw new BadRequestError('user_id must be a valid string');
    }

    // Calculate date ranges based on provided date (all in IST timezone)
    let calculationStartDate, calculationEndDate;
    const currentDate = dayjs().tz('Asia/Kolkata').format('YYYY-MM-DD');

    if (startDate && endDate) {
      // If explicit start and end dates are provided, use them
      calculationStartDate = startDate;
      calculationEndDate = endDate;
    } else if (date) {
      // If a specific date is provided
      const dateObj = dayjs(date).tz('Asia/Kolkata');
      const isCurrentDate = dateObj.isSame(dayjs().tz('Asia/Kolkata'), 'day');

      if (isCurrentDate) {
        // If provided date is current date, calculate T-1 and current date
        calculationStartDate = dateObj.subtract(1, 'day').format('YYYY-MM-DD');
        calculationEndDate = currentDate;
      } else {
        // If provided date is not current, calculate from T-1 of provided date until current date
        calculationStartDate = dateObj.subtract(1, 'day').format('YYYY-MM-DD');
        calculationEndDate = currentDate;
      }
    } else {
      // Default: calculate T-1 and current date
      calculationStartDate = dayjs()
        .tz('Asia/Kolkata')
        .subtract(1, 'day')
        .format('YYYY-MM-DD');
      calculationEndDate = currentDate;
    }

    logger.info(
      `Processing calculations update for user ${user_id} from ${calculationStartDate} to ${calculationEndDate}`,
    );

    // Get current calculations that need to be updated for the calculated date range
    const existingCalculations = await getCalculationsSumDao({
      company_id,
      users: user_id,
      startDate: calculationStartDate,
      endDate: calculationEndDate,
      role,
    });

    let processedUsers = [];
    let updatedCount = 0;
    let failedUsers = [];

    // Process the user_id
    try {
      logger.info(
        `Processing calculations for user_id: ${user_id} from ${calculationStartDate} to ${calculationEndDate}`,
      );

      // Generate array of dates to process (in IST timezone)
      const datesToProcess = [];
      let currentProcessDate = dayjs(calculationStartDate).tz('Asia/Kolkata');
      const endProcessDate = dayjs(calculationEndDate).tz('Asia/Kolkata');

      while (
        currentProcessDate.isBefore(endProcessDate) ||
        currentProcessDate.isSame(endProcessDate, 'day')
      ) {
        datesToProcess.push(currentProcessDate.format('YYYY-MM-DD'));
        currentProcessDate = currentProcessDate.add(1, 'day');
      }

      logger.info(
        `Processing ${datesToProcess.length} dates for user_id: ${user_id}: ${datesToProcess.join(', ')}`,
      );

      // Get the initial net balance from the calculation before the start date
      let runningNetBalance = 0;
      try {
        // Get the most recent calculation before the start date to use as baseline
        const baselineCalculations = await getCalculationsSumDao({
          company_id,
          users: user_id,
          startDate: dayjs(calculationStartDate)
            .tz('Asia/Kolkata')
            .subtract(1, 'day')
            .format('YYYY-MM-DD'),
          endDate: dayjs(calculationStartDate)
            .tz('Asia/Kolkata')
            .subtract(1, 'day')
            .format('YYYY-MM-DD'),
          role,
        });

        if (baselineCalculations) {
          // Get baseline calculations similar to how userCalculations are obtained
          let sortedBaseline = [];

          // Check merchant calculations first
          if (baselineCalculations?.merchant?.length > 0) {
            const merchantBaseline = baselineCalculations.merchant.filter(
              (m) => {
                // Check user_id match
                return m.user_id === user_id || m.merchant_user_id === user_id;
              },
            );
            sortedBaseline.push(...merchantBaseline);
          }

          // Check vendor calculations
          if (baselineCalculations?.vendor?.length > 0) {
            const vendorBaseline = baselineCalculations.vendor.filter((v) => {
              // Check user_id match
              return v.user_id === user_id || v.vendor_user_id === user_id;
            });
            sortedBaseline.push(...vendorBaseline);
          }

          runningNetBalance = parseFloat(sortedBaseline[0].net_balance || 0);
          logger.info(
            `Starting with baseline net balance: ${runningNetBalance} from calculation ID: ${sortedBaseline[0].id}`,
          );
        }
      } catch (error) {
        logger.warn(
          `Could not fetch baseline calculation for user ${user_id}, starting with 0:`,
          error,
        );
        runningNetBalance = 0;
      }

      // Process each date for this user
      for (const processDate of datesToProcess) {
        try {
          logger.info(
            `Processing date: ${processDate} for user_id: ${user_id}`,
          );

          // Find calculations for this specific user and date from both merchant and vendor data
          let userCalculations = [];

          if (existingCalculations?.merchant?.length > 0) {
            const merchantCalcs = existingCalculations.merchant.filter((m) => {
              // Check user_id match
              const userMatches =
                m.user_id === user_id || m.merchant_user_id === user_id;

              // Check date match - handle both created_at and date fields, and consider timezone conversion
              let dateMatches = false;

              // Try created_at field first
              if (m.created_at) {
                const createdAtDate = dayjs(m.created_at)
                  .tz('Asia/Kolkata')
                  .format('YYYY-MM-DD');
                dateMatches = createdAtDate === processDate;
              }

              // If no match with created_at, try date field
              if (!dateMatches && m.date) {
                const recordDate = dayjs(m.date)
                  .tz('Asia/Kolkata')
                  .format('YYYY-MM-DD');
                dateMatches = recordDate === processDate;
              }

              // Also check if the date falls within the same IST day regardless of timezone
              if (!dateMatches && (m.created_at || m.date)) {
                const checkDate = m.created_at || m.date;
                const recordDateIST = dayjs(checkDate).tz('Asia/Kolkata');
                const processDateIST = dayjs(processDate).tz('Asia/Kolkata');
                dateMatches = recordDateIST.isSame(processDateIST, 'day');
              }

              return userMatches && dateMatches;
            });

            if (merchantCalcs.length > 0) {
              logger.info(
                `Found ${merchantCalcs.length} merchant calculations for user_id: ${user_id} on date: ${processDate}`,
              );
              merchantCalcs.forEach((calc) => {
                const calcDate = calc.created_at
                  ? dayjs(calc.created_at)
                      .tz('Asia/Kolkata')
                      .format('YYYY-MM-DD HH:mm:ss')
                  : 'N/A';
                const calcDateField = calc.date
                  ? dayjs(calc.date)
                      .tz('Asia/Kolkata')
                      .format('YYYY-MM-DD HH:mm:ss')
                  : 'N/A';
                logger.info(
                  `- Calc ID: ${calc.id}, created_at: ${calcDate}, date field: ${calcDateField}`,
                );
              });
            }

            userCalculations.push(...merchantCalcs);
          }

          if (existingCalculations?.vendor?.length > 0) {
            const vendorCalcs = existingCalculations.vendor.filter((v) => {
              // Check user_id match
              const userMatches =
                v.user_id === user_id || v.vendor_user_id === user_id;

              // Check date match - handle both created_at and date fields, and consider timezone conversion
              let dateMatches = false;

              // Try created_at field first
              if (v.created_at) {
                const createdAtDate = dayjs(v.created_at)
                  .tz('Asia/Kolkata')
                  .format('YYYY-MM-DD');
                dateMatches = createdAtDate === processDate;
              }

              // If no match with created_at, try date field
              if (!dateMatches && v.date) {
                const recordDate = dayjs(v.date)
                  .tz('Asia/Kolkata')
                  .format('YYYY-MM-DD');
                dateMatches = recordDate === processDate;
              }

              // Also check if the date falls within the same IST day regardless of timezone
              if (!dateMatches && (v.created_at || v.date)) {
                const checkDate = v.created_at || v.date;
                const recordDateIST = dayjs(checkDate).tz('Asia/Kolkata');
                const processDateIST = dayjs(processDate).tz('Asia/Kolkata');
                dateMatches = recordDateIST.isSame(processDateIST, 'day');
              }

              return userMatches && dateMatches;
            });

            if (vendorCalcs.length > 0) {
              logger.info(
                `Found ${vendorCalcs.length} vendor calculations for user_id: ${user_id} on date: ${processDate}`,
              );
              vendorCalcs.forEach((calc) => {
                const calcDate = calc.created_at
                  ? dayjs(calc.created_at)
                      .tz('Asia/Kolkata')
                      .format('YYYY-MM-DD HH:mm:ss')
                  : 'N/A';
                const calcDateField = calc.date
                  ? dayjs(calc.date)
                      .tz('Asia/Kolkata')
                      .format('YYYY-MM-DD HH:mm:ss')
                  : 'N/A';
                logger.info(
                  `- Calc ID: ${calc.id}, created_at: ${calcDate}, date field: ${calcDateField}`,
                );
              });
            }

            userCalculations.push(...vendorCalcs);
          }

          // If no existing calculations found for this date, get them directly from DAO
          if (userCalculations.length === 0) {
            const directCalculations = await getCalculationDao({
              user_id,
              company_id,
              startDate: processDate,
              endDate: processDate,
              role,
            });
            userCalculations = directCalculations || [];
          }

          if (userCalculations.length > 0) {
            // Update calculations for this user on the specific process date
            for (const calculation of userCalculations) {
              // Get actual transaction data from database using DAO functions for this specific date
              // First get settlement data to check for reversed internal settlements
              const settlementData = await calculateSettlementDataDao(
                user_id,
                company_id,
                processDate,
              );

              // Get payin data with additional data from reversed internal settlements
              const payinData = await calculatePayinDataDao(
                user_id,
                company_id,
                processDate,
                settlementData.reversed_internal_settlements,
              );

              const payoutData = await calculatePayoutDataDao(
                user_id,
                company_id,
                processDate,
              );
              const chargebackData = await calculateChargebackDataDao(
                user_id,
                company_id,
                processDate,
              );
              const adjustmentData = await calculateAdjustmentDataDao(
                user_id,
                company_id,
                processDate,
              );

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

              // Calculate net balance using running total approach
              // Each entry's net balance = running net balance + current balance
              const balanceChange = calculatedCurrentBalance;
              const calculatedNetBalance =
                runningNetBalance + calculatedCurrentBalance;

              // Update the running balance for the next iteration
              runningNetBalance = calculatedNetBalance;

              logger.info(
                `Date: ${processDate}, Current Balance: ${calculatedCurrentBalance}, Net Balance: ${calculatedNetBalance}, Running Balance: ${runningNetBalance}`,
              );

              // Prepare comprehensive update payload with recalculated values
              const updatePayload = {
                // Update timestamp (IST timezone)
                updated_at: dayjs().tz('Asia/Kolkata').toDate(),

                // Core calculation fields - use actual calculated values from database
                total_payin_count: payinData.total_payin_count,
                total_payin_amount: payinData.total_payin_amount,
                total_payin_commission: payinData.total_payin_commission,

                total_payout_count: payoutData.total_payout_count,
                total_payout_amount: payoutData.total_payout_amount,
                total_payout_commission: payoutData.total_payout_commission,

                total_settlement_count: settlementData.total_settlement_count,
                total_settlement_amount: settlementData.total_settlement_amount,
                total_settlement_commission:
                  settlementData.total_settlement_commission,

                total_chargeback_count: chargebackData.total_chargeback_count,
                total_chargeback_amount: chargebackData.total_chargeback_amount,

                total_reverse_payout_count:
                  payoutData.total_reverse_payout_count,
                total_reverse_payout_amount:
                  payoutData.total_reverse_payout_amount,
                total_reverse_payout_commission:
                  payoutData.total_reverse_payout_commission,

                total_adjustment_count: adjustmentData.total_adjustment_count,
                total_adjustment_amount: adjustmentData.total_adjustment_amount,
                total_adjustment_commission:
                  adjustmentData.total_adjustment_commission,

                // Calculated balances
                current_balance: calculatedCurrentBalance,
                net_balance: calculatedNetBalance,

                // Config fields - preserve existing config and add processing metadata
                config: {
                  ...calculation.config,
                  last_processed_date: processDate,
                  last_update_timestamp: dayjs()
                    .tz('Asia/Kolkata')
                    .toISOString(),
                  processed_by_bulk_update: true,
                  date_range_processed: {
                    start: calculationStartDate,
                    end: calculationEndDate,
                    current_processing_date: processDate,
                  },
                  update_metadata: {
                    original_values: {
                      current_balance: calculation.current_balance,
                      net_balance: calculation.net_balance,
                      total_payin_count: calculation.total_payin_count,
                      total_payout_count: calculation.total_payout_count,
                      total_settlement_count:
                        calculation.total_settlement_count,
                    },
                    recalculated_values: {
                      current_balance: calculatedCurrentBalance,
                      net_balance: calculatedNetBalance,
                      balance_change: balanceChange,
                    },
                    reversed_internal_settlements: {
                      count: settlementData.reversed_internal_settlements.count,
                      amount:
                        settlementData.reversed_internal_settlements.amount,
                      commission:
                        settlementData.reversed_internal_settlements.commission,
                      note: 'Reversed internal settlements added to payin calculations instead of subtracted from settlements',
                    },
                  },
                  settlement_details: {
                    ...settlementData.settlement_details,
                  },
                  // calculation_summary: {
                  //   payin_total: payinData.total_payin_amount,
                  //   payout_total: payoutData.total_payout_amount,
                  //   commission_total:
                  //     payinData.total_payin_commission -
                  //     payoutData.total_payout_commission +
                  //     payoutData.total_reverse_payout_commission,
                  //   chargeback_total: chargebackData.total_chargeback_amount,
                  //   reverse_payout_total:
                  //     payoutData.total_reverse_payout_amount,
                  //   settlement_total: settlementData.total_settlement_amount,
                  //   adjustment_total: adjustmentData.total_adjustment_amount,
                  //   base_calculation: baseCalculation,
                  //   final_current_balance: calculatedCurrentBalance,
                  //   reversed_internal_settlements_included_in_payin:
                  //     settlementData.reversed_internal_settlements.amount,
                  // },
                },
              };

              // Execute the update
              const updateResult = await updateCalculationDao(
                {
                  id: calculation.id,
                  company_id,
                },
                updatePayload,
                conn,
              );

              if (updateResult) {
                updatedCount++;
                logger.info(
                  `Successfully updated calculation ID: ${calculation.id} for user_id: ${user_id} on date: ${processDate}`,
                );
              }
            }
          } else {
            logger.warn(
              `No calculations found for user_id: ${user_id} on date: ${processDate}`,
            );
          }
        } catch (dateError) {
          logger.error(
            `Error processing calculations for user_id: ${user_id} on date: ${processDate}:`,
            dateError,
          );
          // Continue processing other dates for this user
        }
      }

      processedUsers.push(user_id);
      logger.info(`Completed processing all dates for user_id: ${user_id}`);
    } catch (userError) {
      logger.error(
        `Error processing calculations for user_id: ${user_id}:`,
        userError,
      );
      failedUsers.push({
        user_id,
        reason: userError.message || 'Processing error',
      });
    }

    return {
      updated_count: updatedCount,
      processed_users: processedUsers,
      failed_users: failedUsers,
      date_range: {
        start: calculationStartDate,
        end: calculationEndDate,
      },
      original_date_requested: date,
      total_users_requested: 1,
      success_rate: `${processedUsers.length}/1`,
      message: `Successfully recalculated and updated calculations for user ${user_id} from ${calculationStartDate} to ${calculationEndDate}. ${updatedCount} total calculation records updated with fresh transaction data.`,
      // processing_details: {
      //   date_range: {
      //     start: calculationStartDate,
      //     end: calculationEndDate,
      //     timezone: 'Asia/Kolkata (IST)',
      //     logic_applied: date
      //       ? dayjs(date)
      //           .tz('Asia/Kolkata')
      //           .isSame(dayjs().tz('Asia/Kolkata'), 'day')
      //         ? 'Current date provided: calculated T-1 and current date (IST timezone)'
      //         : 'Past date provided: calculated from T-1 of provided date until current date (IST timezone)'
      //       : 'No specific date provided: calculated T-1 and current date (IST timezone)',
      //   },
      //   calculation_method: 'real_time_database_aggregation_per_date',
      //   // data_sources: [
      //   //   'Payin transactions (SUCCESS status)',
      //   //   'Payout transactions (SUCCESS/REVERSED status)',
      //   //   'Settlement transactions (SUCCESS/COMPLETED status)',
      //   //   'Chargeback transactions (APPROVED status)',
      //   //   'Adjustment transactions (APPROVED status)',
      //   // ],
      //   // fields_updated: [
      //   //   'updated_at',
      //   //   'total_payin_count',
      //   //   'total_payin_amount',
      //   //   'total_payin_commission',
      //   //   'total_payout_count',
      //   //   'total_payout_amount',
      //   //   'total_payout_commission',
      //   //   'total_settlement_count',
      //   //   'total_settlement_amount',
      //   //   'total_settlement_commission',
      //   //   'total_chargeback_count',
      //   //   'total_chargeback_amount',
      //   //   'total_reverse_payout_count',
      //   //   'total_reverse_payout_amount',
      //   //   'total_reverse_payout_commission',
      //   //   'total_adjustment_count',
      //   //   'total_adjustment_amount',
      //   //   'total_adjustment_commission',
      //   //   'current_balance',
      //   //   'net_balance',
      //   //   'config',
      //   // ],
      //   balance_calculation_formula: {
      //     base_calculation:
      //       'payin_amount - payout_amount - (payin_commission - payout_commission + reverse_payout_commission) - chargeback_amount + reverse_payout_amount',
      //     current_balance_merchant: 'base_calculation + settlement_amount',
      //     current_balance_vendor: 'base_calculation - settlement_amount',
      //     net_balance: 'previous_net_balance + balance_change',
      //   },
      // },
    };
  } catch (error) {
    logger.error('Error in updateCalculationsService:', error);
    throw error;
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
