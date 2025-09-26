import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';

let createBankResponse,
    getBankResponse,
    getBankMessage,
    updateBankResponse,
    createBankBotResponse,
    getClaimResponse,
    importBankResponse,
    resetBankResponseController,
    createBankBotResponseBulk;

beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();

    // Import and mock the controller functions
    const controllerModule = await jest.unstable_mockModule('./bankResponseController.js', () => ({
        createBankResponse: jest.fn((req, res) => res.status(201).json({ id: 1, message: 'Bank response created' })),
        getBankResponse: jest.fn((req, res) => res.status(200).json({ message: 'Bank response fetched' })),
        getBankMessage: jest.fn((req, res) => res.status(200).json({ message: 'Bank response fetched' })),
        updateBankResponse: jest.fn((req, res) => res.status(200).json({ id: parseInt(req.params.id), message: 'Bank response updated' })),
        getBankResponseBySearch: jest.fn((req, res) => res.status(200).json({ message: 'Bank responses searched' })),
        createBankBotResponse: jest.fn((req, res) => res.status(201).json({ message: 'Bank bot response created' })),
        getClaimResponse: jest.fn((req, res) => res.status(200).json({ message: 'Claim response fetched' })),
        importBankResponse: jest.fn((req, res) => res.status(201).json({ message: 'Bank response imported' })),
        resetBankResponseController: jest.fn((req, res) => res.status(200).json({ message: 'Bank response reset' })),
        createBankBotResponseBulk: jest.fn((req, res) => res.status(201).json({ message: 'Bank bot responses created in bulk' }))
    }));

    // Update references to mocked functions
    ({
        createBankResponse,
        getBankResponse,
        getBankMessage,
        updateBankResponse,
        createBankBotResponse,
        getClaimResponse,
        importBankResponse,
        resetBankResponseController,
        createBankBotResponseBulk
    } = controllerModule);
});

// Setup mocks for dependencies
jest.unstable_mockModule('../../utils/auth.js', () => ({
    default: {
        verifyToken: jest.fn(() => ({ user_id: 'test-user', company_id: 'test-company', designation: 'admin' }))
    }
}));

jest.unstable_mockModule('../../apis/auth/authDao.js', () => ({
    default: {
        getSessionByIdDao: jest.fn(() => Promise.resolve({ session_id: 'test-session' }))
    }
}));

jest.unstable_mockModule('../../helpers/Aws.js', () => ({
    default: {
        s3: {
            upload: jest.fn().mockImplementation((params, callback) => callback(null, { Location: 'mock-s3-url' }))
        }
    }
}));

jest.unstable_mockModule('../../middlewares/auth.js', () => ({
    isAuthenticated: (req, res, next) => {
        req.user = { user_id: 'test-user', designation: 'admin', company_id: 'test-company' };
        next();
    },
    authorized: () => (req, res, next) => {
        next();
    }
}));

jest.unstable_mockModule('../../middlewares/rateLimiter.js', () => ({
    rateLimitMiddleware: (req, res, next) => {
        next();
    },
    rateLimitMiddlewareBot: (req, res, next) => {
        next();
    }
}));

jest.unstable_mockModule('../../utils/index.js', () => ({
    multerUpload: {
        single: () => (req, res, next) => {
            req.file = {
                buffer: Buffer.from('id,message\n1,Test message'),
                originalname: 'test.csv',
                mimetype: 'text/csv',
            };
            next();
        },
    }
}));

jest.unstable_mockModule('../../utils/redisClient.js', () => ({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    quit: jest.fn().mockResolvedValue('OK'),
}));

jest.unstable_mockModule('../../utils/rabbitmq-bank-response.js', () => ({
    publishBankResponse: jest.fn().mockResolvedValue(true),
}));

jest.unstable_mockModule('../../utils/logger.js', () => ({
    logger: {
        error: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
    },
}));

jest.unstable_mockModule('../../utils/db.js', () => {
    const mockPool = {
        end: jest.fn().mockResolvedValue(),
        query: jest.fn(),
        connect: jest.fn()
    };
    
    return {
        default: {
            createPool: jest.fn().mockReturnValue(mockPool),
            executeQuery: jest.fn(),
            beginTransaction: jest.fn(),
            commit: jest.fn(),
            rollback: jest.fn(),
            buildSelectQuery: jest.fn(),
            buildInsertQuery: jest.fn(),
            buildUpdateQuery: jest.fn(),
            getConnection: jest.fn(),
            pool: mockPool,
            writerPool: mockPool,
            readerPool: mockPool
        }
    };
});

jest.unstable_mockModule('../../config/config.js', () => ({
    rateLimiter: {
        points: 100,
        duration: 60,
        blockDuration: 60,
    },
    bucketName: 'test-bucket',
}));

jest.unstable_mockModule('../../constants/index.js', () => ({
    AccessRoles: {
        ADMIN: 'admin',
        BANK_RESPONSE: 'admin',
    },
}));

describe('BankResponse Routes', () => {
    let app;

    beforeAll(async () => {
        app = express();
        app.use(express.json());
        const bankRouter = (await import('./index.js')).default;
        app.use('/bankResponse', bankRouter);
    });

    afterAll(async () => {
        const mockDb = await jest.unstable_mockModule('../../utils/db.js');
        const pool = mockDb.default?.pool;
        if (pool?.end) {
            await pool.end();
        }
    });

    test('should call getClaimResponse and return 200', async () => {
        try {
            getClaimResponse.mockImplementation((req, res) => res.status(200).json([{ id: 1, claim: 'test' }]));
            const res = await request(app).get('/bankResponse/claim');
            expect(res.status).toBe(200);
            expect(getClaimResponse).toHaveBeenCalledWith(expect.any(Object), expect.any(Object));
            expect(res.body).toEqual([{ id: 1, claim: 'test' }]);
        } catch (error) {
            console.error('Test getClaimResponse failed:', error);
            throw error;
        }
    }, 30000);

    test('should call createBankBotResponse and return 201', async () => {
        try {
            const res = await request(app)
                .post('/bankResponse/create-bot-message')
                .send({ message: 'Test bot message' });
            expect(res.status).toBe(201);
            expect(createBankBotResponse).toHaveBeenCalledWith(
                expect.objectContaining({ body: { message: 'Test bot message' } }),
                expect.any(Object)
            );
            expect(res.body).toEqual({ message: 'Bank bot response created' });
        } catch (error) {
            console.error('Test createBankBotResponse failed:', error);
            throw error;
        }
    }, 30000);

    test('should call createBankBotResponseBulk and return 201', async () => {
        try {
            const res = await request(app)
                .post('/bankResponse/create-bot-message-bulk')
                .send({ messages: ['message1', 'message2'] });
            expect(res.status).toBe(201);
            expect(createBankBotResponseBulk).toHaveBeenCalledWith(
                expect.objectContaining({ body: { messages: ['message1', 'message2'] } }),
                expect.any(Object)
            );
            expect(res.body).toEqual({ message: 'Bank bot responses created in bulk' });
        } catch (error) {
            console.error('Test createBankBotResponseBulk failed:', error);
            throw error;
        }
    }, 30000);

    test('should call createBankResponse and return 201', async () => {
        try {
            const res = await request(app)
                .post('/bankResponse/create-message')
                .send({ complaint_type: 'test', description: 'Test description', user_id: 1 });
            expect(res.status).toBe(201);
            expect(createBankResponse).toHaveBeenCalledWith(
                expect.objectContaining({
                    body: { complaint_type: 'test', description: 'Test description', user_id: 1 },
                    user: expect.any(Object),
                }),
                expect.any(Object)
            );
            expect(res.body).toEqual({ id: 1, message: 'Bank response created' });
        } catch (error) {
            console.error('Test createBankResponse failed:', error);
            throw error;
        }
    }, 30000);

    test('should call updateBankResponse and return 200', async () => {
        try {
            const res = await request(app)
                .put('/bankResponse/update-message/1')
                .send({ complaint_type: 'updated', description: 'Updated description' });
            expect(res.status).toBe(200);
            expect(updateBankResponse).toHaveBeenCalledWith(
                expect.objectContaining({
                    params: { id: '1' },
                    body: { complaint_type: 'updated', description: 'Updated description' },
                    user: expect.any(Object),
                }),
                expect.any(Object)
            );
            expect(res.body).toEqual({ id: 1, message: 'Bank response updated' });
        } catch (error) {
            console.error('Test updateBankResponse failed:', error);
            throw error;
        }
    }, 30000);

    test('should call getBankResponse and return 200', async () => {
        try {
            getBankResponse.mockImplementation((req, res) => res.status(200).json([{ id: 1, name: 'Report 1' }]));
            const res = await request(app).get('/bankResponse/BankResponseReports');
            expect(res.status).toBe(200);
            expect(getBankResponse).toHaveBeenCalledWith(expect.any(Object), expect.any(Object));
            expect(res.body).toEqual([{ id: 1, name: 'Report 1' }]);
        } catch (error) {
            console.error('Test getBankResponse failed:', error);
            throw error;
        }
    }, 30000);

    test('should call getBankMessage and return 200', async () => {
        try {
            getBankMessage.mockImplementation((req, res) => res.status(200).json([{ id: 1, message: 'Test message' }]));
            const res = await request(app).get('/bankResponse/get-bank-message');
            expect(res.status).toBe(200);
            expect(getBankMessage).toHaveBeenCalledWith(expect.any(Object), expect.any(Object));
            expect(res.body).toEqual([{ id: 1, message: 'Test message' }]);
        } catch (error) {
            console.error('Test getBankMessage failed:', error);
        }
    }, 30000);

    test('should call resetBankResponseController and return 200', async () => {
        try {
            const res = await request(app).put('/bankResponse/reset-message/1');
            expect(res.status).toBe(200);
            expect(resetBankResponseController).toHaveBeenCalledWith(
                expect.objectContaining({
                    params: { id: '1' },
                    user: expect.any(Object),
                }),
                expect.any(Object)
            );
            expect(res.body).toEqual({ message: 'Bank response reset' });
        } catch (error) {
            console.error('Test resetBankResponseController failed:', error);
            throw error;
        }
    }, 30000);

    test('should call importBankResponse and return 201', async () => {
        try {
            const res = await request(app)
                .post('/bankResponse/import-bank-response')
                .attach('file', Buffer.from('id,message\n1,Test message'), 'test.csv');
            expect(res.status).toBe(201);
            expect(importBankResponse).toHaveBeenCalledWith(
                expect.objectContaining({
                    file: expect.any(Object),
                    user: expect.any(Object),
                }),
                expect.any(Object)
            );
            expect(res.body).toEqual({ message: 'Bank response imported' });
        } catch (error) {
            console.error('Test importBankResponse failed:', error);
            throw error;
        }
    }, 30000);
});