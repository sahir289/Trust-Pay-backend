import request from 'supertest';
import express from 'express';
import merchantsRouter from './index.js';
import {
  createMerchant,
  deleteMerchant,
  getMerchants,
  updateMerchant,
  getMerchantsById,
  getMerchantCodes,
  getMerchantsBySearch,
  getMerchantByCode,
} from './merchantController.js';

jest.mock('../../utils/tryCatchHandler.js', () => (fn) => (req, res, next) => fn(req, res, next));

jest.mock('../../middlewares/auth.js', () => ({
    isAuthenticated: (req, res, next) => next(),
    authorized: () => (req, res, next) => next(),
}));
// jest.mock('../../middlewares/locationRestrict.js', () => (req, res, next) => next());
const mockPayouts = [
    { id: 1, amount: 100, status: 'success' },
    // { id: 2, amount: 200, status: 'pending' }
];
jest.mock('./merchantController.js', () => ({
    getMerchantsById: jest.fn((req, res) => {
      return res.status(200).json({ id: req.params.id, name: 'Test' });
    }),
  }));
  
describe('Payout Index API', () => {
    let app;
    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.use('/merchants', merchantsRouter);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /api/merchants/:id', () => {
        it('should return a merchant by id', async () => {
            const res = await request(app).get('/merchants/m-abc');
            expect(res.status).toBe(200);
            expect(res.body).toEqual({ id: 'm-abc', name: 'Test' });
            expect(getMerchantsById).toHaveBeenCalled();
          });
          

        it('should return 404 if payout not found', async () => {
            getMerchantsById.mockResolvedValue(null);

            const res = await request(app).get('/999')
      expect(res.statusCode).toBe(404);
            expect(res).toHaveProperty('error');
        });
    });
});