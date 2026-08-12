import {
  // getClientsAccountReportService,
  getPayInReportService,
  getPayOutReportService,
} from './reportsService.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { publishGetClientsAccountReport } from '../../rabbitmq/producer.js';

const getPayInReportController = async (req, res) => {
  const result = await getPayInReportService(req);
  return sendSuccess(res, result, 'Got Pay-In report');
};

const getPayOutReportController = async (req, res) => {
  const result = await getPayOutReportService(req);
  return sendSuccess(res, result, 'Payouts created successfully');
};

const getClientsAccountReportController = async (req, res) => {
  const { company_id, role } = req.user;
  const { code, startDate, endDate, role_name, page, limit } = req.body;
  const payload = {
    company_id,
    role,
    code,
    startDate,
    endDate,
    role_name,
    page,
    limit,
  };
  const result = await publishGetClientsAccountReport(payload);
  // const result = await getClientsAccountReportService(payload);

  return sendSuccess(res, result, 'Reports Processing successfully');
};

export {
  getPayInReportController,
  getPayOutReportController,
  getClientsAccountReportController,
};
