import { get2FAEnforcementService, update2FAEnforcementService } from './settingsService.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { BadRequestError } from '../../utils/appErrors.js';

export const get2FAEnforcementController = async (req, res) => {
  const company_id = req.user.company_id;
  const result = await get2FAEnforcementService(company_id);
  return sendSuccess(res, result, '2FA enforcement status fetched successfully');
};

export const update2FAEnforcementController = async (req, res) => {
  const { enabled } = req.body;
  if (typeof enabled !== 'boolean') {
    throw new BadRequestError('enabled must be a boolean');
  }
  const company_id = req.user.company_id;
  const result = await update2FAEnforcementService(company_id, enabled);
  return sendSuccess(res, result, '2FA enforcement status updated successfully');
};
