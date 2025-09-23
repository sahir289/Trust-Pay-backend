jest.mock('../../utils/db.js', () => ({
    createPool: jest.fn(),
    ...jest.requireActual('../../utils/db.js'),
}));
const {
    getCheckUtrService,
    getCheckUtrBySearchService,
    createCheckUtrService,
    updateCheckUtrService,
    deleteCheckUtrService,
} = require('./checkUtrServices.js'); 
const {
    getCheckUtrDao,
    getCheckUtrBySearchDao,
    createCheckUtrDao,
    updateCheckUtrDao,
    deleteCheckUtrDao,
} = require('./checkUtrDao');
const { logger } = require('../../utils/logger');
const { BadRequestError, InternalServerError } = require('../../utils/appErrors');

jest.mock('./checkUtrDao');
jest.mock('../../utils/logger', () => ({
    logger: {
        error: jest.fn(),
    },
}));
jest.mock('../../utils/appErrors', () => ({
    BadRequestError: jest.fn((message) => new Error(message)),
    InternalServerError: jest.fn((message) => new Error(message)),
}));

describe('Check UTR Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getCheckUtrService', () => {
        test('should fetch check UTR records successfully', async () => {
            const mockResult = { checkutr: [{ sno: 1, payin_id: 123 }] };
            getCheckUtrDao.mockResolvedValue(mockResult);

            const filters = { company_id: 'COMP123' };
            const result = await getCheckUtrService(filters, 1, 10, 'DESC');

            expect(getCheckUtrDao).toHaveBeenCalledWith(filters, 1, 10, 'sno', 'DESC', null);
            expect(result).toEqual(mockResult);
        });

        test('should handle errors', async () => {
            const error = new Error('Database error');
            getCheckUtrDao.mockRejectedValue(error);

            await expect(getCheckUtrService({ company_id: 'COMP123' }, 1, 10, 'DESC')).rejects.toThrow('Database error');
            expect(logger.error).toHaveBeenCalledWith('error getting while check utr', error);
        });
    });

    describe('getCheckUtrBySearchService', () => {
        test('should fetch records with valid search terms', async () => {
            const mockResult = { totalCount: 5, totalPages: 1, checkUtr: [{ id: 1 }] };
            getCheckUtrBySearchDao.mockResolvedValue(mockResult);

            const result = await getCheckUtrBySearchService('COMP123', 'term1,term2', '1', '10');

            expect(getCheckUtrBySearchDao).toHaveBeenCalledWith('COMP123', ['term1', 'term2'], 10, 0);
            expect(result).toEqual(mockResult);
        });

        test('should handle empty search string', async () => {
            const mockResult = { totalCount: 5, totalPages: 1, checkUtr: [{ id: 1 }] };
            getCheckUtrBySearchDao.mockResolvedValue(mockResult);

            const result = await getCheckUtrBySearchService('COMP123', '', '1', '10');

            expect(getCheckUtrBySearchDao).toHaveBeenCalledWith('COMP123', [], 10, 0);
            expect(result).toEqual(mockResult);
        });

        test('should throw BadRequestError for invalid pagination parameters', async () => {
            await expect(getCheckUtrBySearchService('COMP123', 'term1', 'invalid', '10')).rejects.toThrow('Invalid pagination parameters');
            expect(BadRequestError).toHaveBeenCalledWith('Invalid pagination parameters');
        });

        test('should handle errors', async () => {
            const error = new Error('Database error');
            getCheckUtrBySearchDao.mockRejectedValue(error);

            await expect(getCheckUtrBySearchService('COMP123', 'term1', '1', '10')).rejects.toThrow('Database error');
            expect(logger.error).toHaveBeenCalledWith('error getting while getting check utr by search', error);
        });
    });

    describe('createCheckUtrService', () => {
        test('should create a new check UTR record', async () => {
            const mockPayload = { payin_id: 123, company_id: 'COMP123' };
            const mockResult = { id: 1, ...mockPayload };
            createCheckUtrDao.mockResolvedValue(mockResult);

            const result = await createCheckUtrService(null, mockPayload);

            expect(createCheckUtrDao).toHaveBeenCalledWith(mockPayload);
            expect(result).toEqual(mockResult);
        });

        test('should handle errors', async () => {
            const error = new Error('Database error');
            createCheckUtrDao.mockRejectedValue(error);

            await expect(createCheckUtrService(null, { payin_id: 123 })).rejects.toThrow('Database error');
            expect(logger.error).toHaveBeenCalledWith('error getting while check utr', error);
        });
    });

    describe('updateCheckUtrService', () => {
        test('should update an existing check UTR record', async () => {
            const mockData = { status: 'updated' };
            const mockResult = { id: 1, ...mockData };
            updateCheckUtrDao.mockResolvedValue(mockResult);

            const result = await updateCheckUtrService(1, mockData);

            expect(updateCheckUtrDao).toHaveBeenCalledWith(1, mockData);
            expect(result).toEqual(mockResult);
        });

        test('should handle errors', async () => {
            const error = new Error('Database error');
            updateCheckUtrDao.mockRejectedValue(error);

            await expect(updateCheckUtrService(1, { status: 'updated' })).rejects.toThrow('Database error');
            expect(logger.error).toHaveBeenCalledWith('error getting while check utr', error);
        });
    });

    describe('deleteCheckUtrService', () => {
        test('should soft delete a check UTR record', async () => {
            const mockResult = { id: 1, is_obsolete: true };
            deleteCheckUtrDao.mockResolvedValue(mockResult);

            const result = await deleteCheckUtrService(1);

            expect(deleteCheckUtrDao).toHaveBeenCalledWith(1, { is_obsolete: true });
            expect(result).toEqual(mockResult);
        });

        test('should throw InternalServerError on error', async () => {
            const error = new Error('Database error');
            deleteCheckUtrDao.mockRejectedValue(error);

            await expect(deleteCheckUtrService(1)).rejects.toThrow('Error getting while check utr');
            expect(InternalServerError).toHaveBeenCalledWith('Error getting while check utr');
            expect(logger.error).toHaveBeenCalledWith('error getting while check utr', error);
        });
    });
});