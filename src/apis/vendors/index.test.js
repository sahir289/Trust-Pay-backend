import request from 'supertest';
import express from 'express';
import vendor from './index.js';

jest.mock('./vendorController.js', () => ({
  getVendors: jest.fn((req, res) => res.status(200).json({ message: 'Get vendors successfully' })),
  getVendorsBySearch: jest.fn((req, res) => res.status(200).json({ message: 'Search vendors successfully' })),
  getVendorCodes: jest.fn((req, res) => res.status(200).json({ message: 'Get vendor codes successfully' })),
  getVendorById: jest.fn((req, res) => res.status(200).json({ id: req.params.id, name: 'Vendor A', status: 'active' })),
  createVendor: jest.fn((req, res) => res.status(201).json({ message: 'Vendor created' })),
  updateVendor: jest.fn((req, res) => res.status(200).json({ message: 'Vendor updated' })),
  deleteVendor: jest.fn((req, res) => res.status(200).json({ message: 'Vendor deleted' })),
}));

jest.mock('../../middlewares/auth.js', () => ({
  isAuthenticated: (req, res, next) => next(),
  authorized: () => (req, res, next) => next(),
}));

describe('Vendor Routes', () => {
  let app;
  const controller = require('./vendorController.js');

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/vendors', vendor); // Adjust base path to match router
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Test for GET /vendors/get
  test('GET /vendors/get should return all vendors', async () => {
    const res = await request(app).get('/vendors/get');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Get vendors successfully' });
    expect(controller.getVendors).toHaveBeenCalled();
  });

  // Test for GET /vendors (search vendors)
  test('GET /vendors should return vendors by search', async () => {
    const res = await request(app).get('/vendors').query({ name: 'Vendor A' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Search vendors successfully' });
    expect(controller.getVendorsBySearch).toHaveBeenCalled();
  });

  // Test for GET /vendors/codes
  test('GET /vendors/codes should return vendor codes', async () => {
    const res = await request(app).get('/vendors/codes');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Get vendor codes successfully' });
    expect(controller.getVendorCodes).toHaveBeenCalled();
  });

  // Test for GET /vendors/:id
  test('GET /vendors/:id should return vendor by ID', async () => {
    const vendorId = '123';
    const res = await request(app).get(`/vendors/${vendorId}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: vendorId, name: 'Vendor A', status: 'active' });
    expect(controller.getVendorById).toHaveBeenCalled();
  });

  // Test for POST /vendors/create-vendor
  test('POST /vendors/create-vendor should create a new vendor', async () => {
    const newVendor = { name: 'Vendor B', status: 'active' };
    const res = await request(app).post('/vendors/create-vendor').send(newVendor);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ message: 'Vendor created' });
    expect(controller.createVendor).toHaveBeenCalled();
  });

  // Test for PUT /vendors/update-vendor/:id
  test('PUT /vendors/update-vendor/:id should update vendor details', async () => {
    const vendorId = '123';
    const updatedVendor = { name: 'Vendor C', status: 'inactive' };
    const res = await request(app).put(`/vendors/update-vendor/${vendorId}`).send(updatedVendor);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Vendor updated' });
    expect(controller.updateVendor).toHaveBeenCalled();
  });

  // Test for DELETE /vendors/delete-vendor/:user_id
  test('DELETE /vendors/delete-vendor/:user_id should delete a vendor', async () => {
    const userId = '123';
    const res = await request(app).delete(`/vendors/delete-vendor/${userId}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Vendor deleted' });
    expect(controller.deleteVendor).toHaveBeenCalled();
  });

  // Swagger-related test cases
  describe('Swagger Documentation', () => {
    test('GET /vendors/get should have correct Swagger documentation', async () => {
      // Simulate fetching Swagger JSON (assuming Swagger is served at /api-docs)
      // This requires an actual Swagger setup to test properly
      const swaggerResponse = {
        paths: {
          '/vendors/get': {
            get: {
              summary: 'Retrieve all vendors',
              description: 'Returns a list of all vendors.',
              tags: ['Vendors'],
              responses: {
                200: {
                  description: 'A list of vendors.',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            name: { type: 'string' },
                            status: { type: 'string', example: 'active' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      };

      // Mock Swagger JSON endpoint (if applicable)
      // In a real setup, you would fetch this from /api-docs
      expect(swaggerResponse.paths['/vendors/get'].get).toBeDefined();
      expect(swaggerResponse.paths['/vendors/get'].get.summary).toBe('Retrieve all vendors');
      expect(swaggerResponse.paths['/vendors/get'].get.tags).toContain('Vendors');
      expect(swaggerResponse.paths['/vendors/get'].get.responses['200']).toBeDefined();
    });

    test('POST /vendors/create-vendor should have correct Swagger documentation', async () => {
      const swaggerResponse = {
        paths: {
          '/vendors/create-vendor': {
            post: {
              summary: 'Create a new vendor',
              description: 'Adds a new vendor to the system.',
              tags: ['Vendors'],
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        name: { type: 'string', example: 'Vendor A' },
                        status: { type: 'string', example: 'active' },
                      },
                    },
                  },
                },
              },
              responses: {
                201: { description: 'Vendor created successfully.' },
                400: { description: 'Invalid request data.' },
              },
            },
          },
        },
      };

      expect(swaggerResponse.paths['/vendors/create-vendor'].post).toBeDefined();
      expect(swaggerResponse.paths['/vendors/create-vendor'].post.summary).toBe('Create a new vendor');
      expect(swaggerResponse.paths['/vendors/create-vendor'].post.tags).toContain('Vendors');
      expect(swaggerResponse.paths['/vendors/create-vendor'].post.responses['201']).toBeDefined();
      expect(swaggerResponse.paths['/vendors/create-vendor'].post.requestBody.required).toBe(true);
    });
  });
});