const {
    getPayInMerchantReportDao,
    getPayInVendorReportDao,
    getPayOutMerchantReportDao,
    getPayOutVendorReportDao,
    getPayinReportDao,
    getPayOutAll,
    getMerchantReportDao,
    getVendorReportDao,
  } = require('./reportsDao');
  const { executeQuery, buildSelectQuery } = require('../../utils/db');
  const { logger } = require('../../utils/logger');
  const { BadRequestError } = require('../../utils/appErrors');
  const { Role, Status } = require('../../constants/index');
  
  // Mock dependencies
  jest.mock('../../utils/db');
  jest.mock('../../utils/logger');
  jest.mock('../../utils/appErrors');
  jest.mock('../../constants/index');
  
  describe('Reports DAO', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      executeQuery.mockResolvedValue({ rows: [] });
      buildSelectQuery.mockReturnValue(['SELECT * FROM "Payin" WHERE 1=1', []]);
    });
  
    describe('getPayInMerchantReportDao', () => {
      it('should build and execute query for ADMIN role with all parameters', async () => {
        const merchant_id = [1, 2];
        const startDate = '2025-08-01T00:00:00.000Z';
        const endDate = '2025-08-31T23:59:59.999Z';
        const company_id = '123';
        const role = Role.ADMIN;
        const status = [Status.SUCCESS];
        const updatedPayin = 'false';
        const mockRows = [{ id: 1, amount: 1000 }];
      
        executeQuery.mockResolvedValue({ rows: mockRows });
      
        const result = await getPayInMerchantReportDao(
          merchant_id,
          startDate,
          endDate,
          company_id,
          role,
          status,
          updatedPayin
        );
      
        expect(executeQuery).toHaveBeenCalledWith(
          expect.stringMatching(/v\.code AS vendor_code,\s*pi\.payin_vendor_commission/),
          expect.any(Array)
        );        
      
        expect(executeQuery).toHaveBeenCalledWith(
          expect.stringContaining('pi.approved_at BETWEEN $4 AND $5'),
          expect.arrayContaining([company_id, merchant_id, status, startDate, endDate]) 
        );
      
        expect(result).toEqual(mockRows);
      });
      
      it('should use updated_at for non-SUCCESS status', async () => {
        const merchant_id = [1];
        const startDate = '2025-08-01T00:00:00.000Z';
        const endDate = '2025-08-31T23:59:59.999Z';
        const company_id = '123';
        const role = Role.MERCHANT;
        const status = [Status.FAILED];
        const updatedPayin = 'false';
        const mockRows = [{ id: 2, amount: 2000 }];
        executeQuery.mockResolvedValue({ rows: mockRows });
  
        const result = await getPayInMerchantReportDao(merchant_id, startDate, endDate, company_id, role, status, updatedPayin);
  
        expect(executeQuery).toHaveBeenCalledWith(
          expect.stringMatching(/pi\.updated_at\s+BETWEEN\s+\$4\s+AND\s+\$5/),
          [company_id, merchant_id, status, startDate, endDate],
        );        
        
        expect(result).toEqual(mockRows);
      });
  
      it('should throw error if query fails', async () => {
        const error = new Error('Query error');
        executeQuery.mockRejectedValue(error);
        await expect(
          getPayInMerchantReportDao([1], '2025-08-01', '2025-08-31', '123', Role.MERCHANT, [Status.SUCCESS], 'false'),
        ).rejects.toThrow('Query error');
        expect(logger.error).toHaveBeenCalledWith('Error in getPayInMerchantReportDao:', error);
      });
    });
  
    describe('getPayInVendorReportDao', () => {
      it('should build and execute query with all parameters', async () => {
        const id = [1, 2];
        const startDate = '2025-08-01T00:00:00.000Z';
        const endDate = '2025-08-31T23:59:59.999Z';
        const company_id = '123';
        const role = Role.VENDOR;
        const status = [Status.PENDING];
        const updatedPayin = 'false';
        const mockRows = [{ id: 3, amount: 3000 }];
        executeQuery.mockResolvedValue({ rows: mockRows });
  
        const result = await getPayInVendorReportDao(id, startDate, endDate, company_id, role, status, updatedPayin);
  
        expect(executeQuery).toHaveBeenCalledWith(
          expect.stringContaining('pi.updated_at BETWEEN $4 AND $5'),
          [company_id, id, status, startDate, endDate],
        );
        
        expect(result).toEqual(mockRows);
      });
  
      it('should use approved_at for SUCCESS status with updatedPayin false', async () => {
        const id = [1];
        const startDate = '2025-08-01T00:00:00.000Z';
        const endDate = '2025-08-31T23:59:59.999Z';
        const company_id = '123';
        const role = Role.VENDOR;
        const status = [Status.SUCCESS];
        const updatedPayin = 'false';
        executeQuery.mockResolvedValue({ rows: [] });
      
        await getPayInVendorReportDao(id, startDate, endDate, company_id, role, status, updatedPayin);
      
        expect(executeQuery).toHaveBeenCalledWith(
          expect.stringMatching(/pi\.approved_at\s+BETWEEN\s+\$\d+\s+AND\s+\$\d+/),
          expect.any(Array),
        );
      });      
  
      it('should throw error if query fails', async () => {
        const error = new Error('Query error');
        executeQuery.mockRejectedValue(error);
        await expect(
          getPayInVendorReportDao([1], '2025-08-01', '2025-08-31', '123', Role.VENDOR, [Status.SUCCESS], 'false'),
        ).rejects.toThrow('Query error');
        expect(logger.error).toHaveBeenCalledWith('Error in getPayInVendorReportDao:', error);
      });
    });
  
    describe('getPayOutMerchantReportDao', () => {
      it('should build query for ADMIN role with APPROVED status', async () => {
        const merchant_id = [1];
        const startDate = '2025-08-01T00:00:00.000Z';
        const endDate = '2025-08-31T23:59:59.999Z';
        const company_id = '123';
        const role = Role.ADMIN;
        const status = [Status.APPROVED];
        const mockRows = [{ id: 4, amount: 4000 }];
        executeQuery.mockResolvedValue({ rows: mockRows });
      
        const result = await getPayOutMerchantReportDao(merchant_id, startDate, endDate, company_id, role, status);
      
        expect(executeQuery).toHaveBeenCalledWith(
          expect.stringMatching(/po\.(approved_at|updated_at)\s+BETWEEN\s+\$\d+\s+AND\s+\$\d+/),
          [company_id, merchant_id, status, startDate, endDate],
        );
      
        expect(result).toEqual(mockRows);
      });
      
  
      it('should throw error if query fails', async () => {
        const error = new Error('Query error');
        executeQuery.mockRejectedValue(error);
        await expect(
          getPayOutMerchantReportDao([1], '2025-08-01', '2025-08-31', '123', Role.MERCHANT, [Status.APPROVED]),
        ).rejects.toThrow('Query error');
        expect(logger.error).toHaveBeenCalledWith('Error in getPayOutMerchantReportDao:', error);
      });
    });
  
    describe('getPayOutVendorReportDao', () => {
      it('should build query for VENDOR role with status', async () => {
        const id = [1];
        const startDate = '2025-08-01T00:00:00.000Z';
        const endDate = '2025-08-31T23:59:59.999Z';
        const company_id = '123';
        const role = Role.VENDOR;
        const status = [Status.REJECTED];
        const mockRows = [{ id: 5, amount: 5000 }];
        executeQuery.mockResolvedValue({ rows: mockRows });
      
        const result = await getPayOutVendorReportDao(id, startDate, endDate, company_id, role, status);
      
        expect(executeQuery).toHaveBeenCalledWith(
          expect.stringMatching(/po\.(rejected_at|updated_at)\s+BETWEEN\s+\$\d+\s+AND\s+\$\d+/),
          [company_id, id, status, startDate, endDate],
        );
      
        expect(result).toEqual(mockRows);
      });
      
  
      it('should throw error if query fails', async () => {
        const error = new Error('Query error');
        executeQuery.mockRejectedValue(error);
        await expect(
          getPayOutVendorReportDao([1], '2025-08-01', '2025-08-31', '123', Role.VENDOR, [Status.REJECTED]),
        ).rejects.toThrow('Query error');
        expect(logger.error).toHaveBeenCalledWith('Error in getPayOutVendorReportDao:', error);
      });
    });
  
    describe('getPayinReportDao', () => {
      it('should call buildSelectQuery and execute query', async () => {
        const filters = { company_id: '123' };
        const page = 1;
        const pageSize = 10;
        const sortBy = 'created_at';
        const sortOrder = 'ASC';
        const mockRows = [{ id: 6, amount: 6000 }];
        buildSelectQuery.mockReturnValue(['SELECT * FROM "Payin" WHERE company_id = $1', ['123']]);
        executeQuery.mockResolvedValue({ rows: mockRows });
  
        const result = await getPayinReportDao(filters, page, pageSize, sortBy, sortOrder);
  
        expect(buildSelectQuery).toHaveBeenCalledWith(
          'SELECT * FROM "Payin" WHERE 1=1',
          filters,
          page,
          pageSize,
          sortBy,
          sortOrder,
        );
        expect(executeQuery).toHaveBeenCalledWith('SELECT * FROM "Payin" WHERE company_id = $1', ['123']);
        expect(result).toEqual(mockRows);
      });
  
      it('should throw error if query fails', async () => {
        const error = new Error('Query error');
        executeQuery.mockRejectedValue(error);
        await expect(getPayinReportDao({}, 1, 10, 'created_at', 'ASC')).rejects.toThrow('Query error');
        expect(logger.error).toHaveBeenCalledWith('Error in getPayOutVendorReportDao:', error);
      });
    });
  
    describe('getPayOutAll', () => {
      it('should call buildSelectQuery and execute query', async () => {
        const filters = { company_id: '123' };
        const page = 1;
        const pageSize = 10;
        const sortBy = 'created_at';
        const sortOrder = 'ASC';
        const mockRows = [{ id: 7, amount: 7000 }];
        buildSelectQuery.mockReturnValue(['SELECT * FROM "Payout" WHERE company_id = $1', ['123']]);
        executeQuery.mockResolvedValue({ rows: mockRows });
  
        const result = await getPayOutAll(filters, page, pageSize, sortBy, sortOrder);
  
        expect(buildSelectQuery).toHaveBeenCalledWith(
          expect.stringContaining('SELECT merchant_order_id, ifsc_code'),
          filters,
          page,
          pageSize,
          sortBy,
          sortOrder,
        );
        expect(executeQuery).toHaveBeenCalledWith('SELECT * FROM "Payout" WHERE company_id = $1', ['123']);
        expect(result).toEqual(mockRows);
      });
  
      it('should throw error if query fails', async () => {
        const error = new Error('Query error');
        executeQuery.mockRejectedValue(error);
        await expect(getPayOutAll({}, 1, 10, 'created_at', 'ASC')).rejects.toThrow('Query error');
        expect(logger.error).toHaveBeenCalledWith('Error in getPayOutVendorReportDao:', error);
      });
    });
  
    describe('getMerchantReportDao', () => {
      it('should build and execute query with pagination', async () => {
        const company_id = '123';
        const userIds = ['user1', 'user2'];
        const startDate = '2025-08-01';
        const endDate = '2025-08-31';
        const page = 1;
        const limit = 10;
        const role = Role.ADMIN;
        const mockRows = [{ calculation_user_id: 'user1', total_payin_amount: 1000 }];
        executeQuery.mockResolvedValue({ rows: mockRows });
  
        const result = await getMerchantReportDao(company_id, userIds, startDate, endDate, page, limit, role);
  
        expect(executeQuery).toHaveBeenCalledWith(
          expect.stringContaining('m.user_id AS merchant_user_id'),
          [company_id, userIds, startDate, endDate, 10, 0],
        );
        expect(result).toEqual(mockRows);
      });
  
      it('should throw BadRequestError if dates are missing', async () => {
        BadRequestError.mockImplementation((message) => new Error(message));
        await expect(getMerchantReportDao('123', ['user1'], null, null, 1, 10, Role.ADMIN)).rejects.toThrow(
          'Both startDate and endDate must be provided.',
        );
        expect(logger.error).toHaveBeenCalledWith('Error in getMerchantReportDao:', 'Both startDate and endDate must be provided.');
      });
    });
  
    describe('getVendorReportDao', () => {
      it('should build and execute query with pagination', async () => {
        const company_id = '123';
        const userIds = ['vendor1'];
        const startDate = '2025-08-01';
        const endDate = '2025-08-31';
        const page = 1;
        const limit = 10;
        const role = Role.VENDOR;
        const mockRows = [{ calculation_user_id: 'vendor1', total_payin_amount: 2000 }];
        executeQuery.mockResolvedValue({ rows: mockRows });
  
        const result = await getVendorReportDao(company_id, userIds, startDate, endDate, page, limit, role);
  
        expect(executeQuery).toHaveBeenCalledWith(
          expect.stringContaining('FROM public."Calculation" c'),
          [company_id, userIds, startDate, endDate, 10, 0],
        );
        expect(result).toEqual(mockRows);
      });
  
      it('should throw BadRequestError if dates are missing', async () => {
        BadRequestError.mockImplementation((message) => new Error(message));
        await expect(getVendorReportDao('123', ['vendor1'], null, null, 1, 10, Role.VENDOR)).rejects.toThrow(
          'Both startDate and endDate must be provided.',
        );
        expect(logger.error).toHaveBeenCalledWith('Error in getVendorReportDao:', expect.any(Error));
      });
    });
  });