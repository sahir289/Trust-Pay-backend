import {
    getRoleService,
    createRoleService,
    updateRoleService,
    deleteRoleService,
  } from './rolesService.js';
  import * as rolesDao from './rolesDao.js';
  import { logger } from '../../utils/logger.js';
  
  jest.mock('./rolesDao.js', () => ({
    getRoleDao: jest.fn(),
    createRoleDao: jest.fn(),
    updateRoleDao: jest.fn(),
    deleteRoleDao: jest.fn(),
  }));
  
  jest.mock('../../utils/logger.js', () => ({
    logger: { error: jest.fn() },
  }));
  
  describe('Role Service', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });
  
    describe('getRoleService', () => {
      it('should return data from getRoleDao', async () => {
        const mockData = [{ id: 1, role: 'Admin' }];
        rolesDao.getRoleDao.mockResolvedValue(mockData);
  
        const result = await getRoleService({ company_id: 123 });
        expect(result).toEqual(mockData);
        expect(rolesDao.getRoleDao).toHaveBeenCalledWith({ company_id: 123 });
      });
  
      it('should log and throw error if getRoleDao fails', async () => {
        const error = new Error('DB error');
        rolesDao.getRoleDao.mockRejectedValue(error);
  
        await expect(getRoleService({})).rejects.toThrow('DB error');
        expect(logger.error).toHaveBeenCalledWith('Error while fetching role', error);
      });
    });
  
    describe('createRoleService', () => {
      it('should call createRoleDao and return data', async () => {
        const mockData = { id: 1, role: 'Admin' };
        rolesDao.createRoleDao.mockResolvedValue(mockData);
  
        const result = await createRoleService('conn', { role: 'Admin' });
        expect(result).toEqual(mockData);
        expect(rolesDao.createRoleDao).toHaveBeenCalledWith('conn', { role: 'Admin' });
      });
  
      it('should log and throw error if createRoleDao fails', async () => {
        const error = new Error('DB error');
        rolesDao.createRoleDao.mockRejectedValue(error);
  
        await expect(createRoleService('conn', {})).rejects.toThrow('DB error');
        expect(logger.error).toHaveBeenCalledWith('Error while updating Role', error);
      });
    });
  
    describe('updateRoleService', () => {
      it('should call updateRoleDao and return data', async () => {
        const mockData = { id: 1, role: 'Manager' };
        rolesDao.updateRoleDao.mockResolvedValue(mockData);
  
        const result = await updateRoleService('conn', { id: 1 }, { role: 'Manager' });
        expect(result).toEqual(mockData);
        expect(rolesDao.updateRoleDao).toHaveBeenCalledWith('conn', { id: 1 }, { role: 'Manager' });
      });
  
      it('should log and throw error if updateRoleDao fails', async () => {
        const error = new Error('DB error');
        rolesDao.updateRoleDao.mockRejectedValue(error);
  
        await expect(updateRoleService('conn', {}, {})).rejects.toThrow('DB error');
        expect(logger.error).toHaveBeenCalledWith('Error while updating Role', 'error', error);
      });
    });
  
    describe('deleteRoleService', () => {
      it('should call deleteRoleDao and return data', async () => {
        const mockData = { success: true };
        rolesDao.deleteRoleDao.mockResolvedValue(mockData);
  
        const result = await deleteRoleService({ id: 1 }, { is_obsolete: true });
        expect(result).toEqual(mockData);
        expect(rolesDao.deleteRoleDao).toHaveBeenCalledWith({ id: 1 }, { is_obsolete: true });
      });
  
      it('should log and throw error if deleteRoleDao fails', async () => {
        const error = new Error('DB error');
        rolesDao.deleteRoleDao.mockRejectedValue(error);
  
        await expect(deleteRoleService({}, {})).rejects.toThrow('DB error');
        expect(logger.error).toHaveBeenCalledWith('Error while updating Role', 'error', error);
      });
    });
  });
  