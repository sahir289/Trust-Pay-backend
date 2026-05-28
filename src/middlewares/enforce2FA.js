import { getSettingDao } from '../apis/settings/settingsDao.js';
import { AuthenticationError } from '../utils/appErrors.js';
import { logger } from '../utils/logger.js';

/**
 * Middleware to enforce 2FA setup if global enforcement is enabled.
 * Exempts 2FA setup/confirm routes to allow users to enable 2FA.
 * Blocks ALL other activities until user enables 2FA.
 */
export const enforce2FAMiddleware = async (req, res, next) => {
  try {
    // Exempt routes that are part of the 2FA setup process and essential auth routes
    const exemptedPaths = [
      '/v1/2fa/setup',
      '/v1/2fa/confirm',
      '/v1/auth/logout',
      '/v1/auth/verify-2fa',
      '/v1/system-settings/2fa-enforcement', // Allow fetching status
    ];

    // Allow exempted paths to proceed
    if (exemptedPaths.some(path => req.originalUrl.startsWith(path))) {
      return next();
    }

    // Fetch the global 2FA enforcement setting (correct key: 'two_factor_enforcement')
    const setting = await getSettingDao('two_factor_enforcement');
    const isEnforced = setting?.enabled || false;

    // If global 2FA enforcement is enabled, check if user has 2FA enabled
    if (isEnforced) {
      const { is_two_factor_enabled } = req.user;
      
      if (!is_two_factor_enabled) {
        logger.warn(`User ${req.user.user_name} (ID: ${req.user.user_id}) blocked: Global 2FA enforcement is active and user has not enabled 2FA.`);
        throw new AuthenticationError(
          'Global 2FA enforcement is active. You must enable Two-Factor Authentication to access this resource. Please set up 2FA from your account settings.'
        );
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};
