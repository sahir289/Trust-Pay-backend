import Logger from '../../utils/logger.js';
import { sendError, sendSuccess } from '../../utils/responseHandlers.js';
import {getAllPayoutService ,getAllVendorAccountReportService} from "./reportsService.js";
const logger = new Logger()

const getAllPayoutData = async (req, res) => {
    try {
        const payload = req.body;
        const result = await getAllPayoutService(payload);
        logger.log('get Payout successfully', 'info', result);
        return sendSuccess(res, result, 'get payout successfully');
    } catch (error) {
        logger.log('error getting while getting payout', 'error', error);
        return sendError(res, error, 'Error occurred while getting payout');
    }
};
const getAllVendorAccountReport = async (req,res) =>{
    try {
        const payload = req.body;
        const result = await getAllVendorAccountReportService(payload);
        logger.log('get vendor accounts Reports successfully', 'info', result);
        return sendSuccess(res, result, 'get accounts reports successfully');
    } catch (error) {
        logger.log('error getting while getting vendor accounts', 'error', error);
        return sendError(res, error, 'Error occurred while getting vendor accounts');
    }
}
export {getAllPayoutData , getAllVendorAccountReport};