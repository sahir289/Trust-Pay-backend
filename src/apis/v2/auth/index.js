import express from 'express';
import tryCatchHandler from '../../../utils/tryCatchHandler.js';
import { adaptResponseToV2 } from '../../../utils/v2ResponseAdapter.js';
import {
  loginController,
  logoutController,
  refreshTokenController,
  verificationController,
  changePasswordController,
  verfyUserController,
  verfyOtpController,
  forgetPasswordController,
  getUserRoleController,
  verifyLoginOtpController,
} from '../../auth/authController.js';
import { isAuthenticated } from '../../../middlewares/auth.js';
import { geoLocationGuard } from '../../../middlewares/loginLocationRestrict.js';
import {
  authApiRateLimiter,
  loginBruteGuard,
  verify2faBruteGuard,
} from '../../../middlewares/authRateLimiter.js';

const router = express.Router();

// V2 auth reuses the V1 controllers verbatim — same services, same brute-force
// counters, same refresh-token cookies, same 2FA gating — and only adapts the
// success envelope to V2 via `adaptResponseToV2`. Failures throw and are shaped
// by the v2ErrorHandler. The V1 auth controllers/routes stay untouched.
const v2 = (controller) =>
  tryCatchHandler((req, res) => controller(req, adaptResponseToV2(res)));

// Same dedicated, stricter per-IP rate limiting as V1 (shared limiter instance,
// so the budget cannot be bypassed by switching versions).
router.use(authApiRateLimiter);

router.post('/login', geoLocationGuard, loginBruteGuard, v2(loginController));
router.post('/verify-2fa', verify2faBruteGuard, v2(verifyLoginOtpController));
router.post('/refresh-token', v2(refreshTokenController));
router.get('/get-user-role', v2(getUserRoleController));
router.post('/logout', isAuthenticated, v2(logoutController));
router.post('/otp_verification', geoLocationGuard, v2(verfyOtpController));
router.post('/reset_password', geoLocationGuard, v2(forgetPasswordController));
router.post('/user_verification', geoLocationGuard, v2(verfyUserController));
router.post('/change-password', isAuthenticated, v2(changePasswordController));
router.post('/password-verification', isAuthenticated, v2(verificationController));

export default router;
