import request from 'supertest';
import express from 'express';
import roleRouter from './index.js';
import * as roleService from './rolesService.js';
import { sendSuccess } from '../../utils/responseHandlers.js';

jest.mock('../../utils/responseHandlers.js', () => ({
  sendSuccess: jest.fn((res, data, message) => res.status(200).json({ message, data })),
}));

jest.mock('../../utils/db.js');

jest.mock('./rolesService.js', () => ({
  getRoleService: jest.fn(),
  createRoleService: jest.fn(),
  updateRoleService: jest.fn(),
  deleteRoleService: jest.fn(),
}));

jest.mock('../../middlewares/auth.js', () => ({
  isAuthenticated: (req, res, next) => {
    req.user = { company_id: 123, user_id: 1 };
    next();
  },
  authorized: () => (req, res, next) => next(),
}));

jest.mock('../../schemas/roleSchema.js', () => ({
  VALIDATE_ROLE_BY_ID: { validate: jest.fn(() => ({ error: null })) },
  VALIDATE_ROLE_SCHEMA: { validate: jest.fn(() => ({ error: null })) },
  VALIDATE_UPDATE_ROLE_STATUS: { validate: jest.fn(() => ({ error: null })) },
  VALIDATE_DELETE_ROLE: { validate: jest.fn(() => ({ error: null })) },
}));

describe('Role Controller Routes', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/role', roleRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('GET /role should return roles', async () => {
    roleService.getRoleService.mockResolvedValue([{ id: 1, role: 'Admin' }]);
    const res = await request(app).get('/role');
    expect(res.status).toBe(200);
    expect(sendSuccess).toHaveBeenCalledWith(expect.any(Object), [{ id: 1, role: 'Admin' }], 'get Roles successfully');
  });

  test('GET /role/:id should return role by ID', async () => {
    roleService.getRoleService.mockResolvedValue({ id: 1, role: 'Admin' });
    const res = await request(app).get('/role/1');
    expect(res.status).toBe(200);
    expect(sendSuccess).toHaveBeenCalledWith(expect.any(Object), { id: 1, role: 'Admin' }, 'get Roles by ID successfully');
  });

  test('POST /role/create-role should create a role', async () => {
    const payload = { role: 'Admin' };
    const res = await request(app).post('/role/create-role').send(payload);
    expect(res.status).toBe(200);
    expect(sendSuccess).toHaveBeenCalledWith(expect.any(Object), {}, 'Create Role successfully');
  });

  test('PUT /role/update-role/:id should update a role', async () => {
    const payload = { role: 'Admin' };
    const res = await request(app).put('/role/update-role/1').send(payload);
    expect(res.status).toBe(200);
    expect(sendSuccess).toHaveBeenCalledWith(expect.any(Object), {}, 'Update Role successfully');
  });

  test('DELETE /role/delete-role/:id should delete a role', async () => {
    const res = await request(app).delete('/role/delete-role/1');
    expect(res.status).toBe(200);
    expect(sendSuccess).toHaveBeenCalledWith(expect.any(Object), {}, 'Delete Role successfully');
  });
});
