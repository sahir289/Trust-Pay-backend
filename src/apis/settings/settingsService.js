import { get2FAEnforcementDao, update2FAEnforcementDao } from './settingsDao.js';
import { logger } from '../../utils/logger.js';

/**
 * Get the company-level 2FA enforcement setting
 * @param {number} company_id - The company ID
 * @returns {Promise<Object>} Object with enabled boolean
 */
export const get2FAEnforcementService = async (company_id) => {
  try {
    const enabled = await get2FAEnforcementDao(company_id);
    return { enabled };
  } catch (error) {
    logger.error('Error getting 2FA enforcement setting:', error);
    // Default to false if there's an error
    return { enabled: false };
  }
};

/**
 * Update the company-level 2FA enforcement setting
 * @param {number} company_id - The company ID
 * @param {boolean} enabled - Whether to enable 2FA enforcement
 * @returns {Promise<Object>} Object with enabled boolean
 */
export const update2FAEnforcementService = async (company_id, enabled) => {
  try {
    await update2FAEnforcementDao(company_id, enabled);
    return { enabled };
  } catch (error) {
    logger.error('Error updating 2FA enforcement setting:', error);
    throw error;
  }
};
