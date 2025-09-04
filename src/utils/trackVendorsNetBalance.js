import { logger } from './logger.js';
import { getCalculationforCronDao } from '../apis/calculation/calculationDao.js';
import { getVendorsDao } from '../apis/vendors/vendorDao.js';
import {
  getBankaccountDao,
  updateBankaccountDao,
} from '../apis/bankAccounts/bankaccountDao.js';

/**
 * Track vendor's net balance and disable bank accounts if balance exceeds configured limit
 * @param {string} user_id - The vendor's user ID
 * @returns {Object} - Result object containing status and details
 */
export const trackVendorsNetBalance = async (user_id) => {
  try {
    logger.info(`Starting net balance tracking for user_id: ${user_id}`);

    // Step 1: Get vendor details to check the configured net_balance limit
    const vendors = await getVendorsDao({ user_id });

    if (!vendors || vendors.length === 0) {
      logger.warn(`No vendor found for user_id: ${user_id}`);
      return {
        success: false,
        message: 'Vendor not found',
        user_id,
      };
    }

    // Step 2: Get the latest calculation entry for the user
    const calculations = await getCalculationforCronDao(user_id);

    if (!calculations || calculations.length === 0) {
      logger.warn(`No calculation data found for user_id: ${user_id}`);
      return {
        success: false,
        message: 'No calculation data found for user',
        user_id,
      };
    }

    const currentNetBalance = parseFloat(calculations[0].net_balance);
    logger.info(
      `Current net balance for user_id ${user_id}: ${currentNetBalance}`,
    );

    const vendor = vendors[0];
    let vendorConfig = {};

    // Parse vendor config if it exists
    try {
      if (vendor.config && typeof vendor.config === 'string') {
        vendorConfig = JSON.parse(vendor.config);
      } else if (vendor.config && typeof vendor.config === 'object') {
        vendorConfig = vendor.config;
      }
    } catch (parseError) {
      logger.warn(
        `Failed to parse vendor config for user_id ${user_id}:`,
        parseError,
      );
      vendorConfig = {};
    }

    const netBalanceLimit = parseFloat(vendorConfig.net_balance) || 0;

    if (netBalanceLimit === 0) {
      logger.info(
        `No net balance limit configured for vendor ${vendor.code} (user_id: ${user_id})`,
      );
      return {
        success: true,
        message: 'No net balance limit configured',
        user_id,
        vendor_code: vendor.code,
        current_balance: currentNetBalance,
        limit: netBalanceLimit,
      };
    }

    logger.info(
      `Net balance limit for vendor ${vendor.code}: ${netBalanceLimit}`,
    );

    // Step 3: Check if current net balance exceeds the limit
    if (currentNetBalance <= netBalanceLimit) {
      logger.info(
        `Net balance ${currentNetBalance} is within limit ${netBalanceLimit} for vendor ${vendor.code}`,
      );
      return {
        success: true,
        message: 'Net balance is within limit',
        user_id,
        vendor_code: vendor.code,
        current_balance: currentNetBalance,
        limit: netBalanceLimit,
        exceeded: false,
      };
    }

    logger.warn(
      `Net balance ${currentNetBalance} exceeds limit ${netBalanceLimit} for vendor ${vendor.code}. Proceeding to disable bank accounts.`,
    );

    // Step 4: Get all bank accounts for this vendor
    const bankAccounts = await getBankaccountDao({ user_id });

    if (!bankAccounts || bankAccounts.length === 0) {
      logger.info(
        `No bank accounts found for vendor ${vendor.code} (user_id: ${user_id})`,
      );
      return {
        success: true,
        message: 'Net balance exceeded but no bank accounts found',
        user_id,
        vendor_code: vendor.code,
        current_balance: currentNetBalance,
        limit: netBalanceLimit,
        exceeded: true,
        banks_disabled: 0,
      };
    }

    logger.info(
      `Found ${bankAccounts.length} bank accounts for vendor ${vendor.code}`,
    );

    // Step 5: Disable all bank accounts by setting is_enabled to false
    const disabledBanks = [];
    const failedBanks = [];

    for (const bank of bankAccounts) {
      try {
        if (bank.is_enabled) {
          // Update the bank account to disable it
          await updateBankaccountDao(
            { id: bank.id, company_id: bank.company_id },
            {
              is_enabled: false,
              updated_by: user_id, // Use the vendor's user_id as the updater
              config: {
                ...bank.config,
                merchants: [], // Clear merchants array when disabling
                disabled_reason: 'Net balance exceeded limit',
                disabled_at: new Date().toISOString(),
                previous_net_balance: currentNetBalance,
                net_balance_limit: netBalanceLimit,
              },
            },
          );

          disabledBanks.push({
            bank_id: bank.id,
            nick_name: bank.nick_name,
            bank_name: bank.bank_name,
          });

          logger.info(
            `Disabled bank account ${bank.nick_name} (ID: ${bank.id}) for vendor ${vendor.code}`,
          );
        } else {
          logger.info(
            `Bank account ${bank.nick_name} (ID: ${bank.id}) is already disabled`,
          );
        }
      } catch (bankError) {
        logger.error(
          `Failed to disable bank account ${bank.nick_name} (ID: ${bank.id}):`,
          bankError,
        );
        failedBanks.push({
          bank_id: bank.id,
          nick_name: bank.nick_name,
          error: bankError.message,
        });
      }
    }

    const result = {
      success: true,
      message: 'Net balance tracking completed',
      user_id,
      vendor_code: vendor.code,
      current_balance: currentNetBalance,
      limit: netBalanceLimit,
      exceeded: true,
      total_banks: bankAccounts.length,
      banks_disabled: disabledBanks.length,
      disabled_banks: disabledBanks,
      failed_banks: failedBanks,
    };

    if (disabledBanks.length > 0) {
      logger.warn(
        `Successfully disabled ${disabledBanks.length} bank accounts for vendor ${vendor.code} due to net balance (${currentNetBalance}) exceeding limit (${netBalanceLimit})`,
      );
    }

    if (failedBanks.length > 0) {
      logger.error(
        `Failed to disable ${failedBanks.length} bank accounts for vendor ${vendor.code}`,
      );
    }

    return result;
  } catch (error) {
    logger.error(
      `Error in trackVendorsNetBalance for user_id ${user_id}:`,
      error,
    );
    return {
      success: false,
      message: 'Error occurred while tracking net balance',
      user_id,
      error: error.message,
    };
  }
};

export default {
  trackVendorsNetBalance,
};
