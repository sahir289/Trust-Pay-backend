import { get2FAEnforcementDao } from '../apis/settings/settingsDao.js';
import { ForbiddenError } from '../utils/appErrors.js';
import { logger } from '../utils/logger.js';
import { Role } from '../constants/index.js';

/**
 * Middleware to enforce 2FA setup if company-level enforcement is enabled.
 * Exempts 2FA setup/confirm routes to allow users to enable 2FA.
 * Exempts specific roles from 2FA enforcement (e.g., SUPER_ADMIN, BOT).
 * Blocks ALL other activities until user enables 2FA.
 */
export const enforce2FAMiddleware = async (req, res, next) => {
  try {
    // Exempt routes that are part of the 2FA setup process and essential auth routes
    const EXEMPT_PATHS = [
      '/v1/auth/',                           // Essential auth routes
      '/v1/2fa/setup',                       // actual 2FA setup endpoint
      '/v1/2fa/confirm',                     // actual 2FA confirm endpoint
      '/v1/2fa/disable',                     // allow disabling 2FA
      '/v1/2fa/enable',                      // allow enabling 2FA
      '/v1/2fa/verify',                      // allow verifying 2FA codes
      '/v1/system-settings/2fa-enforcement', // needed for frontend to check enforcement status
      '/v1/users/',                          // allow users to fetch their profile data (needed for 2FA setup flow)
    ];

    // Roles that are exempt from 2FA enforcement
    // SUPER_ADMIN: System administrators who manage the platform
    // BOT: Automated system accounts
    const EXEMPT_ROLES = [
      Role.SUPER_ADMIN,
      Role.BOT,
      Role.MERCHANT_OPERATIONS,              // Operator roles are exempt from 2FA enforcement
      Role.VENDOR_OPERATIONS,
    ];

    // Check if current path is exempt using startsWith to correctly handle dynamic segments
    const isExempt = EXEMPT_PATHS.some(p => req.originalUrl.startsWith(p));

    console.log('[enforce2FA] path:', req.originalUrl, '| exempt?', isExempt, '| role:', req.user?.designation);
    console.log('[enforce2FA] company_id:', req.user?.company_id, '| user:', req.user?.user_name);

    // Allow exempted paths to proceed
    if (isExempt) {
      return next();
    }

    // Check if user's role is exempt from 2FA enforcement
    if (req.user?.designation && EXEMPT_ROLES.includes(req.user.designation)) {
      logger.info(`User ${req.user.user_name} (Role: ${req.user.designation}) is exempt from 2FA enforcement by role`);
      return next();
    }

    // If no company_id, we cannot determine enforcement — allow through to prevent 500 errors
    if (!req.user?.company_id) {
      logger.info(`User ${req.user?.user_name} has no company_id, skipping 2FA enforcement`);
      return next();
    }

    // Fetch the company-level 2FA enforcement setting safely
    let enforcementActive = false;
    try {
      enforcementActive = await get2FAEnforcementDao(req.user.company_id);
    } catch (daoError) {
      // If we can't fetch the setting, fail open (don't block the user)
      logger.warn(`Could not fetch 2FA enforcement setting for company ${req.user.company_id}: ${daoError.message}`);
      return next();
    }

    // If company 2FA enforcement is enabled, check if user has 2FA enabled
    // Skip enforcement if user is explicitly exempt
    if (enforcementActive && !req.user.is_two_factor_enabled && !req.user.is_two_factor_exempt) {
      logger.warn(`User ${req.user.user_name} (ID: ${req.user.user_id}) blocked: Company 2FA enforcement is active and user has not enabled 2FA.`);
      throw new ForbiddenError(
        '2FA setup required. Please enable two-factor authentication to continue.'
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};
