import {
  getPayInReportService,
  getPayOutReportService,
  getClientsAccountReportService,
  getVendorBankReportService,
} from './reportsService.js';
import { sendSuccess } from '../../utils/responseHandlers.js';

const getPayInReportController = async (req, res) => {
  const result = await getPayInReportService(req);
  return sendSuccess(res, result, 'Got Pay-In report');
};

const getPayOutReportController = async (req, res) => {
  const result = await getPayOutReportService(req);
  return sendSuccess(res, result, 'Payouts created successfully');
};

const getClientsAccountReportController = async (req, res) => {
  const result = await getClientsAccountReportService(req);
  return sendSuccess(res, result, 'Reports fetched successfully');
};

const getVendorBankReportController = async (req, res) => {
  const result = await getVendorBankReportService(req.query);
  return sendSuccess(res, result, 'Vendor bank report fetched successfully');
}

export {
  getPayInReportController,
  getPayOutReportController,
  getClientsAccountReportController,
  getVendorBankReportController
};
