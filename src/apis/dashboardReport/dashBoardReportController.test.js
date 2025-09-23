jest.mock('../../utils/db.js', () => ({
  createPool: jest.fn(),
  ...jest.requireActual('../../utils/db.js'),
}));
import gatherCompanyData from './dashboardReportController.js';
import gatherDataForCompany from './dashboardReportService.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { BadRequestError } from '../../utils/appErrors.js';

jest.mock('./dashboardReportService.js');
jest.mock('../../utils/responseHandlers.js');

describe('gatherCompanyData', () => {
  let req, res;

  beforeEach(() => {
    req = { body: {} };
    res = {};
    jest.clearAllMocks();
  });

  test('should throw BadRequestError if company_id is missing', async () => {
    req.body = { date: '2025-09-15' };

    await expect(gatherCompanyData(req, res))
      .rejects
      .toThrow(BadRequestError);

    await expect(gatherCompanyData(req, res))
      .rejects
      .toThrow('Company ID is required');
  });

  test('should throw BadRequestError if date is missing', async () => {
    req.body = { company_id: '123' };

    await expect(gatherCompanyData(req, res))
      .rejects
      .toThrow(BadRequestError);

    await expect(gatherCompanyData(req, res))
      .rejects
      .toThrow('Date is required');
  });

  test('should call gatherDataForCompany and sendSuccess with correct params', async () => {
    req.body = { company_id: '123', date: '2025-09-15' };
    const mockResult = { some: 'data' };
    gatherDataForCompany.mockResolvedValue(mockResult);

    await gatherCompanyData(req, res);

    expect(gatherDataForCompany).toHaveBeenCalledWith('123', '2025-09-15');
    expect(sendSuccess).toHaveBeenCalledWith(
      res,
      mockResult,
      'Data gathered and Telegram report sent successfully'
    );
  });

  test('should propagate error from gatherDataForCompany', async () => {
    req.body = { company_id: '123', date: '2025-09-15' };
    const error = new Error('DB error');
    gatherDataForCompany.mockRejectedValue(error);

    await expect(gatherCompanyData(req, res)).rejects.toThrow('DB error');
  });
});
