const {
    getCompany,
    getCompanyById,
    createCompany,
    updateCompany,
    deleteCompany,
  } = require('./companyController');
  const { getCompanyService, getCompanyByIdService, createCompanyService, updateCompanyService, deleteCompanyService } = require('./companyServices');
  const { sendSuccess } = require('../../utils/responseHandlers');
  const { ValidationError } = require('../../utils/appErrors');
  const { VALIDATE_COMPANY_SCHEMA, VALIDATE_COMPANY_BY_ID, VALIDATE_UPDATE_COMPANY_STATUS } = require('../../schemas/companySchema');
  const { transactionWrapper } = require('../../utils/db');
  
  jest.mock('./companyServices');
  jest.mock('../../utils/responseHandlers');
  jest.mock('../../schemas/companySchema');
  jest.mock('../../utils/db');
  
  describe('Company Controller', () => {
    let mockReq, mockRes;
  
    beforeEach(() => {
      mockReq = {
        query: {},
        params: {},
        body: {},
      };
      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      jest.clearAllMocks();
    });
  
    describe('getCompany', () => {
      it('should return companies successfully', async () => {
        const mockCompanies = [{ id: 1, name: 'Test Company' }];
        getCompanyService.mockResolvedValue(mockCompanies);
        sendSuccess.mockReturnValue({ status: 200, data: mockCompanies, message: 'get Company successfully' });
  
        mockReq.query.search = 'test';
        await getCompany(mockReq, mockRes);
  
        expect(getCompanyService).toHaveBeenCalledWith('test');
        expect(sendSuccess).toHaveBeenCalledWith(mockRes, mockCompanies, 'get Company successfully');
      });
    });
  
    describe('getCompanyById', () => {
      it('should return company by id successfully', async () => {
        const mockCompany = { id: 1, name: 'Test Company' };
        VALIDATE_COMPANY_BY_ID.validate.mockReturnValue({ error: null });
        getCompanyByIdService.mockResolvedValue(mockCompany);
        sendSuccess.mockReturnValue({ status: 200, data: mockCompany, message: 'get Company successfully' });
  
        mockReq.params.id = '1';
        await getCompanyById(mockReq, mockRes);
  
        expect(VALIDATE_COMPANY_BY_ID.validate).toHaveBeenCalledWith({ id: '1' });
        expect(getCompanyByIdService).toHaveBeenCalledWith({ id: '1' });
        expect(sendSuccess).toHaveBeenCalledWith(mockRes, mockCompany, 'get Company successfully');
      });
  
      it('should throw ValidationError for invalid id', async () => {
        const mockError = { details: [{ message: 'Invalid ID format' }] };
        VALIDATE_COMPANY_BY_ID.validate.mockReturnValue({ error: mockError });
  
        mockReq.params.id = 'invalid';
        await expect(getCompanyById(mockReq, mockRes)).rejects.toThrow(ValidationError);
        expect(VALIDATE_COMPANY_BY_ID.validate).toHaveBeenCalledWith({"id": "invalid",});
      });
    });
  
    describe('createCompany', () => {
      it('should create company successfully', async () => {
        const mockPayload = { name: 'Test Company' };
        const mockCreatedCompany = { id: 1, ...mockPayload };
        VALIDATE_COMPANY_SCHEMA.validate.mockReturnValue({ error: null });
        const mockTransactionWrapper = jest.fn().mockResolvedValue(mockCreatedCompany);
        transactionWrapper.mockReturnValue(mockTransactionWrapper);
        sendSuccess.mockReturnValue({ status: 201, data: mockCreatedCompany, message: 'Create Company successfully' });
  
        mockReq.body = mockPayload;
        await createCompany(mockReq, mockRes);
  
        expect(VALIDATE_COMPANY_SCHEMA.validate).toHaveBeenCalledWith(mockPayload);
        expect(transactionWrapper).toHaveBeenCalledWith(createCompanyService);
        expect(mockTransactionWrapper).toHaveBeenCalledWith(mockPayload);
        expect(sendSuccess).toHaveBeenCalledWith(mockRes, mockCreatedCompany, 'Create Company successfully');
      });
  
      it('should throw ValidationError for invalid payload', async () => {
        const mockError = { details: [{ message: 'Invalid payload format' }] };
        VALIDATE_COMPANY_SCHEMA.validate.mockReturnValue({ error: mockError });
      
        mockReq.body = { invalid: 'data' };
        await expect(createCompany(mockReq, mockRes)).rejects.toThrow(ValidationError);
        expect(VALIDATE_COMPANY_SCHEMA.validate).toHaveBeenCalledWith({ invalid: 'data' });
      });      
    });
  
    describe('updateCompany', () => {
      it('should update company successfully', async () => {
        const mockPayload = { status: 'active' };
        VALIDATE_UPDATE_COMPANY_STATUS.validate.mockReturnValue({ error: null });
        VALIDATE_COMPANY_BY_ID.validate.mockReturnValue({ error: null });
        updateCompanyService.mockResolvedValue();
        sendSuccess.mockReturnValue({ status: 200, data: {}, message: 'Update Company successfully' });
  
        mockReq.params.id = '1';
        mockReq.body = mockPayload;
        await updateCompany(mockReq, mockRes);
  
        expect(VALIDATE_UPDATE_COMPANY_STATUS.validate).toHaveBeenCalledWith(mockPayload);
        expect(VALIDATE_COMPANY_BY_ID.validate).toHaveBeenCalledWith({ id: '1' });
        expect(updateCompanyService).toHaveBeenCalledWith({ id: '1' }, mockPayload);
        expect(sendSuccess).toHaveBeenCalledWith(mockRes, {}, 'Update Company successfully');
      });
  
      it('should throw ValidationError for invalid id', async () => {
        const mockError = { details: [{ message: 'Invalid ID format' }] };
        VALIDATE_COMPANY_BY_ID.validate.mockReturnValue({ error: mockError });
  
        mockReq.params.id = 'invalid';
        await expect(updateCompany(mockReq, mockRes)).rejects.toThrow(ValidationError);
        expect(VALIDATE_COMPANY_BY_ID.validate).toHaveBeenCalledWith({});
      });
  
      it('should throw ValidationError for invalid payload', async () => {
        const mockError = { details: [{ message: 'Invalid payload format' }] };
      
        VALIDATE_UPDATE_COMPANY_STATUS.validate = jest.fn().mockReturnValue({ error: mockError });
        VALIDATE_COMPANY_BY_ID.validate = jest.fn().mockReturnValue({ error: null });
      
        mockReq.params.id = '1';
        mockReq.body = { invalid: 'data' };
      
        await expect(updateCompany(mockReq, mockRes))
          .rejects.toThrow('Invalid payload format');
      
        expect(VALIDATE_UPDATE_COMPANY_STATUS.validate).toHaveBeenCalledWith({ invalid: 'data' });
      });
      
    });
  
    describe('deleteCompany', () => {
      it('should delete company successfully', async () => {
        VALIDATE_COMPANY_BY_ID.validate.mockReturnValue({ error: null });
        deleteCompanyService.mockResolvedValue();
        sendSuccess.mockReturnValue({ status: 200, data: {}, message: 'Delete Company successfully' });
  
        mockReq.params.id = '1';
        await deleteCompany(mockReq, mockRes);
  
        expect(VALIDATE_COMPANY_BY_ID.validate).toHaveBeenCalledWith({ id: '1' });
        expect(deleteCompanyService).toHaveBeenCalledWith({ id: '1' });
        expect(sendSuccess).toHaveBeenCalledWith(mockRes, {}, 'Delete Company successfully');
      });
  
      it('should throw ValidationError for invalid id', async () => {
        const mockError = { details: [{ message: 'Invalid ID format' }] };
        VALIDATE_COMPANY_BY_ID.validate.mockReturnValue({ error: mockError });
  
        mockReq.params.id = 'invalid';
        await expect(deleteCompany(mockReq, mockRes)).rejects.toThrow(ValidationError);
        expect(VALIDATE_COMPANY_BY_ID.validate).toHaveBeenCalledWith({ id: 'invalid' });
      });
    });
  });