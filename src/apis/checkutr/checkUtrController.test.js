const {
    getCheckUtr,
    getCheckUtrBySearch,
    createCheckUtr,
    updateCheckUtr,
    deleteCheckUtr,
  } = require('./checkUtrController');
  const { BadRequestError } = require('../../utils/appErrors.js');
  const { sendSuccess } = require('../../utils/responseHandlers');
  const {
    createCheckUtrService,
    deleteCheckUtrService,
    getCheckUtrBySearchService,
    getCheckUtrService,
    updateCheckUtrService,
  } = require('./checkUtrServices');
  const { getPayinDetailsByMerchantOrderId } = require('../payIn/payInDao');
  const { transactionWrapper } = require('../../utils/db');
  
  jest.mock('../../utils/responseHandlers');
  jest.mock('./checkUtrServices');
  jest.mock('../payIn/payInDao');
  jest.mock('../../utils/db');
  jest.mock('../payIn/payinService'); // Mock the getPayinDetailsByMerchantOrderId service
jest.mock('../../utils/db.js'); // Mock the transactionWrapper utility
  describe('CheckUtr Controller', () => {
    let mockReq, mockRes;
  
    beforeEach(() => {
      mockReq = {
        user: {
          company_id: '123',
          user_id: 'user1',
          user_name: 'Test User',
        },
        query: {},
        body: {},
        params: {},
      };
      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      sendSuccess.mockClear();
    });
  
    describe('getCheckUtr', () => {
      it('should get check UTRs successfully with filters', async () => {
        mockReq.query = { page: '1', limit: '10', sortOrder: 'asc', status: 'pending' };
        const mockData = [{ id: 1, utr: '123456' }];
        getCheckUtrService.mockResolvedValue(mockData);
  
        await getCheckUtr(mockReq, mockRes);
  
        expect(getCheckUtrService).toHaveBeenCalledWith(
          { company_id: '123',sortOrder: "asc", status: 'pending' },
          '1',
          '10',
          'asc'
        );
        expect(sendSuccess).toHaveBeenCalledWith(mockRes, mockData, 'get checkutr successfully');
      });
    });
  
    describe('getCheckUtrBySearch', () => {
      it('should get check UTRs by search successfully', async () => {
        mockReq.query = { search: 'test', page: '1', limit: '10' };
        const mockData = [{ id: 1, utr: '123456' }];
        getCheckUtrBySearchService.mockResolvedValue(mockData);
  
        await getCheckUtrBySearch(mockReq, mockRes);
  
        expect(getCheckUtrBySearchService).toHaveBeenCalledWith('123', 'test', '1', '10');
        expect(sendSuccess).toHaveBeenCalledWith(mockRes, mockData, 'get checkUtr by search successfully');
      });
  
     
    });
  
    describe('createCheckUtr', () => {
      it('should create check UTR successfully', async () => {
        mockReq.body = { merchant_order_id: 'order123', utr: '123456' };
        const mockPayinData = [{ payin_id: 'payin123' }];
        const mockCheckUtr = { id: 'utr123' };
        getPayinDetailsByMerchantOrderId.mockResolvedValue(mockPayinData);
        const mockTransactionWrapper = jest.fn().mockResolvedValue(mockCheckUtr);
        transactionWrapper.mockReturnValue(mockTransactionWrapper);
  
        await createCheckUtr(mockReq, mockRes);
  
        expect(getPayinDetailsByMerchantOrderId).toHaveBeenCalledWith('order123');
        expect(transactionWrapper).toHaveBeenCalledWith(createCheckUtrService);
        expect(mockTransactionWrapper).toHaveBeenCalledWith(
          {
            payin_id: 'payin123',
            company_id: '123',
            created_by: 'user1',
            updated_by: 'user1',
            utr: '123456'
          },
          'order123',
          '123456'
        );
        expect(sendSuccess).toHaveBeenCalledWith(
          mockRes,
          { id: 'utr123', created_by: 'Test User' },
          'Check Utr successfully'
        );
      });
  
    //   it('should throw BadRequestError when payload is missing', async () => {
    //     const req = {
    //       body: null, 
    //       user: {
    //         company_id: '123',
    //         user_id: '456',
    //         user_name: 'test_user',
    //       },
    //     };
    //     const res = {
    //       status: jest.fn().mockReturnThis(),
    //       json: jest.fn(),
    //     };
    
    //     await expect(createCheckUtr(req, res)).rejects.toThrow(
    //       new BadRequestError('payload is required')
    //     );
    //   });
    });
  
    describe('updateCheckUtr', () => {
      it('should update check UTR successfully', async () => {
        mockReq.params = { id: 'utr123' };
        mockReq.body = { status: 'completed' };
        updateCheckUtrService.mockResolvedValue();
  
        await updateCheckUtr(mockReq, mockRes);
  
        expect(updateCheckUtrService).toHaveBeenCalledWith('utr123', { status: 'completed' });
        expect(sendSuccess).toHaveBeenCalledWith(mockRes, {}, 'Update CheckUtr successfully');
      });
    });
  
    describe('deleteCheckUtr', () => {
      it('should delete check UTR successfully', async () => {
        mockReq.params = { id: 'utr123' };
        deleteCheckUtrService.mockResolvedValue();
  
        await deleteCheckUtr(mockReq, mockRes);
  
        expect(deleteCheckUtrService).toHaveBeenCalledWith('utr123');
        expect(sendSuccess).toHaveBeenCalledWith(mockRes, {}, 'Delete CheckUtr successfully');
      });
  
      it('should throw BadRequestError when id is missing', async () => {
        mockReq.params = {};
        await expect(deleteCheckUtr(mockReq, mockRes)).rejects.toThrow(BadRequestError);
      });
    });
  });