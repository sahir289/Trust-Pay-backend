// Importing DAO functions for database operations
import {
  createCalculationDao,
  updateCalculationDao,
  deleteCalculationDao,
  getCalculationsSumDao,
  getCalculationDao,
  calculateSettlementDataDao,
  calculatePayinDataDao,
  calculatePayoutDataDao,
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
import { getPayInsForSuccessRatioDao } from '../../apis/payIn/payInDao.js';
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
    const allPayins = await getPayInsForSuccessRatioDao({
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
        const baselineDate = dayjs(calculationStartDate)
          .tz('Asia/Kolkata')
          .subtract(1, 'day')
          .format('YYYY-MM-DD');

        logger.info(
          `Looking for baseline calculation on date: ${baselineDate}`,
        );

        const baselineCalculations = await getCalculationsSumDao({
          company_id,
          users: user_id,
          startDate: baselineDate,
          endDate: baselineDate,
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

          if (
            sortedBaseline.length > 0 &&
            sortedBaseline[0]?.net_balance !== undefined &&
            sortedBaseline[0]?.net_balance !== null
          ) {
            const baselineNetBalance = parseFloat(
              sortedBaseline[0].net_balance || 0,
            );
            // Check if the parsed value is a valid number
            if (!isNaN(baselineNetBalance) && isFinite(baselineNetBalance)) {
              runningNetBalance = baselineNetBalance;
              logger.info(
                `Starting with baseline net balance: ${runningNetBalance} from calculation ID: ${sortedBaseline[0].id} on date: ${baselineDate}`,
              );
            } else {
              logger.warn(
                `Invalid baseline net balance found (${sortedBaseline[0].net_balance}) on date: ${baselineDate}, starting with 0`,
              );
              runningNetBalance = 0;
            }
          } else {
            logger.info(
              `No valid baseline calculation found for user ${user_id} on date: ${baselineDate}, starting with 0`,
            );
            runningNetBalance = 0;
          }
        } else {
          logger.info(
            `No baseline calculations found for user ${user_id} on date: ${baselineDate}, starting with 0`,
          );
          runningNetBalance = 0;
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
                const calcDate = calc.date
                  ? dayjs(calc.date)
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
                const calcDate = calc.date
                  ? dayjs(calc.date)
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
              // Skip if calculation is missing essential properties
              if (!calculation || !calculation.id) {
                logger.warn(
                  `Skipping invalid calculation for user_id: ${user_id} on date: ${processDate} - missing calculation data`,
                );
                continue;
              }

              // Get actual transaction data from database using DAO functions for this specific date
              // First get settlement data - exclude reverse settlements for vendor role but keep internal ones
              const settlementData = await calculateSettlementDataDao(
                user_id,
                company_id,
                processDate,
                role, // Pass role to determine settlement calculation logic
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

              // Validate that we have valid transaction data before proceeding
              if (
                !payinData ||
                !payoutData ||
                !settlementData ||
                !chargebackData ||
                !adjustmentData
              ) {
                logger.warn(
                  `Missing transaction data for user_id: ${user_id} on date: ${processDate}, skipping calculation update`,
                );
                continue;
              }

              // Helper function to safely convert to number and handle NaN
              const safeNumber = (value) => {
                const num = parseFloat(value || 0);
                const result = isNaN(num) || !isFinite(num) ? 0 : num;
                // Round to 2 decimal places to avoid floating-point precision issues
                return Math.round(result * 100) / 100;
              };

              // Calculate current balance based on actual data - ensure all values are valid numbers
              const payinAmount = safeNumber(payinData.total_payin_amount);
              const payoutAmount = safeNumber(payoutData.total_payout_amount);
              const payinCommission = safeNumber(
                payinData.total_payin_commission,
              );
              const payoutCommission = safeNumber(
                payoutData.total_payout_commission,
              );
              const reversePayoutCommission = safeNumber(
                payoutData.total_reverse_payout_commission,
              );
              const chargebackAmount = safeNumber(
                chargebackData.total_chargeback_amount,
              );
              const reversePayoutAmount = safeNumber(
                payoutData.total_reverse_payout_amount,
              );
              const settlementAmount = safeNumber(
                settlementData.total_settlement_amount,
              );
              const adjustmentAmount = safeNumber(
                adjustmentData.total_adjustment_amount,
              );

              // Determine if user is merchant or vendor based on role
              const isMerchant = role === Role.MERCHANT;

              const merchantBaseCalculation =
                Math.round(
                  (payinAmount -
                    payoutAmount -
                    (payinCommission -
                      payoutCommission +
                      reversePayoutCommission) -
                    chargebackAmount +
                    reversePayoutAmount +
                    adjustmentAmount) *
                    100,
                ) / 100; // Round to 2 decimal places to handle floating-point precision
              const vendorBaseCalculation =
                Math.round(
                  (-payinAmount +
                    payoutAmount +
                    (payinCommission +
                      payoutCommission -
                      reversePayoutCommission) +
                    chargebackAmount -
                    reversePayoutAmount -
                    adjustmentAmount) *
                    100,
                ) / 100; // Round to 2 decimal places to handle floating-point precision
              const calculatedCurrentBalance =
                Math.round(
                  (isMerchant
                    ? merchantBaseCalculation + settlementAmount
                    : vendorBaseCalculation - settlementAmount) * 100,
                ) / 100; // Round to 2 decimal places

              // Ensure calculatedCurrentBalance is a valid number
              const safeCalculatedCurrentBalance = safeNumber(
                calculatedCurrentBalance,
              );

              // Calculate net balance using running total approach
              // Current balance represents the day's balance change
              // Net balance is the cumulative balance (previous net balance + current day's balance)
              const balanceChange = safeCalculatedCurrentBalance;
              const calculatedNetBalance = safeNumber(
                runningNetBalance + balanceChange,
              );

              // Update the running balance for the next iteration
              runningNetBalance = calculatedNetBalance;

              logger.info(
                `Updated calculation for ${processDate}: Current Balance: ${safeCalculatedCurrentBalance}, Net Balance: ${calculatedNetBalance}`,
              );

              // Prepare comprehensive update payload with recalculated values
              const updatePayload = {
                // Update timestamp (IST timezone)
                updated_at: dayjs().tz('Asia/Kolkata').toDate(),

                // Core calculation fields - use actual calculated values from database with safe numbers
                total_payin_count: safeNumber(payinData.total_payin_count),
                total_payin_amount: payinAmount,
                total_payin_commission: payinCommission,

                total_payout_count: safeNumber(payoutData.total_payout_count),
                total_payout_amount: payoutAmount,
                total_payout_commission: payoutCommission,

                total_settlement_count: safeNumber(
                  settlementData.total_settlement_count,
                ),
                total_settlement_amount: settlementAmount,
                total_settlement_commission: safeNumber(
                  settlementData.total_settlement_commission,
                ),

                total_chargeback_count: safeNumber(
                  chargebackData.total_chargeback_count,
                ),
                total_chargeback_amount: chargebackAmount,

                total_reverse_payout_count: safeNumber(
                  payoutData.total_reverse_payout_count,
                ),
                total_reverse_payout_amount: reversePayoutAmount,
                total_reverse_payout_commission: reversePayoutCommission,

                total_adjustment_count: safeNumber(
                  adjustmentData.total_adjustment_count,
                ),
                total_adjustment_amount: safeNumber(
                  adjustmentData.total_adjustment_amount,
                ),
                total_adjustment_commission: safeNumber(
                  adjustmentData.total_adjustment_commission,
                ),

                // Calculated balances - ensure they are valid numbers
                current_balance: safeCalculatedCurrentBalance,
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
                      current_balance: safeNumber(calculation.current_balance),
                      net_balance: safeNumber(calculation.net_balance),
                      total_payin_count: safeNumber(
                        calculation.total_payin_count,
                      ),
                      total_payout_count: safeNumber(
                        calculation.total_payout_count,
                      ),
                      total_settlement_count: safeNumber(
                        calculation.total_settlement_count,
                      ),
                    },
                    recalculated_values: {
                      current_balance: safeCalculatedCurrentBalance,
                      net_balance: calculatedNetBalance,
                      balance_change: balanceChange,
                      baseline_net_balance_used:
                        runningNetBalance - balanceChange,
                    },
                    reversed_internal_settlements: {
                      count: safeNumber(
                        settlementData.reversed_internal_settlements.count,
                      ),
                      amount: safeNumber(
                        settlementData.reversed_internal_settlements.amount,
                      ),
                      commission: safeNumber(
                        settlementData.reversed_internal_settlements.commission,
                      ),
                      note:
                        role === Role.VENDOR
                          ? 'For vendor role: internal settlements are kept in settlements, reverse settlements excluded from calculations'
                          : 'Reversed internal settlements added to payin calculations instead of subtracted from settlements',
                    },
                    calculation_note:
                      'Fixed balance calculation: current_balance represents daily balance, net_balance is cumulative (previous_net_balance + daily_balance)',
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

// Exporting services for use in other modules
export {
  calculateSuccessRatiosService,
  getCalculationService,
  createCalculationService,
  updateCalculationService,
  updateCalculationsService,
  deleteCalculationService,
};
