import { get2FAEnforcementService, update2FAEnforcementService } from './settingsService.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { BadRequestError } from '../../utils/appErrors.js';

export const get2FAEnforcementController = async (req, res) => {
  const enabled = await get2FAEnforcementService();
  return sendSuccess(res, { enabled }, '2FA enforcement status fetched successfully');
};

export const update2FAEnforcementController = async (req, res) => {
  const { enabled } = req.body;
  if (typeof enabled !== 'boolean') {
    throw new BadRequestError('enabled must be a boolean');
  }
  const updatedSetting = await update2FAEnforcementService(enabled);
  return sendSuccess(res, updatedSetting, '2FA enforcement status updated successfully');
};
