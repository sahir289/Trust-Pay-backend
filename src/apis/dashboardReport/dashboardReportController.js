import gatherDataForCompany from './dashboardReportService.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { BadRequestError } from '../../utils/appErrors.js';

const gatherCompanyData = async (req, res) => {
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

export default gatherCompanyData;