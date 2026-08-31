import {
  getClientsAccountReportService,
  // getPayInReportService,
  // getPayOutReportService,
} from './reportsService.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { publishGetClientsAccountReport, publishGetPayInReport, publishGetPayOutReport } from '../../rabbitmq/producer.js';

const getPayInReportController = async (req, res) => {
  const { company_id, role, user_id } = req.user;
  const { code, startDate, endDate, status, updatedPayin, type = 'csv'  } = req.query;

  // type validate
  const allowedTypes = ['csv', 'xlsx', 'pdf'];
  const fileType = allowedTypes.includes(type?.toLowerCase())
    ? type.toLowerCase()
    : 'csv';

  const payload = {
    company_id,
    userId:user_id,
    role,
    code,
    startDate,
    endDate,
    status,
    updatedPayin,
    fileType
  };

  // const result = await getPayInReportService(req);
  const result = await publishGetPayInReport(payload);
  return sendSuccess(res, result, 'Payins Processing report successfully');
};

const getPayOutReportController = async (req, res) => {
  const { company_id, role, user_id } = req.user;
  const { code, startDate, endDate, status, type = 'csv' } = req.query;

  // type validate
  const allowedTypes = ['csv', 'xlsx', 'pdf'];
  const fileType = allowedTypes.includes(type?.toLowerCase())
    ? type.toLowerCase()
    : 'csv';

  const payload = {
    company_id,
    userId:user_id,
    role,
    code,
    startDate,
    endDate,
    status,
    fileType
  };

  const result = await publishGetPayOutReport(payload);
  return sendSuccess(res, result, 'Payouts Processing report successfully');
};

const getClientsAccountReportController = async (req, res) => {
  const { company_id, role, user_id } = req.user;
  const { code, startDate, endDate, role_name, page, limit } = req.body;
  const payload = {
    company_id,
    userId:user_id,
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

  const { company_id, role, user_id } = req.user;
  const { code, startDate, endDate, role_name, page, limit, type = 'csv' } = req.body;
      // type validate
      const allowedTypes = ['csv', 'xlsx', 'pdf'];
      const fileType = allowedTypes.includes(type?.toLowerCase())
        ? type.toLowerCase()
        : 'csv';

        const payload = {
          company_id,
          userId: user_id,
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
