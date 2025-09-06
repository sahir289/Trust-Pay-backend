const {
    getBankResponse,
    getClaimResponse,
    createBankResponse,
    createBankBotResponse,
    createBankBotResponseBulk,
    updateBankResponse,
    getBankMessage,
    getBankResponseBySearch,
    resetBankResponseController,
    importBankResponse,
} = require('./bankResponseController.js');
const {
    getBankResponseService,
    getClaimResponseService,
    getBankMessageServices,
    createBankResponseService,
    updateBankResponseService,
    getBankResponseBySearchService,
} = require('./bankResponseServices.js');
const { sendSuccess } = require('../../utils/responseHandlers.js');
const { ValidationError, BadRequestError } = require('../../utils/appErrors.js');
const { transactionWrapper } = require('../../utils/db.js');
const { newTableEntry } = require('../../utils/sockets.js');
const { publishBankResponse } = require('../../utils/rabbitmq-bank-response.js');
const { s3 } = require('../../helpers/Aws.js');
const { streamToBuffer } = require('../../helpers/index');
const {
    CREATE_BANK_RESPONSE_SCHEMA,
    UPDATE_BANK_RESPONSE_SCHEMA,
    IMPORT_BANK_RESPONSE_SCHEMA,
    RESET_BANK_RESPONSE_SCHEMA,
    VALIDATE_BANK_RESPONSE_BY_ID,
} = require('../../schemas/bankResponseSchema.js');
const { Role, tableName } = require('../../constants/index');
const config = require('../../config/config.js');

jest.mock('./bankResponseServices');
jest.mock('../../utils/responseHandlers');
jest.mock('../../utils/appErrors');
jest.mock('../../utils/db');
jest.mock('../../utils/sockets');
jest.mock('../../utils/rabbitmq-bank-response');
jest.mock('../../helpers/Aws');
jest.mock('../../helpers/index');
jest.mock('../../schemas/bankResponseSchema');
jest.mock('../../config/config');

describe('Bank Response Controller', () => {
    let req, res;

    beforeEach(() => {
        req = {
            user: { role: 'USER', company_id: '123', user_name: 'test_user', user_id: 'user_1' },
            query: {},
            body: {},
            params: {},
            headers: {},
            file: null,
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

    describe('getBankResponse', () => {
        it('should retrieve bank responses successfully', async () => {
            const query = {
              page: '1',
              limit: '10',
              search: 'test',
              updated: '2023-01-01',
              sortBy: 'name',
              sortOrder: 'asc',
            };
            const req_user ={
                designation :'VENDOR',
                user_id :'user_1',
                company_id: '123',
                role: 'VENDOR'
            }
            req.query = query;
            req.user = req_user;
            const mockData = { responses: [], total: 0 };
            getBankResponseService.mockResolvedValue(mockData);
          
            await getBankResponse(req, res);
          
            expect(getBankResponseService).toHaveBeenCalledWith(
              {company_id: '123', 
                limit: "10",
                page: "1",
                search: "test",
                updated: "2023-01-01",
              },
              'VENDOR',
                 '1',
                '10',
                'test',
                '2023-01-01',
                'name',
                'asc',
                'VENDOR',
                'user_1'
              
            );
          
            expect(sendSuccess).toHaveBeenCalledWith(
              res,
              mockData,
              'Bank response retrieved successfully'
            );
          });
          
    });

    describe('getClaimResponse', () => {
        it('should retrieve claim responses successfully', async () => {
            const query = { claim_id: 'claim_1' };
            req.query = query;
            const mockData = { claims: [] };
            getClaimResponseService.mockResolvedValue(mockData);

            await getClaimResponse(req, res);

            expect(getClaimResponseService).toHaveBeenCalledWith({ company_id: '123', claim_id: 'claim_1' });
            expect(sendSuccess).toHaveBeenCalledWith(res, mockData, 'Bank response retrieved successfully');
        });
    });

    describe('getBankResponseBySearch', () => {
        it('should retrieve bank responses by search successfully', async () => {
            const query = {
              page: '1',
              limit: '10',
              search: 'test',
              updated: '2023-01-01',
              sortBy: 'name',
              sortOrder: 'asc',
            };
            const req_user ={
                designation :'VENDOR',
                user_id :'user_1',
                company_id: '123',
                role: 'VENDOR'
            }
            req.query = query;
            req.user = req_user;
            const mockData = { responses: [], total: 0 };
            getBankResponseBySearchService.mockResolvedValue(mockData);
          
            await getBankResponseBySearch(req, res);
          
            expect(getBankResponseBySearchService).toHaveBeenCalledWith(
                {
                    company_id: '123',
                    limit: "10",
                    page: "1",
                    search: "test",
                    updated: "2023-01-01",
                },
                'VENDOR',
                '1',
                '10',
                'test',
                '2023-01-01',
                'name',
                'asc',
                'VENDOR',
                'user_1'
            );
          
            expect(sendSuccess).toHaveBeenCalledWith(
              res,
              mockData,
              'BankResponse fetched successfully'
            );
          });
    });

    describe('createBankResponse', () => {
        it('should create a bank response successfully', async () => {
            req.body = { body: { data: 'test' } };
            CREATE_BANK_RESPONSE_SCHEMA.validate.mockReturnValue({ error: null });
            const mockResult = { id: '1', message: 'Entry created successfully' };
            createBankResponseService.mockResolvedValue(mockResult);
            newTableEntry.mockResolvedValue();
    
            await createBankResponse(req, res);
    
            expect(CREATE_BANK_RESPONSE_SCHEMA.validate).toHaveBeenCalledWith(req.body);
            expect(createBankResponseService).toHaveBeenCalledWith(
                { data: 'test' },
                '123',
                'USER',
                'test_user',
                'user_1'
            );
            expect(sendSuccess).toHaveBeenCalledWith(res, mockResult, 'Created Bank Response successfully');
        });

        it('should throw validation error if schema validation fails', async () => {
            req.body = { body: {} };
            CREATE_BANK_RESPONSE_SCHEMA.validate.mockReturnValue({ error: 'Validation failed' });
            ValidationError.mockImplementation((error) => new Error(error));

            await expect(createBankResponse(req, res)).rejects.toThrow('Validation failed');
            expect(CREATE_BANK_RESPONSE_SCHEMA.validate).toHaveBeenCalledWith(req.body);
        });
    });

    describe('createBankBotResponse', () => {
        it('should create a bank bot response successfully', async () => {
            req.headers['x-auth-token'] = 'token123';
            req.body = { body: { data: 'test' } };
            CREATE_BANK_RESPONSE_SCHEMA.validate.mockReturnValue({ error: null });
            const mockResult = { id: '1' };
            publishBankResponse.mockResolvedValue(mockResult);

            await createBankBotResponse(req, res);

            expect(CREATE_BANK_RESPONSE_SCHEMA.validate).toHaveBeenCalledWith(req.body);
            expect(publishBankResponse).toHaveBeenCalledWith({
                payload: { data: 'test' },
                x_auth_token: 'token123',
                role: Role.BOT,
            });
            expect(sendSuccess).toHaveBeenCalledWith(res, mockResult, 'Created Bank Bot Response successfully');
        });

        it('should throw validation error if schema validation fails', async () => {
            req.body = { body: {} };
            CREATE_BANK_RESPONSE_SCHEMA.validate.mockReturnValue({ error: 'Validation failed' });
            ValidationError.mockImplementation((error) => new Error(error));

            await expect(createBankBotResponse(req, res)).rejects.toThrow('Validation failed');
        });
    });

    describe('createBankBotResponseBulk', () => {
        it('should handle bulk bank bot responses successfully', async () => {
            req.headers['x-auth-token'] = 'token123';
            req.body = { body: [{ data: 'test1' }, { data: 'test2' }] };
            CREATE_BANK_RESPONSE_SCHEMA.validate
                .mockReturnValueOnce({ error: null })
                .mockReturnValueOnce({ error: null });
            publishBankResponse.mockResolvedValue({ id: '1' });

            await createBankBotResponseBulk(req, res);

            expect(CREATE_BANK_RESPONSE_SCHEMA.validate).toHaveBeenCalledTimes(2);
            expect(publishBankResponse).toHaveBeenCalledTimes(2);
            expect(sendSuccess).toHaveBeenCalledWith(
                res,
                {
                    published: 2,
                    invalid: 0,
                    invalidIndexes: [],
                    invalidPayloads: [],
                    validationErrors: [],
                    status: 202,
                },
                'All messages published successfully'
            );
        });

        it('should handle invalid payloads in bulk', async () => {
            req.headers['x-auth-token'] = 'token123';
            req.body = { body: [{ data: 'test1' }, { invalid: 'data' }] };
            CREATE_BANK_RESPONSE_SCHEMA.validate
                .mockReturnValueOnce({ error: null })
                .mockReturnValueOnce({ error: { message: 'Invalid payload' } });
            publishBankResponse.mockResolvedValue({ id: '1' });

            await createBankBotResponseBulk(req, res);

            expect(publishBankResponse).toHaveBeenCalledTimes(1);
            expect(sendSuccess).toHaveBeenCalledWith(
                res,
                {
                    published: 1,
                    invalid: 1,
                    invalidIndexes: [1],
                    invalidPayloads: [{ index: 1, payload: { invalid: 'data' }, error: 'Invalid payload' }],
                    validationErrors: ['Invalid payload'],
                    status: 202,
                },
                'Published: 1, Invalid: 1'
            );
        });

        it('should throw error if body is not an array', async () => {
            req.body = { body: {} };
            ValidationError.mockImplementation((error) => new Error(error));

            await expect(createBankBotResponseBulk(req, res)).rejects.toThrow('body must be an array of payloads');
        });
    });

    describe('updateBankResponse', () => {
        it('should create settlement for INTERNAL_QR_TRANSFER with valid UTR', async () => {
            // Mock dependencies
            getBankResponseByUTR.mockResolvedValue({ id: 1, is_used: false, status: Status.BOT });
            getVendorsDao.mockResolvedValue([{ id: 1, payin_commission: 0.1 }]);
            getCalculationforCronDao.mockResolvedValue([{ id: 1, config: { total_internalSettlement_amount: 0 } }]);
            calculateCommission.mockReturnValue(10);
            createSettlementDao.mockResolvedValue({ id: 1 });
            updateBankResponseDao.mockResolvedValue();
            updateCalculationBalanceDao.mockResolvedValue();
            updateCalculationConfigDao.mockResolvedValue();
            getSettlementByUTRDao.mockResolvedValue([]); // Mock empty settlement array
            handleVendorInternalTransfer.mockResolvedValue({ id: 1 }); // Mock vendor transfer response
          
            const result = await createSettlementService(mockConn, { ...mockPayload, method: 'INTERNAL_QR_TRANSFER' }, Role.VENDOR);
          
            // Verify mocks
            expect(getBankResponseByUTR).toHaveBeenCalledWith(mockPayload.config.reference_id);
            expect(getSettlementByUTRDao).toHaveBeenCalledWith(mockPayload.config.reference_id);
            expect(handleVendorInternalTransfer).toHaveBeenCalledWith(mockPayload);
            expect(createSettlementDao).not.toHaveBeenCalled(); // Not called for Role.VENDOR
            expect(result).toEqual({ id: 1 });
          });

        it('should throw validation error for invalid id', async () => {
            req.params = { id: '' };
            VALIDATE_BANK_RESPONSE_BY_ID.validate.mockReturnValue({ error: 'Invalid ID' });
            ValidationError.mockImplementation((error) => new Error(error));

            await expect(updateBankResponse(req, res)).rejects.toThrow('Invalid ID');
        });
    });

    describe('getBankMessage', () => {
        it('should retrieve bank messages successfully', async () => {
            req.query = { bank_id: 'bank_1', startDate: '2023-01-01', endDate: '2023-01-02', page: '1', limit: '10' };
            const mockData = { messages: [] };
            getBankMessageServices.mockResolvedValue(mockData);

            await getBankMessage(req, res);

            expect(getBankMessageServices).toHaveBeenCalledWith('bank_1', '2023-01-01', '2023-01-02', '123', 'USER', '1', '10');
            expect(sendSuccess).toHaveBeenCalledWith(res, mockData, 'Get BankResponse successfully');
        });
    });

    describe('resetBankResponseController', () => {
        it('should reset bank response successfully', async () => {
            req.params = { id: '1' };
            req.body = { amount: 100, utr: 'utr123', bank_id: 'bank_1' };
            RESET_BANK_RESPONSE_SCHEMA.validate.mockReturnValue({ error: null });
            const mockResult = { id: '1', message: 'Reset successful' };
            const mockService = jest.fn().mockResolvedValue(mockResult);
            transactionWrapper.mockReturnValue(mockService);

            await resetBankResponseController(req, res);

            expect(RESET_BANK_RESPONSE_SCHEMA.validate).toHaveBeenCalledWith(req.body);
            expect(mockService).toHaveBeenCalledWith('1', {
                company_id: '123',
                user_name: 'test_user',
                user_id: 'user_1',
                role: 'USER',
                amount: 100,
                utr: 'utr123',
                bank_id: 'bank_1',
            });
            expect(sendSuccess).toHaveBeenCalledWith(res, mockResult, 'Reset successful');
        });

        it('should throw validation error for invalid body', async () => {
            req.body = {};
            RESET_BANK_RESPONSE_SCHEMA.validate.mockReturnValue({ error: 'Invalid body' });
            ValidationError.mockImplementation((error) => new Error(error));

            await expect(resetBankResponseController(req, res)).rejects.toThrow('Invalid body');
        });
    });

    describe('importBankResponse', () => {
        it('should import bank response successfully', async () => {
            req.body = { data: 'test' };
            req.params = { id: '1' };
            req.file = { key: 'file.pdf' };
            IMPORT_BANK_RESPONSE_SCHEMA.validate.mockReturnValue({ error: null });
            const mockPdfBuffer = Buffer.from('pdf content');
            streamToBuffer.mockResolvedValue(mockPdfBuffer);
            s3.send.mockResolvedValue({ Body: 'stream' });
            const mockResult = { id: '1' };
            const mockService = jest.fn().mockResolvedValue(mockResult);
            transactionWrapper.mockReturnValue(mockService);
            config.bucketName = 'test-bucket';

            await importBankResponse(req, res);

            expect(IMPORT_BANK_RESPONSE_SCHEMA.validate).toHaveBeenCalledWith({ ...req.body, file: { key: 'file.pdf' } });
            expect(s3.send).toHaveBeenCalledWith(expect.anything());
            expect(streamToBuffer).toHaveBeenCalledWith('stream');
            expect(mockService).toHaveBeenCalledWith(
                { ...req.body, ...req.params, pdfBuffer: mockPdfBuffer, file: { key: 'file.pdf' } },
                '123',
                'USER',
                'test_user'
            );
            expect(sendSuccess).toHaveBeenCalledWith(res, mockResult, 'Created Bank Response successfully');
        });

        it('should throw error if file is missing', async () => {
            req.body = { data: 'test' };
            IMPORT_BANK_RESPONSE_SCHEMA.validate.mockReturnValue({ error: null });
            BadRequestError.mockImplementation((error) => new Error(error));

            await expect(importBankResponse(req, res)).rejects.toThrow('PDF File not found!');
        });

        it('should throw validation error for invalid payload', async () => {
            req.body = {};
            req.file = { key: 'file.pdf' };
            IMPORT_BANK_RESPONSE_SCHEMA.validate.mockReturnValue({ error: 'Invalid payload' });
            ValidationError.mockImplementation((error) => new Error(error));

            await expect(importBankResponse(req, res)).rejects.toThrow('Invalid payload');
        });
    });
});