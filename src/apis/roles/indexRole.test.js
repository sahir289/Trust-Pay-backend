import request from 'supertest';
import express from 'express';
import role from './index.js';

// Mock the controller functions
jest.mock('./rolesController.js', () => ({
  getRoles: jest.fn((req, res) =>
    res.status(200).json({ message: 'Get role successfully' })
  ),
  getRolesById: jest.fn((req, res) =>
    res.status(200).json({ message: 'Get role successfully' })
  ),
  createRole: jest.fn((req, res) =>
    res.status(201).json({ message: 'Role created successfully' })
  ),
  updateRole: jest.fn((req, res) =>
    res.status(200).json({ message: 'Role updated successfully' })
  ),
  deleteRole: jest.fn((req, res) =>
    res.status(200).json({ message: 'Role deleted successfully' })
  ),
}));

// Mock auth middlewares
jest.mock('../../middlewares/auth.js', () => ({
  isAuthenticated: (req, res, next) => next(),
  authorized: () => (req, res, next) => next(),
}));

describe('role Routes', () => {
  let app;
  const controller = require('./rolesController.js');

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/role', role);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('GET /role should return all roles', async () => {
    const res = await request(app).get('/role');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Get role successfully' });
    expect(controller.getRoles).toHaveBeenCalled();
  });

  test('GET /role/:id should return a specific role', async () => {
    const res = await request(app).get('/role/1');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Get role successfully' });
    expect(controller.getRolesById).toHaveBeenCalled();
  });

  test('POST /role/create-role should create a new role', async () => {
    const res = await request(app)
      .post('/role/create-role')
      .send({ role: 'Manager', company_id: 123, created_by: 1 });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ message: 'Role created successfully' });
    expect(controller.createRole).toHaveBeenCalled();
  });

  test('PUT /role/update-role/:id should update a role', async () => {
    const res = await request(app)
      .put('/role/update-role/1')
      .send({ role: 'Senior Manager', company_id: 123 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Role updated successfully' });
    expect(controller.updateRole).toHaveBeenCalled();
  });

  test('DELETE /role/delete-role/:id should delete a role', async () => {
    const res = await request(app).delete('/role/delete-role/1');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Role deleted successfully' });
    expect(controller.deleteRole).toHaveBeenCalled();
  });
});
