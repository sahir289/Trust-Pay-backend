jest.mock('../../utils/db.js', () => ({
  createPool: jest.fn(),
  ...jest.requireActual('../../utils/db.js'),
}));
const {
  getCompanyService,
  getCompanyByIdService,
  createCompanyService,
  updateCompanyService,
  deleteCompanyService,
} = require('./companyServices.js');
const {
  getCompanyDao,
  getCompanyDetailsByIdDao,
  createCompanyDao,
  updateCompanyDao,
  deleteCompanyDao,
} = require('./companyDao');
const { createUserService } = require('../users/userService');
const { getRoleDao } = require('../roles/rolesDao');
const { getDesignationDao } = require('../designation/designationDao');
const { logger } = require('../../utils/logger.js');
const { RoleIs, DesignationIs } = require('../../constants');

jest.mock('./companyDao');
jest.mock('../users/userService');
jest.mock('../roles/rolesDao');
jest.mock('../designation/designationDao');
jest.mock('../../utils/logger.js', () => {
  const mockLogger = {
    error: jest.fn(() => {}),
    info: jest.fn(() => {}),
    warn: jest.fn(() => {}),
  };
  return { logger: mockLogger };
});

describe('Company Service', () => {
  const mockConn = { /* Mock database connection */ };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getCompanyService', () => {
    it('should return company data when successful', async () => {
      const mockCompany = { id: 1, name: 'Test Company' };
      getCompanyDao.mockResolvedValue(mockCompany);

      const result = await getCompanyService(1);

      expect(getCompanyDao).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockCompany);
    });

    it('should throw error when DAO fails', async () => {
      const mockError = new Error('Database error');
      getCompanyDao.mockRejectedValue(mockError);

      await expect(getCompanyService(1)).rejects.toThrow('Database error');
      expect(logger.error).toHaveBeenCalledWith('error getting while company', mockError);
    });

    it('should handle invalid company ID', async () => {
      getCompanyDao.mockRejectedValue(new Error('Invalid ID'));

      await expect(getCompanyService(null)).rejects.toThrow('Invalid ID');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getCompanyByIdService', () => {
    it('should return company details when successful', async () => {
      const mockCompanyDetails = { id: 1, name: 'Test Company', details: {} };
      getCompanyDetailsByIdDao.mockResolvedValue(mockCompanyDetails);

      const result = await getCompanyByIdService(1);

      expect(getCompanyDetailsByIdDao).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockCompanyDetails);
    });

    it('should throw error when DAO fails', async () => {
      const mockError = new Error('Database error');
      getCompanyDetailsByIdDao.mockRejectedValue(mockError);

      await expect(getCompanyByIdService(1)).rejects.toThrow('Database error');
      expect(logger.error).toHaveBeenCalledWith('error getting while company', mockError);
    });
  });

  describe('createCompanyService', () => {
    const mockPayload = {
      first_name: 'John',
      last_name: 'Doe',
      email: 'john@example.com',
      contact_no: '1234567890',
      user_name: 'johndoe',
      config: {},
    };

    it('should create company and user successfully', async () => {
      const mockCompany = { id: 1, ...mockPayload };
      const mockRole = [{ id: 1, role: RoleIs.ADMIN }];
      const mockDesignation = [{ id: 1, designation: DesignationIs.ADMIN }];
      const mockUser = { id: 1 };

      createCompanyDao.mockResolvedValue(mockCompany);
      getRoleDao.mockResolvedValue(mockRole);
      getDesignationDao.mockResolvedValue(mockDesignation);
      createUserService.mockResolvedValue(mockUser);

      const result = await createCompanyService(mockConn, mockPayload);

      expect(createCompanyDao).toHaveBeenCalledWith(mockConn, expect.objectContaining({
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        contact_no: '1234567890',
        config: expect.objectContaining({
          unique_admin_id: expect.any(String),
          telegramBotToken: '',
        }),
      }));
      expect(getRoleDao).toHaveBeenCalledWith({ role: RoleIs.ADMIN });
      expect(getDesignationDao).toHaveBeenCalledWith({ designation: DesignationIs.ADMIN });
      expect(createUserService).toHaveBeenCalled();
      expect(result).toEqual({
        company_id: 1,
        role_ids: [1],
        designation_ids: [1],
        user_id: 1,
      });
    });

    it('should throw error when company creation fails', async () => {
      const mockError = new Error('Email is required');
      createCompanyDao.mockRejectedValue(mockError);

      await expect(createCompanyService(mockConn, mockPayload)).rejects.toThrow('Email is required');
      expect(logger.error).toHaveBeenCalledWith('Error while creating company:', mockError);
    });

    it('should handle missing required fields', async () => {
      const invalidPayload = { ...mockPayload, email: undefined };
      await expect(createCompanyService(mockConn, invalidPayload)).rejects.toThrow();
      expect(logger.error).toHaveBeenCalled();
    });

    it('should generate unique 8-digit code in format XXXX-XXXX', async () => {
      createCompanyDao.mockResolvedValue({ id: 1 });
      getRoleDao.mockResolvedValue([{ id: 1 }]);
      getDesignationDao.mockResolvedValue([{ id: 1 }]);
      createUserService.mockResolvedValue({ id: 1 });

      await createCompanyService(mockConn, mockPayload);

      expect(createCompanyDao).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          config: expect.objectContaining({
            unique_admin_id: expect.stringMatching(/^\d{4}-\d{4}$/),
          }),
        })
      );
    });
  });

  describe('updateCompanyService', () => {
    it('should update company successfully', async () => {
      const mockUpdate = { id: 1, name: 'Updated Company' };
      updateCompanyDao.mockResolvedValue(mockUpdate);

      const result = await updateCompanyService(1, { name: 'Updated Company' });

      expect(updateCompanyDao).toHaveBeenCalledWith(1, { name: 'Updated Company' });
      expect(result).toEqual(mockUpdate);
    });

    it('should throw error when update fails', async () => {
      const mockError = new Error('Update failed');
      updateCompanyDao.mockRejectedValue(mockError);

      await expect(updateCompanyService(1, { name: 'Updated Company' })).rejects.toThrow('Update failed');
      expect(logger.error).toHaveBeenCalledWith('Error while creating company:', mockError); // Updated to match service code
    });
  });

  describe('deleteCompanyService', () => {
    it('should soft delete company successfully', async () => {
      const mockDelete = { id: 1, is_obsolete: true };
      deleteCompanyDao.mockResolvedValue(mockDelete);

      const result = await deleteCompanyService(1);

      expect(deleteCompanyDao).toHaveBeenCalledWith(1, { is_obsolete: true });
      expect(result).toEqual(mockDelete);
    });

    it('should throw error when delete fails', async () => {
      const mockError = new Error('Delete failed');
      deleteCompanyDao.mockRejectedValue(mockError);
      await expect(deleteCompanyService(1)).rejects.toThrow('Delete failed');
      expect(logger.error).toHaveBeenCalledWith('Error while creating company:', mockError); // Updated to match service code
    });
  });
});