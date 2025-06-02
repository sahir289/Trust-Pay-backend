import {
  getPayInReportService,
  getPayOutReportService,
  getClientsAccountReportService,
} from './reportsService.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { InternalServerError } from '../../utils/appErrors.js';

const getPayInReportController = async (req, res) => {
  try {
    const result = await getPayInReportService(req);
    return sendSuccess(res, result, 'Got Pay-In report');
  } catch (error) {
    console.error('Error in getPayInReportController:', error);
    throw new InternalServerError(error);
  }
};

const getPayOutReportController = async (req, res) => {
  try {
    const result = await getPayOutReportService(req);
    return sendSuccess(res, result, 'Payouts created successfully');
  } catch (error) {
    console.error('Error in getPayOutReportController:', error);
    throw new InternalServerError(error);
  }
};

const getClientsAccountReportController = async (req, res) => {
  try {
    const result = await getClientsAccountReportService(req);
    return sendSuccess(res, result, 'Reports fetched successfully');
  } catch (error) {
    console.error('Error in getClientsAccountReportController:', error);
    throw new InternalServerError(error);
  }
};

export {
  getPayInReportController,
  getPayOutReportController,
  getClientsAccountReportController,
};