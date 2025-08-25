import request from 'supertest';
import express from 'express';
import userHierarchy from './index.js';

jest.mock('./userHierarchyController.js', () => ({
  createUserHierarchy: jest.fn((req, res) =>
    res.status(201).json({ message: 'userHierarchy created' })
  ),
  getUserHierarchys: jest.fn((req, res) =>
    res.status(200).json({ message: 'Get userHierarchy successfully' })
  ),
  getUserHierarchysById: jest.fn((req, res) =>
    res.status(200).json({ message: 'Get userHierarchy successfully' })
  ),
  updateUserHierarchy: jest.fn((req, res) =>
    res.status(201).json({ message: 'userHierarchy updated successfully' })
  ),
  deleteUserHierarchy: jest.fn((req, res) =>
    res.status(200).json({ message: 'userHierarchy deleted successfully' })
  ),
}));

jest.mock('../../middlewares/auth.js', () => ({
  isAuthenticated: (req, res, next) => next(),
  authorized: () => (req, res, next) => next(),
}));

describe('userHierarchy Routes', () => {
  let app;
  const controller = require('./userHierarchyController.js');

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/userHierarchy', userHierarchy);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Test GET /userHierarchy
  test('GET /userHierarchy should return all user hierarchies', async () => {
    const res = await request(app).get('/userHierarchy');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Get userHierarchy successfully' });
    expect(controller.getUserHierarchys).toHaveBeenCalled();
  });

  // Test GET /userHierarchy/:id
  test('GET /userHierarchy/:id should return a specific user hierarchy', async () => {
    const res = await request(app).get('/userHierarchy/123');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Get userHierarchy successfully' });
    expect(controller.getUserHierarchysById).toHaveBeenCalled();
    expect(controller.getUserHierarchysById.mock.calls[0][0].params).toEqual({ id: '123' });
  });

  // Test POST /userHierarchy/create-userHierarchy
  test('POST /userHierarchy/create-userHierarchy should create a new user hierarchy', async () => {
    const newHierarchy = { name: 'UserHierarchy A', status: 'active' };
    const res = await request(app)
      .post('/userHierarchy/create-userHierarchy')
      .send(newHierarchy);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ message: 'userHierarchy created' });
    expect(controller.createUserHierarchy).toHaveBeenCalled();
    expect(controller.createUserHierarchy.mock.calls[0][0].body).toEqual(newHierarchy);
  });

  // Test POST /userHierarchy/create-userHierarchy with invalid data
  test('POST /userHierarchy/create-userHierarchy should handle invalid request data', async () => {
    // Mock controller to simulate error response
    controller.createUserHierarchy.mockImplementationOnce((req, res) =>
      res.status(400).json({ message: 'Invalid request data' })
    );
    const res = await request(app)
      .post('/userHierarchy/create-userHierarchy')
      .send({}); // Empty body to simulate invalid data
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: 'Invalid request data' });
    expect(controller.createUserHierarchy).toHaveBeenCalled();
  });

  // Test PUT /userHierarchy/update-userHierarchy/:id
  test('PUT /userHierarchy/update-userHierarchy/:id should update a user hierarchy', async () => {
    const updatedHierarchy = { name: 'Updated UserHierarchy', status: 'inactive' };
    const res = await request(app)
      .put('/userHierarchy/update-userHierarchy/123')
      .send(updatedHierarchy);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ message: 'userHierarchy updated successfully' });
    expect(controller.updateUserHierarchy).toHaveBeenCalled();
    expect(controller.updateUserHierarchy.mock.calls[0][0].params).toEqual({ id: '123' });
    expect(controller.updateUserHierarchy.mock.calls[0][0].body).toEqual(updatedHierarchy);
  });

  // Test PUT /userHierarchy/update-userHierarchy/:id with non-existent ID
  test('PUT /userHierarchy/update-userHierarchy/:id should handle non-existent user hierarchy', async () => {
    controller.updateUserHierarchy.mockImplementationOnce((req, res) =>
      res.status(404).json({ message: 'UserHierarchy not found' })
    );
    const res = await request(app)
      .put('/userHierarchy/update-userHierarchy/999')
      .send({ name: 'Non-existent', status: 'inactive' });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'UserHierarchy not found' });
    expect(controller.updateUserHierarchy).toHaveBeenCalled();
  });

  // Test DELETE /userHierarchy/delete-userHierarchy/:id
  test('DELETE /userHierarchy/delete-userHierarchy/:id should delete a user hierarchy', async () => {
    const res = await request(app).delete('/userHierarchy/delete-userHierarchy/123');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'userHierarchy deleted successfully' });
    expect(controller.deleteUserHierarchy).toHaveBeenCalled();
    expect(controller.deleteUserHierarchy.mock.calls[0][0].params).toEqual({ id: '123' });
  });

  // Test DELETE /userHierarchy/delete-userHierarchy/:id with non-existent ID
  test('DELETE /userHierarchy/delete-userHierarchy/:id should handle non-existent user hierarchy', async () => {
    controller.deleteUserHierarchy.mockImplementationOnce((req, res) =>
      res.status(404).json({ message: 'UserHierarchy not found' })
    );
    const res = await request(app).delete('/userHierarchy/delete-userHierarchy/999');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'UserHierarchy not found' });
    expect(controller.deleteUserHierarchy).toHaveBeenCalled();
  });
});