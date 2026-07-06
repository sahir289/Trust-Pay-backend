import gatherDataForCompany from '../../dashboardReport/dashboardReportService.js';
import { sendSuccess } from '../../../utils/responseHandlers.js';
import { BadRequestError } from '../../../utils/appErrors.js';

/**
 * GET /v2/dashboardReport — v2 twin of the v1 dashboard-report endpoint.
 *
 * Reuses the exact same `gatherDataForCompany` service as v1; only the response
 * envelope differs (sendV2Success). Thrown validation errors are converted to
 * the v2 envelope by the v2ErrorHandler mounted on the v2 router.
 */
const gatherCompanyDataV2 = async (req, res) => {
  const { company_id, date } = req.body;
  if (!company_id) {
    throw new BadRequestError('Company ID is required');
  }
  if (!date) {
    throw new BadRequestError('Date is required');
  }

  const result = await gatherDataForCompany(company_id, date);
  return sendSuccess(
    res,
    result,
    'Data gathered and Telegram report sent successfully',
  );
};

export default gatherCompanyDataV2;
