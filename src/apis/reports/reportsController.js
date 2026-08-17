import {
  getClientsAccountReportService,
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
  const result = await getClientsAccountReportService(payload);
  return sendSuccess(res, result, 'Reports get successfully');
};

const getClientsAccountReportDownloadController = async (req, res) => {

  const { company_id, role } = req.user;
  const { code, startDate, endDate, role_name, page, limit, type = 'csv' } = req.body;
      // type validate
      const allowedTypes = ['csv', 'xlsx', 'pdf'];
      const fileType = allowedTypes.includes(type?.toLowerCase())
        ? type.toLowerCase()
        : 'csv';

        const payload = {
          company_id,
          role,
          code,
          startDate,
          endDate,
          role_name,
          page,
          limit,
          fileType
        };

  const result = await publishGetClientsAccountReport(payload);

  return sendSuccess(res, result, 'Reports Processing successfully');
};

export {
  getPayInReportController,
  getPayOutReportController,
  getClientsAccountReportController,
  getClientsAccountReportDownloadController,
};
