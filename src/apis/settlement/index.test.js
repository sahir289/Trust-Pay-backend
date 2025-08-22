import request from 'supertest';
import express from 'express';
import settlement from './index.js';

jest.mock('./settlementController.js', () => ({
    getSettlementControllerById: jest.fn((req, res) =>
        res.status(201).json({ message: 'Bank account created' })
      ),
      getSettlementController : jest.fn((req, res) =>
        res.status(200).json({ message: 'Get settlements successfully' })
      ),
    getSettlementsBySearch: jest.fn((req, res) =>
        res.status(200).json({ message: 'Get settlements successfully' })
      ),
      createSettlementController: jest.fn((req, res) =>
        res.status(201).json({ message: 'Settlement created successfully' })
      ),
      updateSettlementController: jest.fn((req, res) =>
        res.status(200).json({ message: 'Settlement updated successfully' })
      ),
      deleteSettlementController: jest.fn((req, res) =>
        res.status(200).json({ message: 'Settlement deleted successfully' })
      ),
}))

jest.mock('../../middlewares/auth.js', () => ({
    isAuthenticated: (req, res, next) => next(),
    authorized: () => (req, res, next) => next(),
  }));

  describe('Bank Account Routes', () => {
    let app;
    const controller = require('./settlementController.js');
  
    beforeAll(() => {
      app = express();
      app.use(express.json());
      app.use('/bankAccounts', settlement);
    });
  
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('GET / should return all settlements', async () => {
        const res = await request(app).get('/'); 
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ message: 'Get settlements successfully' }); 
        expect(controller.getSettlementsBySearch).toHaveBeenCalled();
      });
      

})
