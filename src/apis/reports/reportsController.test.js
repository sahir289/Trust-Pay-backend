const {
    getPayInReportController,
    getPayOutReportController,
    getClientsAccountReportController,
  } = require('./reportsController');
  const {
    getPayInReportService,
    getPayOutReportService,
    getClientsAccountReportService,
  } = require('./reportsService');
  const { sendSuccess } = require('../../utils/responseHandlers');
  
  // Mock the dependencies
  jest.mock('./reportsService');
  jest.mock('../../utils/responseHandlers');
  
  describe('Reports Controller', () => {
    let mockReq, mockRes;
  
    beforeEach(() => {
      mockReq = {};
      mockRes = {};
      jest.clearAllMocks();
    });
  
    describe('getPayInReportController', () => {
      it('should call getPayInReportService and sendSuccess with correct data', async () => {
        const mockResult = [{ id: 456, amount: 1000.00 }];
        getPayInReportService.mockResolvedValue(mockResult);
        sendSuccess.mockImplementation((res, data, message) => ({
          status: 200,
          data,
          message,
        }));
  
        const result = await getPayInReportController(mockReq, mockRes);
  
        expect(getPayInReportService).toHaveBeenCalledWith(mockReq);
        expect(sendSuccess).toHaveBeenCalledWith(mockRes, mockResult, 'Got Pay-In report');
        expect(result).toEqual({
          status: 200,
          data: mockResult,
          message: 'Got Pay-In report',
        });
      });
  
      it('should throw an error if getPayInReportService fails', async () => {
        const mockError = new Error('Service error');
        getPayInReportService.mockRejectedValue(mockError);
  
        await expect(getPayInReportController(mockReq, mockRes)).rejects.toThrow('Service error');
        expect(getPayInReportService).toHaveBeenCalledWith(mockReq);
        expect(sendSuccess).not.toHaveBeenCalled();
      });
    });
  
    describe('getPayOutReportController', () => {
      it('should call getPayOutReportService and sendSuccess with correct data', async () => {
        const mockResult = [{ id: 123, vendorCode: 'ABC123', amount: 5000.50 }];
        getPayOutReportService.mockResolvedValue(mockResult);
        sendSuccess.mockImplementation((res, data, message) => ({
          status: 200,
          data,
          message,
        }));
  
        const result = await getPayOutReportController(mockReq, mockRes);
  
        expect(getPayOutReportService).toHaveBeenCalledWith(mockReq);
        expect(sendSuccess).toHaveBeenCalledWith(mockRes, mockResult, 'Payouts created successfully');
        expect(result).toEqual({
          status: 200,
          data: mockResult,
          message: 'Payouts created successfully',
        });
      });
  
      it('should throw an error if getPayOutReportService fails', async () => {
        const mockError = new Error('Service error');
        getPayOutReportService.mockRejectedValue(mockError);
  
        await expect(getPayOutReportController(mockReq, mockRes)).rejects.toThrow('Service error');
        expect(getPayOutReportService).toHaveBeenCalledWith(mockReq);
        expect(sendSuccess).not.toHaveBeenCalled();
      });
    });
  
    describe('getClientsAccountReportController', () => {
      it('should call getClientsAccountReportService and sendSuccess with correct data', async () => {
        const mockResult = [{ id: 789, name: 'Merchant A' }];
        getClientsAccountReportService.mockResolvedValue(mockResult);
        sendSuccess.mockImplementation((res, data, message) => ({
          status: 200,
          data,
          message,
        }));
  
        const result = await getClientsAccountReportController(mockReq, mockRes);
  
        expect(getClientsAccountReportService).toHaveBeenCalledWith(mockReq);
        expect(sendSuccess).toHaveBeenCalledWith(mockRes, mockResult, 'Reports fetched successfully');
        expect(result).toEqual({
          status: 200,
          data: mockResult,
          message: 'Reports fetched successfully',
        });
      });
  
      it('should throw an error if getClientsAccountReportService fails', async () => {
        const mockError = new Error('Service error');
        getClientsAccountReportService.mockRejectedValue(mockError);
  
        await expect(getClientsAccountReportController(mockReq, mockRes)).rejects.toThrow('Service error');
        expect(getClientsAccountReportService).toHaveBeenCalledWith(mockReq);
        expect(sendSuccess).not.toHaveBeenCalled();
      });
    });
  });