import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import {
  get2FAEnforcementController,
  update2FAEnforcementController,
} from './settingsController.js';
import { isAuthenticated, authorized } from '../../middlewares/auth.js';
import { Role } from '../../constants/index.js';

const router = express.Router();

router.use(isAuthenticated);

/**
 * GET /v1/system-settings/2fa-enforcement
 * Fetches the current global 2FA enforcement status.
 */
router.get('/2fa-enforcement', tryCatchHandler(get2FAEnforcementController));

/**
 * POST /v1/system-settings/2fa-enforcement
 * Updates the global 2FA enforcement status.
 * Only ADMIN can toggle this.
 */
router.post('/2fa-enforcement', authorized([Role.ADMIN]), tryCatchHandler(update2FAEnforcementController));

export default router;
