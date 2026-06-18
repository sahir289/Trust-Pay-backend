import { get2FAEnforcementDao } from '../apis/settings/settingsDao.js';
import { AuthenticationError } from '../utils/appErrors.js';
import { logger } from '../utils/logger.js';

/**
 * Middleware to enforce 2FA setup if company-level enforcement is enabled.
 * Exempts 2FA setup/confirm routes to allow users to enable 2FA.
 * Blocks ALL other activities until user enables 2FA.
 */
export const enforce2FAMiddleware = async (req, res, next) => {
  try {
    // Exempt routes that are part of the 2FA setup process and essential auth routes
    const EXEMPT_PATHS = [
      '/v1/2fa/setup',                       // actual 2FA setup endpoint
      '/v1/2fa/confirm',                     // actual 2FA confirm endpoint
      '/v1/2fa/disable',                     // allow disabling 2FA
      '/v1/auth/2fa/verify',                 // 2FA login verification
      '/v1/auth/verify-2fa',                 // alternative 2FA login verification
      '/v1/users/',                          // needed for profile fetch on load
      '/v1/system-settings/2fa-enforcement', // needed for frontend to check enforcement status
      '/v1/auth/logout',                     // allow logout
    ];

    // Check if current path is exempt
    const isExempt = EXEMPT_PATHS.some(path => req.originalUrl.includes(path));
    
    // Allow exempted paths to proceed
    if (isExempt) {
      return next();
    }

    // Fetch the company-level 2FA enforcement setting
    const enforcementActive = await get2FAEnforcementDao(req.user.company_id);

    // If company 2FA enforcement is enabled, check if user has 2FA enabled
    // Skip enforcement if user is explicitly exempt
    if (enforcementActive && !req.user.is_two_factor_enabled && !req.user.is_two_factor_exempt) {
      logger.warn(`User ${req.user.user_name} (ID: ${req.user.user_id}) blocked: Company 2FA enforcement is active and user has not enabled 2FA.`);
      throw new AuthenticationError(
        'Company 2FA enforcement is active. You must enable Two-Factor Authentication to access this resource. Please set up 2FA from your account settings.'
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};
