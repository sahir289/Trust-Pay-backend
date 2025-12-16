import { logger } from './logger.js';
import { getCalculationforCronDao } from '../apis/calculation/calculationDao.js';
import { getVendorsDao } from '../apis/vendors/vendorDao.js';
import { getBankaccountDao, updateBankaccountDao } from '../apis/bankAccounts/bankaccountDao.js';

/**
 * Update bank account to disable it when net balance exceeds limit
 * @param {Object} bank - Bank account object
 * @param {string} user_id - User ID
 * @param {number} currentNetBalance - Current net balance
 * @param {number} netBalanceLimit - Net balance limit
 */
const disableBankAccount = async (bank, user_id, currentNetBalance, netBalanceLimit) => {
  try {
    const configUpdate = {
      merchants: [],
      disabled_reason: 'Net balance exceeded limit',
      disabled_at: new Date().toISOString(),
      previous_net_balance: currentNetBalance,
      net_balance_limit: netBalanceLimit,
    };

    await updateBankaccountDao(
      { id: bank.id, company_id: bank.company_id },
      {
        is_enabled: false,
        updated_by: user_id,
        config: { ...bank.config, ...configUpdate },
      },
    );

    return { success: true };
  } catch (error) {
    // Handle lock conflicts gracefully
    if (error.code === '55P03' || error.message?.includes('could not obtain lock')) {
      logger.warn(`Bank ${bank.nick_name} locked by another transaction, skipping`);
      return { success: false, reason: 'locked' };
    }
    throw error;
  }
};

/**
 * Track vendor's net balance and disable bank accounts if balance exceeds configured limit
 * @param {string} user_id - The vendor's user ID
 * @param {Object} calculationData - Pre-fetched calculation data (optional, will query if not provided)
 * @returns {Object} - Result object containing status and details
 */
export const trackVendorsNetBalance = async (user_id, calculationData = null) => {
  try {
    logger.info(`Starting net balance tracking for user_id: ${user_id}`);

    // Get vendor details to check the configured net_balance limit
    const vendors = await getVendorsDao({ user_id });
    if (!vendors || vendors.length === 0) {
      logger.warn(`No vendor found for user_id: ${user_id}`);
      return { success: false, message: 'Vendor not found', user_id };
    }

    // Get calculation data (use provided data if available, otherwise query)
    let calculations;
    if (calculationData && Array.isArray(calculationData)) {
      calculations = calculationData;
    } else if (calculationData && calculationData.id) {
      calculations = [calculationData];
    } else {
      calculations = await getCalculationforCronDao(user_id);
    }

    if (!calculations || calculations.length === 0) {
      logger.warn(`No calculation data found for user_id: ${user_id}`);
      return { success: false, message: 'No calculation data found', user_id };
    }

    const currentNetBalance = parseFloat(calculations[0].net_balance);
    const vendor = vendors[0];

    // Parse vendor config to get net balance limit
    let vendorConfig = {};
    try {
      if (vendor.config && typeof vendor.config === 'string') {
        vendorConfig = JSON.parse(vendor.config);
      } else if (vendor.config && typeof vendor.config === 'object') {
        vendorConfig = vendor.config;
      }
    } catch (parseError) {
      logger.warn(`Failed to parse vendor config for user_id ${user_id}:`, parseError);
      vendorConfig = {};
    }

    const netBalanceLimit = parseFloat(vendorConfig.net_balance) || 0;

    logger.info(`Current net balance for user_id ${user_id}: ${currentNetBalance}`);
    logger.info(`Net balance limit for vendor ${vendor.code}: ${netBalanceLimit}`);

    // Check if limit is configured
    if (netBalanceLimit === 0) {
      logger.info(`No net balance limit configured for vendor ${vendor.code}`);
      return {
        success: true,
        message: 'No net balance limit configured',
        user_id,
        vendor_code: vendor.code,
        current_balance: currentNetBalance,
        limit: netBalanceLimit,
      };
    }

    // Check if current balance is within limit
    if (currentNetBalance <= netBalanceLimit) {
      logger.info(`Net balance ${currentNetBalance} is within limit ${netBalanceLimit} for vendor ${vendor.code}`);
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

    // Balance exceeded - disable bank accounts
    logger.warn(`Net balance ${currentNetBalance} exceeds limit ${netBalanceLimit} for vendor ${vendor.code}. Disabling bank accounts.`);

    // Get all payin bank accounts for this vendor
    const bankAccounts = await getBankaccountDao({ user_id, bank_used_for: 'PayIn' });
    
    if (!bankAccounts || bankAccounts.length === 0) {
      logger.info(`No bank accounts found for vendor ${vendor.code}`);
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

    logger.info(`Found ${bankAccounts.length} bank accounts for vendor ${vendor.code}`);

    // Disable all enabled bank accounts
    const disabledBanks = [];
    const skippedBanks = [];

    for (const bank of bankAccounts) {
      if (!bank.is_enabled) {
        logger.info(`Bank account ${bank.nick_name} is already disabled`);
        skippedBanks.push({ bank_id: bank.id, nick_name: bank.nick_name, reason: 'already_disabled' });
        continue;
      }

      try {
        const result = await disableBankAccount(bank, user_id, currentNetBalance, netBalanceLimit);
        
        if (result.success) {
          disabledBanks.push({ bank_id: bank.id, nick_name: bank.nick_name });
          logger.info(`Successfully disabled bank account ${bank.nick_name} for vendor ${vendor.code}`);
        } else {
          skippedBanks.push({ bank_id: bank.id, nick_name: bank.nick_name, reason: result.reason });
          logger.warn(`Skipped bank account ${bank.nick_name}: ${result.reason}`);
        }
      } catch (error) {
        logger.error(`Failed to disable bank account ${bank.nick_name}:`, error);
        skippedBanks.push({ bank_id: bank.id, nick_name: bank.nick_name, reason: 'error', error: error.message });
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
      skipped_banks: skippedBanks,
    };

    if (disabledBanks.length > 0) {
      logger.warn(`Disabled ${disabledBanks.length} bank accounts for vendor ${vendor.code} - net balance ${currentNetBalance} exceeds limit ${netBalanceLimit}`);
    }

    return result;
  } catch (error) {
    logger.error(`Error in trackVendorsNetBalance for user_id ${user_id}:`, error);
    throw error;
  }
};

export default {
  trackVendorsNetBalance,
};
