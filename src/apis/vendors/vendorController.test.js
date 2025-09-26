import request from 'supertest';
import express from 'express';
import {
  createVendor,
  getVendors,
  getVendorsBySearch,
  getVendorCodes,
  getVendorById,
  updateVendor,
  deleteVendor,
} from './vendorController.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import {
  createVendorService,
  deleteVendorService,
  getVendorsCodeService,
  getVendorsService,
  updateVendorService,
  getVendorsBySearchService,
} from './vendorService.js';
import { ValidationError } from '../../utils/appErrors.js';
import { transactionWrapper } from '../../utils/db.js';
import { VALIDATE_VENDOR_SCHEMA, VALIDATE_VENDOR_BY_ID, VALIDATE_UPDATE_VENDOR_STATUS } from '../../schemas/vendorSchema.js';

jest.mock('../../utils/responseHandlers.js', () => ({
  sendSuccess: jest.fn((res, data, message) => res.status(200).json({ data, message })),
}));

jest.mock('./vendorService.js', () => ({
  createVendorService: jest.fn(),
  getVendorsService: jest.fn(),
  getVendorsBySearchService: jest.fn(),
  getVendorsCodeService: jest.fn(),
  updateVendorService: jest.fn(),
  deleteVendorService: jest.fn(),
}));

jest.mock('../../utils/db.js', () => ({
  transactionWrapper: jest.fn(fn => fn)
}));

jest.mock('../../schemas/vendorSchema.js', () => ({
  VALIDATE_VENDOR_SCHEMA: { validate: jest.fn() },
  VALIDATE_VENDOR_BY_ID: { validate: jest.fn() },
  VALIDATE_UPDATE_VENDOR_STATUS: { validate: jest.fn() },
}));

describe('Vendor Controller', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    // Mock routes
    app.post('/vendors/create-vendor', (req, res, next) => {
      req.user = { company_id: 'comp1', user_id: 'user1', role: 'admin', user_name: 'TestUser' };
      return createVendor(req, res, next);
    });
    app.get('/vendors/get', (req, res, next) => {
      req.user = { company_id: 'comp1', user_id: 'user1', role: 'admin', designation: 'OPERATIONS' };
      return getVendors(req, res, next);
    });
    app.get('/vendors', (req, res, next) => {
      req.user = { company_id: 'comp1', user_id: 'user1', role: 'admin', designation: 'OPERATIONS' };
      return getVendorsBySearch(req, res, next);
    });
    app.get('/vendors/codes', (req, res, next) => {
      req.user = { company_id: 'comp1', user_id: 'user1', role: 'admin', designation: 'OPERATIONS' };
      return getVendorCodes(req, res, next);
    });
    app.get('/vendors/:id', (req, res, next) => {
      req.user = { company_id: 'comp1', user_id: 'user1', role: 'admin' };
      return getVendorById(req, res, next);
    });
    app.put('/vendors/update-vendor/:id', (req, res, next) => {
      req.user = { company_id: 'comp1', user_id: 'user1', role: 'admin', user_name: 'TestUser' };
      return updateVendor(req, res, next);
    });
    app.delete('/vendors/delete-vendor/:user_id', (req, res, next) => {
      req.user = { company_id: 'comp1', user_id: 'user1', role: 'admin', user_name: 'TestUser' };
      return deleteVendor(req, res, next);
    });

    // Error-handling middleware to catch unhandled errors
    app.use((err, req, res) => {
      if (err instanceof ValidationError) {
        res.status(400).json({ error: err.message }); // Changed to 400 for validation errors
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createVendor', () => {
    test('should create a vendor successfully', async () => {
      VALIDATE_VENDOR_SCHEMA.validate.mockReturnValue({ error: null });
      createVendorService.mockResolvedValue({ id: 'vendor1' });
      const payload = {
        company_id: 'comp1',
        created_by: 'user1',
        name: 'Vendor A',
        status: 'active',
        updated_by: 'user1',
      };

      const res = await request(app).post('/vendors/create-vendor').send(payload);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ data: { id: 'vendor1' }, message: 'Vendor created successfully' });
      expect(VALIDATE_VENDOR_SCHEMA.validate).toHaveBeenCalledWith(payload);
      expect(createVendorService).toHaveBeenCalledWith({ 
        name: 'Vendor A',
        status: 'active',
        company_id: 'comp1',
        created_by: 'user1',
        updated_by: 'user1'
      });
      expect(transactionWrapper).toHaveBeenCalled();
      expect(sendSuccess).toHaveBeenCalledWith(expect.any(Object), { id: 'vendor1' }, 'Vendor created successfully');
    });

    test('should throw ValidationError for invalid payload', async () => {
      const req = {
        body: { name: '' },
        user: { company_id: 'comp1', user_id: 'user1', role: 'admin', user_name: 'TestUser' },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      VALIDATE_VENDOR_SCHEMA.validate.mockReturnValue({
        error: { details: [{ message: '"name" is not allowed to be empty' }] },
      });

      await expect(createVendor(req, res)).rejects.toThrow(ValidationError);
      expect(VALIDATE_VENDOR_SCHEMA.validate).toHaveBeenCalledWith(req.body);
      expect(createVendorService).not.toHaveBeenCalled();
    });
  });

  describe('getVendors', () => {
    test('should fetch all vendors successfully', async () => {
      const mockData = [{ id: 'vendor1', name: 'Vendor A', status: 'active' }];
      getVendorsService.mockResolvedValue(mockData);

      const res = await request(app).get('/vendors/get').query({ page: 1, limit: 10 });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ data: mockData, message: 'Vendors fetched successfully' });
      expect(getVendorsService).toHaveBeenCalledWith(
        { company_id: 'comp1', page: '1', limit: '10' },
        'admin',
        '1',
        '10',
        'OPERATIONS',
        'user1',
      );
      expect(sendSuccess).toHaveBeenCalledWith(expect.any(Object), mockData, 'Vendors fetched successfully');
    });
  });

  describe('getVendorsBySearch', () => {
    test('should fetch vendors by search successfully', async () => {
      const mockData = [{ id: 'vendor1', name: 'Vendor A', status: 'active' }];
      getVendorsBySearchService.mockResolvedValue(mockData);

      const res = await request(app).get('/vendors').query({ name: 'Vendor A', page: 1, limit: 10 });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ data: mockData, message: 'Vendors fetched successfully' });
      expect(getVendorsBySearchService).toHaveBeenCalledWith(
        { company_id: 'comp1', name: 'Vendor A', page: '1', limit: '10' },
        'admin',
        '1',
        '10',
        'OPERATIONS',
        'user1',
      );
      expect(sendSuccess).toHaveBeenCalledWith(expect.any(Object), mockData, 'Vendors fetched successfully');
    });
  });

  describe('getVendorCodes', () => {
    test('should fetch vendor codes successfully', async () => {
      const mockData = [{ code: 'V001' }];
      getVendorsCodeService.mockResolvedValue(mockData);

      const res = await request(app).get('/vendors/codes');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ data: mockData, message: 'Vendors fetched successfully' });
      expect(getVendorsCodeService).toHaveBeenCalledWith(
        { company_id: 'comp1' },
        'admin',
        'OPERATIONS',
        'user1',
        undefined,
        undefined,
        undefined,
        undefined
      );
      expect(sendSuccess).toHaveBeenCalledWith(expect.any(Object), mockData, 'Vendors fetched successfully');
    });
  });

  describe('getVendorById', () => {
    test('should fetch vendor by ID successfully', async () => {
      VALIDATE_VENDOR_BY_ID.validate.mockReturnValue({ error: null });
      const mockData = { id: 'vendor1', name: 'Vendor A', status: 'active' , designation : 'VENDOR_OPERATIONS'};
      getVendorsService.mockResolvedValue(mockData);
    
      const res = await request(app).get('/vendors/vendor1');
    
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        data: mockData,
        message: 'Vendor fetched successfully'
      });
      expect(VALIDATE_VENDOR_BY_ID.validate).toHaveBeenCalledWith({ id: 'vendor1' });
      expect(getVendorsService).toHaveBeenCalledWith(
        { id: 'vendor1', company_id: 'comp1' },
        'admin',
        null,
        null,
        undefined,
        'user1'
      );
      expect(sendSuccess).toHaveBeenCalledWith(expect.any(Object), mockData, 'Vendor fetched successfully');
    });
    

    test('should throw ValidationError for invalid vendor ID', async () => {
      const req = {
        params: { id: 'invalid' },
        user: { company_id: 'comp1', user_id: 'user1', role: 'admin' },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      VALIDATE_VENDOR_BY_ID.validate.mockReturnValue({
        error: { details: [{ message: '"id" must be a valid UUID' }] },
      });

      await expect(getVendorById(req, res)).rejects.toThrow(ValidationError);
      expect(VALIDATE_VENDOR_BY_ID.validate).toHaveBeenCalledWith(req.params);
      expect(getVendorsService).not.toHaveBeenCalled();
    });
  });

  describe('updateVendor', () => {
    test('should update vendor successfully', async () => {
      VALIDATE_VENDOR_BY_ID.validate.mockReturnValue({ error: null });
      VALIDATE_UPDATE_VENDOR_STATUS.validate.mockReturnValue({ error: null });
      updateVendorService.mockResolvedValue({ id: 'vendor1' });
      const payload = { name: 'Vendor B', status: 'inactive', updated_by: 'user1' };

      const res = await request(app).put('/vendors/update-vendor/vendor1').send(payload);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ data: { id: 'vendor1', updated_by: 'TestUser' }, message: 'Vendor updated successfully' });
      expect(VALIDATE_VENDOR_BY_ID.validate).toHaveBeenCalledWith({ id: 'vendor1' });
      expect(VALIDATE_UPDATE_VENDOR_STATUS.validate).toHaveBeenCalledWith(payload);
      expect(updateVendorService).toHaveBeenCalledWith(
        { id: 'vendor1', company_id: 'comp1' },
        { ...payload, updated_by: 'user1' }
      );
      expect(sendSuccess).toHaveBeenCalledWith(expect.any(Object), { id: 'vendor1', updated_by: 'TestUser' }, 'Vendor updated successfully');
    });

    test('should throw ValidationError for invalid vendor ID', async () => {
      const req = {
        params: { id: 'invalid' },
        body: { name: 'Vendor B', status: 'inactive' },
        user: { company_id: 'comp1', user_id: 'user1', role: 'admin', user_name: 'TestUser' },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      VALIDATE_VENDOR_BY_ID.validate.mockReturnValue({
        error: { details: [{ message: '"id" must be a valid UUID' }] },
      });

      await expect(updateVendor(req, res)).rejects.toThrow(ValidationError);
      expect(VALIDATE_VENDOR_BY_ID.validate).toHaveBeenCalledWith(req.params);
      expect(updateVendorService).not.toHaveBeenCalled();
    });

    test('should throw ValidationError for invalid payload', async () => {
      const req = {
        params: { id: 'vendor1' },
        body: { name: 'Vendor B', status: '' },
        user: { company_id: 'comp1', user_id: 'user1', role: 'admin', user_name: 'TestUser' },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      VALIDATE_VENDOR_BY_ID.validate.mockReturnValue({ error: null });
      VALIDATE_UPDATE_VENDOR_STATUS.validate.mockReturnValue({
        error: { details: [{ message: '"status" must be one of [active, inactive]' }] },
      });

      await expect(updateVendor(req, res)).rejects.toThrow(ValidationError);
      expect(VALIDATE_VENDOR_BY_ID.validate).toHaveBeenCalledWith(req.params);
      expect(VALIDATE_UPDATE_VENDOR_STATUS.validate).toHaveBeenCalledWith(req.body);
      expect(updateVendorService).not.toHaveBeenCalled();
    });
  });

  describe('deleteVendor', () => {
    test('should delete vendor successfully', async () => {
      deleteVendorService.mockResolvedValue({ id: 'user1' });

      const res = await request(app).delete('/vendors/delete-vendor/user1');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ data: { id: 'user1', deleted_by: 'TestUser' }, message: 'Vendor deleted successfully' });
      expect(deleteVendorService).toHaveBeenCalledWith({ company_id: 'comp1', user_id: 'user1' }, 'user1');
      expect(sendSuccess).toHaveBeenCalledWith(expect.any(Object), { id: 'user1', deleted_by: 'TestUser' }, 'Vendor deleted successfully');
    });
  });
});