const { getTotalCount } = require('./commonController.js');
const { sendSuccess } = require('../../utils/responseHandlers.js');
const { getTotalCountService } = require('./commonService.js');

jest.mock('./commonService.js');
jest.mock('../../utils/responseHandlers.js');

describe('getTotalCount', () => {
  let req, res;

  beforeEach(() => {
    req = {
      params: { tableName: 'users' },
      query: { role: 'admin', filters: undefined },
      user: {
        role: 'admin',
        designation: 'manager',
        user_id: '123',
        company_id: '456',
      },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    sendSuccess.mockImplementation((res, data, message) => {
      res.status(200).json({ data, message });
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should return count successfully without filters', async () => {
    getTotalCountService.mockResolvedValue(100);

    await getTotalCount(req, res);

    expect(getTotalCountService).toHaveBeenCalledWith(
      'users',
      'admin',
      { company_id: '456' },
      { userRole: 'admin', designation: 'manager', user_id: '123' }
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      data: { count: 100 },
      message: 'Total count for users retrieved successfully',
    });
  });

  test('should return count successfully with valid filters', async () => {
    req.query.filters = encodeURIComponent(JSON.stringify({ status: 'active' }));
    getTotalCountService.mockResolvedValue(50);

    await getTotalCount(req, res);

    expect(getTotalCountService).toHaveBeenCalledWith(
      'users',
      'admin',
      { status: 'active', company_id: '456' },
      { userRole: 'admin', designation: 'manager', user_id: '123' }
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      data: { count: 50 },
      message: 'Total count for users retrieved successfully',
    });
  });

  test('should throw error for missing tableName', async () => {
    req.params.tableName = undefined;
    getTotalCountService.mockRejectedValue(new Error('Table name is required'));

    await expect(getTotalCount(req, res)).rejects.toThrow('Table name is required');
  });

  test('should handle invalid JSON in filters', async () => {
    req.query.filters = encodeURIComponent('invalid-json');
    
    await expect(getTotalCount(req, res)).rejects.toThrow(SyntaxError);
  });

  test('should handle errors from getTotalCountService', async () => {
    getTotalCountService.mockRejectedValue(new Error('Database error'));

    await expect(getTotalCount(req, res)).rejects.toThrow('Database error');
  });
});