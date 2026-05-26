import { getSettingDao } from '../apis/settings/settingsDao.js';
import { AuthenticationError } from '../utils/appErrors.js';
import { logger } from '../utils/logger.js';

/**
 * Middleware to enforce 2FA setup if global enforcement is enabled.
 * Exempts 2FA setup/confirm routes to allow users to enable 2FA.
 */
export const enforce2FAMiddleware = async (req, res, next) => {
  try {
    // Exempt routes that are part of the 2FA setup process
    const exemptedPaths = [
      '/v1/2fa/setup',
      '/v1/2fa/confirm',
      '/v1/auth/logout',
      '/v1/auth/verify-2fa',
      '/v1/settings/2fa-enforcement', // Allow fetching status
    ];

    if (exemptedPaths.some(path => req.originalUrl.startsWith(path))) {
      return next();
    }

    const setting = await getSettingDao('2fa_enforcement');
    const isEnforced = setting?.enforced || false;

    if (isEnforced) {
      const { is_two_factor_enabled } = req.user;
      
      if (!is_two_factor_enabled) {
        logger.warn(`User ${req.user.user_name} blocked: 2FA setup required.`);
        throw new AuthenticationError('2FA setup required before accessing this resource');
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};
