import { getSettingDao, updateSettingDao } from './settingsDao.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { BadRequestError } from '../../utils/appErrors.js';

export const get2FAEnforcementController = async (req, res) => {
  const setting = await getSettingDao('2fa_enforcement');
  return sendSuccess(res, setting || { enforced: false }, '2FA enforcement status fetched successfully');
};

export const update2FAEnforcementController = async (req, res) => {
  const { enforced } = req.body;
  if (typeof enforced !== 'boolean') {
    throw new BadRequestError('enforced must be a boolean');
  }
  const updatedSetting = await updateSettingDao('2fa_enforcement', { enforced });
  return sendSuccess(res, updatedSetting, '2FA enforcement status updated successfully');
};
