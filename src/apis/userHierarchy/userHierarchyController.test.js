jest.mock('../../utils/db.js', () => ({
  createPool: jest.fn(),
  ...jest.requireActual('../../utils/db.js'),
}));
const {
    createUserHierarchy,
    getUserHierarchys,
    getUserHierarchysById,
    updateUserHierarchy,
    deleteUserHierarchy,
  } = require('./userHierarchyController');
  const {
    createUserHierarchyService,
    getUserHierarchyService,
    updateUserHierarchyService,
    deleteUserHierarchyService,
  } = require('./userHierarchyService');
  const { ValidationError } = require('../../utils/appErrors');
  const {
    VALIDATE_USER_HIERARCHY_SCHEMA,
    VALIDATE_USER_HIERARCHY_BY_ID,
    VALIDATE_UPDATE_USER_HIERARCHY_STATUS,
    VALIDATE_DELETE_USER_HIERARCHY,
  } = require('../../schemas/userHierarchySchema');
  
  jest.mock('./userHierarchyService');
  
  describe('UserHierarchy Controller', () => {
    let req, res, mockSendSuccess;
  
    beforeEach(() => {
      req = {
        body: {},
        params: {},
        query: {},
        user: { company_id: '123e4567-e89b-12d3-a456-426614174000', user_id: '456e7890-e89b-12d3-a456-426614174000', role: 'admin' },
      };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      mockSendSuccess = jest.fn();
      jest.spyOn(require('../../utils/responseHandlers'), 'sendSuccess').mockImplementation(mockSendSuccess);
  
      // Mock Joi validate method for schemas
      jest.spyOn(VALIDATE_USER_HIERARCHY_SCHEMA, 'validate').mockReturnValue({ error: null });
      jest.spyOn(VALIDATE_USER_HIERARCHY_BY_ID, 'validate').mockReturnValue({ error: null });
      jest.spyOn(VALIDATE_UPDATE_USER_HIERARCHY_STATUS, 'validate').mockReturnValue({ error: null });
      jest.spyOn(VALIDATE_DELETE_USER_HIERARCHY, 'validate').mockReturnValue({ error: null });
    });
  
    afterEach(() => {
      jest.clearAllMocks();
    });
  
    describe('createUserHierarchy', () => {
      it('should create user hierarchy successfully', async () => {
        req.body = { name: 'Test Hierarchy', parent_id: '789e4567-e89b-12d3-a456-426614174000', role_id: 'role123' };
        createUserHierarchyService.mockResolvedValue({ id: 'new123e4567-e89b-12d3-a456-426614174000' });
  
        await createUserHierarchy(req, res);
  
        expect(VALIDATE_USER_HIERARCHY_SCHEMA.validate).toHaveBeenCalledWith(req.body);
        expect(createUserHierarchyService).toHaveBeenCalledWith(
          {
            name: 'Test Hierarchy',
            parent_id: '789e4567-e89b-12d3-a456-426614174000',
            role_id: 'role123',
            company_id: '123e4567-e89b-12d3-a456-426614174000',
            created_by: '456e7890-e89b-12d3-a456-426614174000',
            updated_by: '456e7890-e89b-12d3-a456-426614174000',
          },
          'admin'
        );
        expect(mockSendSuccess).toHaveBeenCalledWith(res, {}, 'UserHierarchy created successfully');
      });
  
      it('should throw validation error for invalid input', async () => {
        req.body = { name: '' }; // Invalid: empty name, missing role_id
        jest.spyOn(VALIDATE_USER_HIERARCHY_SCHEMA, 'validate').mockReturnValue({
          error: {
            details: [{ message: '"name" is not allowed to be empty' }, { message: '"role_id" is required' }],
          },
        });
    
        await expect(createUserHierarchy(req, res)).rejects.toThrow(ValidationError);
        expect(createUserHierarchyService).not.toHaveBeenCalled();
      });
    });
  
    describe('getUserHierarchys', () => {
      it('should fetch user hierarchies successfully', async () => {
        req.query = { page: '1', limit: '10' };
        const mockData = [{ id: '1e4567-e89b-12d3-a456-426614174000', name: 'Hierarchy 1' }];
        getUserHierarchyService.mockResolvedValue(mockData);
  
        await getUserHierarchys(req, res);
  
        expect(getUserHierarchyService).toHaveBeenCalledWith(
          { company_id: '123e4567-e89b-12d3-a456-426614174000', page: '1', limit: '10' },
          'admin',
          '1',
          '10'
        );
        expect(mockSendSuccess).toHaveBeenCalledWith(res, mockData, 'UserHierarchy fetched successfully');
      });
    });
  
    describe('getUserHierarchysById', () => {
      it('should fetch user hierarchy by ID successfully', async () => {
        req.params = { id: '123e4567-e89b-12d3-a456-426614174000' };
        const mockData = { id: '123e4567-e89b-12d3-a456-426614174000', name: 'Hierarchy 1' };
        getUserHierarchyService.mockResolvedValue(mockData);
  
        await getUserHierarchysById(req, res);
  
        expect(VALIDATE_USER_HIERARCHY_BY_ID.validate).toHaveBeenCalledWith(req.params);
        expect(getUserHierarchyService).toHaveBeenCalledWith(
          { id: '123e4567-e89b-12d3-a456-426614174000', company_id: '123e4567-e89b-12d3-a456-426614174000' },
          {},
          'admin'
        );
        expect(mockSendSuccess).toHaveBeenCalledWith(res, mockData, 'UserHierarchy fetched successfully');
      });
  
      it('should throw validation error for invalid ID', async () => {
        req.params = { id: 'invalid-uuid' };
        jest.spyOn(VALIDATE_USER_HIERARCHY_BY_ID, 'validate').mockReturnValue({
          error: {
            details: [{ message: '"id" must be a valid UUID' }],
          },
        });
    
        await expect(getUserHierarchysById(req, res)).rejects.toThrow(ValidationError);
        expect(getUserHierarchyService).not.toHaveBeenCalled();
      });
    });
  
    describe('updateUserHierarchy', () => {
      it('should update user hierarchy successfully', async () => {
        req.params = { id: '123e4567-e89b-12d3-a456-426614174000' };
        req.body = { name: 'Updated Hierarchy', role_id: 'role123' };
        updateUserHierarchyService.mockResolvedValue({ id: '123e4567-e89b-12d3-a456-426614174000' });
  
        await updateUserHierarchy(req, res);
  
        expect(VALIDATE_USER_HIERARCHY_BY_ID.validate).toHaveBeenCalledWith(req.params);
        expect(VALIDATE_UPDATE_USER_HIERARCHY_STATUS.validate).toHaveBeenCalledWith(req.body);
        expect(updateUserHierarchyService).toHaveBeenCalledWith(
          { id: '123e4567-e89b-12d3-a456-426614174000', company_id: '123e4567-e89b-12d3-a456-426614174000' },
          { name: 'Updated Hierarchy', role_id: 'role123', updated_by: '456e7890-e89b-12d3-a456-426614174000' },
          'admin'
        );
        expect(mockSendSuccess).toHaveBeenCalledWith(res, {}, 'UserHierarchy updated successfully');
      });
  
      it('should throw validation error for invalid params', async () => {
        req.params = { id: 'invalid-uuid' };
        jest.spyOn(VALIDATE_USER_HIERARCHY_BY_ID, 'validate').mockReturnValue({
          error: {
            details: [{ message: '"id" must be a valid UUID' }],
          },
        });
    
        await expect(updateUserHierarchy(req, res)).rejects.toThrow(ValidationError);
        expect(updateUserHierarchyService).not.toHaveBeenCalled();
      });
  
      it('should throw validation error for invalid body', async () => {
        req.params = { id: '123e4567-e89b-12d3-a456-426614174000' };
        req.body = { name: '' };
        jest.spyOn(VALIDATE_UPDATE_USER_HIERARCHY_STATUS, 'validate').mockReturnValue({
          error: {
            details: [{ message: '"name" is not allowed to be empty' }],
          },
        });
    
        await expect(updateUserHierarchy(req, res)).rejects.toThrow(ValidationError);
        expect(updateUserHierarchyService).not.toHaveBeenCalled();
      });
    });
  
    describe('deleteUserHierarchy', () => {
      it('should delete user hierarchy successfully', async () => {
        req.params = { id: '123e4567-e89b-12d3-a456-426614174000' };
        deleteUserHierarchyService.mockResolvedValue({});
  
        await deleteUserHierarchy(req, res);
  
        expect(VALIDATE_DELETE_USER_HIERARCHY.validate).toHaveBeenCalledWith(req.params);
        expect(deleteUserHierarchyService).toHaveBeenCalledWith(
          { company_id: '123e4567-e89b-12d3-a456-426614174000', id: '123e4567-e89b-12d3-a456-426614174000' },
          '456e7890-e89b-12d3-a456-426614174000',
          'admin'
        );
        expect(mockSendSuccess).toHaveBeenCalledWith(res, {}, 'UserHierarchy deleted successfully');
      });
  
      it('should throw validation error for invalid ID', async () => {
        req.params = { id: 'invalid-uuid' };
        jest.spyOn(VALIDATE_DELETE_USER_HIERARCHY, 'validate').mockReturnValue({
          error: {
            details: [{ message: '"id" must be a valid UUID' }],
          },
        });
    
        await expect(deleteUserHierarchy(req, res)).rejects.toThrow(ValidationError);
        expect(deleteUserHierarchyService).not.toHaveBeenCalled();
      });
    });
  });