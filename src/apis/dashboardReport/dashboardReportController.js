import gatherDataForCompany from './dashboardReportService.js';
import { sendSuccess, sendError } from '../../utils/responseHandlers.js';
import { logger } from '../../utils/logger.js';
import { BadRequestError } from '../../utils/appErrors.js';

const gatherCompanyData = async (req, res) => {
  try {
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
  } catch (error) {
    logger.error(`Error in gatherCompanyData controller: ${error.message}`);
    return sendError(res, 500, `Failed to gather data: ${error.message}`);
  } 
};

export default gatherCompanyData;