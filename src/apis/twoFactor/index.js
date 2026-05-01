import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import {
  setup2FAController,
  confirm2FAController,
  disable2FAController,
} from '../auth/authController.js';
import { isAuthenticated } from '../../middlewares/auth.js';

const router = express.Router();

// All 2FA management routes require a valid session token.
router.use(isAuthenticated);

/**
 * POST /2fa/setup
 * Generates a TOTP secret + QR code data URL.
 * The secret is saved but 2FA is NOT yet enabled.
 * Frontend should display the QR code and prompt the user to scan it,
 * then call /2fa/confirm to activate.
 */
router.post('/setup', tryCatchHandler(setup2FAController));

/**
 * POST /2fa/confirm
 * Body: { otpToken }
 * Verifies the first OTP after scanning the QR code.
 * Enables 2FA on the account once confirmed.
 */
router.post('/confirm', tryCatchHandler(confirm2FAController));

/**
 * POST /2fa/disable
 * Body: { otpToken }
 * Verifies the current OTP then disables 2FA and clears the secret.
 */
router.post('/disable', tryCatchHandler(disable2FAController));

export default router;
