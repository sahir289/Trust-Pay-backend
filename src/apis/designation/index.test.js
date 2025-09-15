import request from 'supertest';
import express from 'express';
import designation from './index.js';
import { getDesignation, getDesignationById, createDesignation, updateDesignation, deleteDesignation } from './designationController.js';
import { BadRequestError } from '../../utils/appErrors.js';

// Mock controller functions
jest.mock('./designationController.js', () => ({
  getDesignation: jest.fn(),
  getDesignationById: jest.fn(),
  createDesignation: jest.fn(),
  updateDesignation: jest.fn(),
  deleteDesignation: jest.fn(),
}));

// Mock authentication middleware
jest.mock('../../middlewares/auth.js', () => ({
  isAuthenticated: jest.fn((req, res, next) => next()),
  authorized: jest.fn(() => (req, res, next) => next()),
}));

// Mock BadRequestError with status code
jest.mock('../../utils/appErrors.js', () => ({
  BadRequestError: class extends Error {
    constructor(message) {
      super(message);
      this.statusCode = 400;
      this.name = 'BadRequestError';
    }
  },
}));

// Mock tryCatchHandler
jest.mock('../../utils/tryCatchHandler.js', () => {
  const mockTryCatchHandler = (controller) => {
    return (req, res, next) => {
      Promise.resolve(controller(req, res, next))
        .then((result) => {
          if (result) {
            res.status(result.status || 200).json(result);
          }
        })
        .catch((error) => {
          const status = error.statusCode || (error.message.includes('not found') ? 404 : 500);
          res.status(status).json({ message: error.message });
        });
    };
  };
  return mockTryCatchHandler;
});

const app = express();
app.use(express.json());
app.use('/designation', designation);

describe('Designation Routes', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /designation', () => {
    it('should return list of designations on success', async () => {
      const mockDesignations = [
        { id: '1', name: 'Manager' },
        { id: '2', name: 'Developer' },
      ];
      getDesignation.mockResolvedValue({
        status: 200,
        message: 'Designations retrieved successfully',
        data: mockDesignations,
      });

      const response = await request(app).get('/designation');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        message: 'Designations retrieved successfully',
        status: 200,
        data: mockDesignations,
      });
      expect(getDesignation).toHaveBeenCalled();
    }, 10000);

    it('should handle internal server error', async () => {
      getDesignation.mockRejectedValue(new Error('Internal server error'));

      const response = await request(app).get('/designation');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ message: 'Internal server error' });
    });
  });

  describe('GET /designation/:id', () => {
    it('should return designation details for valid ID', async () => {
      const mockDesignation = { id: '1', name: 'Manager' };
      getDesignationById.mockResolvedValue({
        status: 200,
        message: 'Designation retrieved successfully',
        data: mockDesignation,
      });

      const response = await request(app).get('/designation/1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        message: 'Designation retrieved successfully',
        status: 200,
        data: mockDesignation,
      });
    }, 10000);

    it('should return 404 for non-existent designation', async () => {
      getDesignationById.mockRejectedValue(new Error('Designation not found'));

      const response = await request(app).get('/designation/999');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ message: 'Designation not found' });
    });

    it('should handle internal server error', async () => {
      getDesignationById.mockRejectedValue(new Error('Internal server error'));

      const response = await request(app).get('/designation/1');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ message: 'Internal server error' });
    });
  });

  describe('POST /designation/create-designation', () => {
    it('should create a new designation with valid data', async () => {
      const mockDesignation = { id: '1', name: 'ADMIN' };
      createDesignation.mockResolvedValue({
        status: 201,
        message: 'Designation created successfully',
        data: mockDesignation,
      });

      const response = await request(app)
        .post('/designation/create-designation')
        .send({ name: 'Manager' });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        message: 'Designation created successfully',
        status: 201,
        data: mockDesignation,
      });
    }, 10000);

    it('should return 400 for invalid data', async () => {
      createDesignation.mockRejectedValue(new BadRequestError('Invalid designation data'));

      const response = await request(app)
        .post('/designation/create-designation')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: 'Invalid designation data' });
    });

    it('should handle internal server error', async () => {
      createDesignation.mockRejectedValue(new Error('Internal server error'));

      const response = await request(app)
        .post('/designation/create-designation')
        .send({ name: 'Manager' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ message: 'Internal server error' });
    });
  });

  describe('PUT /designation/update-designation/:id', () => {
    it('should update designation with valid data', async () => {
      const mockDesignation = { id: '1', name: 'Senior Manager' };
      updateDesignation.mockResolvedValue({
        status: 200,
        message: 'Designation updated successfully',
        data: mockDesignation,
      });

      const response = await request(app)
        .put('/designation/update-designation/1')
        .send({ name: 'Senior Manager' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        message: 'Designation updated successfully',
        status: 200,
        data: mockDesignation,
      });
    }, 10000);

    it('should return 404 for non-existent designation', async () => {
      updateDesignation.mockRejectedValue(new Error('Designation not found'));

      const response = await request(app)
        .put('/designation/update-designation/999')
        .send({ name: 'Senior Manager' });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ message: 'Designation not found' });
    });

    it('should return 400 for invalid data', async () => {
      updateDesignation.mockRejectedValue(new BadRequestError('Invalid designation data'));

      const response = await request(app)
        .put('/designation/update-designation/1')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: 'Invalid designation data' });
    });

    it('should handle internal server error', async () => {
      updateDesignation.mockRejectedValue(new Error('Internal server error'));

      const response = await request(app)
        .put('/designation/update-designation/1')
        .send({ name: 'Senior Manager' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ message: 'Internal server error' });
    });
  });

  describe('DELETE /designation/delete-designation/:id', () => {
    it('should delete designation with valid ID', async () => {
      deleteDesignation.mockResolvedValue({
        status: 200,
        message: 'Designation deleted successfully',
      });

      const response = await request(app).delete('/designation/delete-designation/1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        message: 'Designation deleted successfully',
        status: 200,
      });
    }, 10000);

    it('should return 404 for non-existent designation', async () => {
      deleteDesignation.mockRejectedValue(new Error('Designation not found'));

      const response = await request(app).delete('/designation/delete-designation/999');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ message: 'Designation not found' });
    });

    it('should handle internal server error', async () => {
      deleteDesignation.mockRejectedValue(new Error('Internal server error'));

      const response = await request(app).delete('/designation/delete-designation/1');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ message: 'Internal server error' });
    });
  });
});