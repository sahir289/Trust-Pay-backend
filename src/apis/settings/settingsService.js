import { getSettingDao, updateSettingDao } from './settingsDao.js';
import { logger } from '../../utils/logger.js';

/**
 * Get the global 2FA enforcement setting
 * @returns {Promise<boolean>} Whether 2FA is globally enforced
 */
export const get2FAEnforcementService = async () => {
  try {
    const setting = await getSettingDao('two_factor_enforcement');
    return setting?.enabled || false;
  } catch (error) {
    logger.error('Error getting 2FA enforcement setting:', error);
    // Default to false if there's an error
    return false;
  }
};

/**
 * Update the global 2FA enforcement setting
 * @param {boolean} enabled - Whether to enable global 2FA enforcement
 * @returns {Promise<Object>} The updated setting
 */
export const update2FAEnforcementService = async (enabled) => {
  try {
    const updatedSetting = await updateSettingDao('two_factor_enforcement', { enabled });
    return updatedSetting;
  } catch (error) {
    logger.error('Error updating 2FA enforcement setting:', error);
    throw error;
  }
};
