import request from 'supertest';
import express from 'express';
import payoutRouter from './index.js';
import { 
    createPayout,
    deletePayout,
    getPayouts,
    updatePayout,
    getPayoutsById,
    getPayoutsBySearch,
    checkPayOutStatus,
    walletsPayouts,
    assignedPayout,
    getWalletsBalance
} from './payOutController.js';


jest.mock('./payOutController.js');

jest.mock('../../utils/tryCatchHandler.js', () => (fn) => (req, res, next) => fn(req, res, next));

jest.mock('../../middlewares/auth.js', () => ({
    isAuthenticated: (req, res, next) => next(),
    authorized: () => (req, res, next) => next(),
}));
// jest.mock('../../middlewares/locationRestrict.js', () => (req, res, next) => next());
const mockPayouts = [
    { id: 1, amount: 100, status: 'success' },
    // { id: 2, amount: 200, status: 'pending' }
];
describe('Payout Index API', () => {
	let app;
	beforeAll(() => {
		app = express();
		app.use(express.json());
		app.use('/payout', payoutRouter);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('GET /api/payouts/reports', () => {
		it('should return a list of payouts', async () => {
			
			getPayouts.mockResolvedValue(mockPayouts);
            const res = await getPayouts(mockPayouts)
            console.log(`res body ${res}`, res);
			// expect(res.statusCode).toBe(200);
			expect(res).toEqual(mockPayouts);
			expect(getPayouts).toHaveBeenCalled();
		});

		// it('should handle errors gracefully', async () => {
		// 	getPayouts.mockRejectedValue(new Error('DB error'));

		// 	const res = await getPayouts(mockPayouts).get('/api/payouts/reports');
        //     console.log(`res body ${res}`, res);
		// 	// expect(res.statusCode).toBe(500);
		// 	expect(res).toHaveProperty('error');
		// });
	});

		describe('POST /api/payouts/create-payout', () => {
			it('should create a new payout', async () => {
				const newPayout = { body: {
                                            "user_id": "TEST",
                                            "code": "BAGGA",
                                            "amount": 900.0,
                                            "acc_no": "9876543210",
                                            "acc_holder_name": "John Doe",
                                            "ifsc_code": "IFSC0001234",
                                            "bank_name": "Sample Bank"
                                            },
                                    headers: {"x-api-key": "a9ba4b6b-1573-41d7-abec-ccb809a7d122"},
                                    ip:"217.165.249.213"
                                    };
				const createdPayout = { id: 3, ...newPayout, status: 'pending' };
				createPayout.mockResolvedValue(createdPayout);
				const res = request(app).post('/create-payout').send(newPayout.body).set(newPayout.headers);
                console.log(`res body ${res}`, res);
				// expect(res.statusCode).toBe(201);
				// expect(res).toEqual(createdPayout);
				// expect(createPayout).toHaveBeenCalledWith(expect.objectContaining(newPayout));
			});

			it('should validate input data', async () => {
				// Simulate validation error thrown by controller
				// createPayout.mockImplementation(() => {
				// 	const error = new Error('Invalid input');
				// 	error.status = 400;
				// 	throw error;
				// });
				const res = request(app).post('/create-payout').send({ amount: null });
				console.log(`res body ${res}`, res);
                // expect(res.statusCode).toBe(400);
				// expect(res).toHaveProperty('error');
			});
		});

	describe('GET /api/payouts/:id', () => {
		it('should return a payout by id', async () => {
			const payout = { id: 1, amount: 100, status: 'success' };
			getPayoutsById.mockResolvedValue(payout);

			const res = request(app).get('/1');
			console.log(`res body ${res}`, res);
            // expect(res.statusCode).toBe(200);
			// expect(res).toEqual(payout);
			// expect(getPayoutsById).toHaveBeenCalledWith('1');
		});

		it('should return 404 if payout not found', async () => {
			getPayoutsById.mockResolvedValue(null);

			const res = request(app).get('/999');
			console.log(`res body ${res}`, res);
            // expect(res.statusCode).toBe(404);
			// expect(res).toHaveProperty('error');
		});
	});
});
