import{
    getUsersService,
    getUsersBySearchService,
    getUsersByUserNameService,
    getUserByIdService,
    createUserService,
    userUpdateService,
    sendMailService
} from './userService.js';

import { expect, describe, beforeEach, it , } from '@jest/globals';
import { InternalServerError } from '../../utils/appErrors.js';
import { createHash } from '../../utils/bcryptPassword.js';
import { getConnection,executeQuery,rollback,commit,beginTransaction } from '../../utils/db.js';
import { generateUUID } from '../../utils/generateUUID.js';
import { generatePassword } from '../../utils/generatePassword.js';
import { sendCredentialsEmail } from '../../utils/sendMailer.js';
import { unblocked_countries } from '../../constants/index.js';
import {
  createUserDao,
  getUserByIdDao,
  getUsersByUserNameDao,
  getUsersDao,
  updateUserDao,
  getUsersBySearchDao,
  getAllUsersDao,
} from './userDao.js';
import { getDesignationDao } from '../designation/designationDao.js';
import { getRoleDao } from '../roles/rolesDao.js';
import { filterResponse } from '../../helpers/index.js';
import {
  columns,
  merchantColumns,
  Role,
  vendorColumns,
} from '../../constants/index.js';
import { createMerchantService } from '../merchants/merchantService.js';
import { createVendorService } from '../vendors/vendorService.js';
import { BadRequestError } from '../../utils/appErrors.js';
import * as userDao from './userDao.js';
import { logger } from '../../utils/logger.js';
// Reusable mock connection object for all tests
let mockConn;
import {
  createUserHierarchyDao,
  getUserHierarchysDao,
  updateUserHierarchyDao,
} from '../userHierarchy/userHierarchyDao.js';
import { getMerchantByUserIdDao } from '../merchants/merchantDao.js';
import { getCompanyByIDDao } from '../company/companyDao.js';
jest.mock('../../utils/sockets.js', () => ({
  newTableEntry: jest.fn().mockResolvedValue(),
}));
jest.mock('../../utils/db.js', () => ({
    getConnection: jest.fn(),
    beginTransaction: jest.fn(),
    commit: jest.fn(),
    rollback: jest.fn(),
    executeQuery: jest.fn(),
    createPool: jest.fn(() => ({
        connect: jest.fn(),
        on: jest.fn(),
        end: jest.fn(),
        query: jest.fn(),
    })),
}));
jest.mock('../../utils/bcryptPassword.js', () => ({
    createHash: jest.fn((password) => `hashed_${password}`),
}));
jest.mock('../../utils/generateUUID.js', () => ({
    generateUUID: jest.fn(() => 'unique-uuid'),
}));
jest.mock('../../utils/generatePassword.js', () => ({
    generatePassword: jest.fn(() => 'TempPass@123'),
}));
jest.mock('../../utils/sendMailer.js', () => ({
    sendCredentialsEmail: jest.fn(),
}));
jest.mock('../../utils/logger.js', () => ({ logger: { info: jest.fn(), error: jest.fn() } }));
jest.mock('../../helpers/index.js', () => ({ filterResponse: jest.fn((data) => data) }));
jest.mock('../designation/designationDao.js', () => ({
    getDesignationDao: jest.fn(),
}));
jest.mock('../roles/rolesDao.js', () => ({
    getRoleDao: jest.fn(),
}));
jest.mock('./userDao.js', () => ({
    createUserDao: jest.fn(),
    getUserByIdDao: jest.fn(),
    getUsersByUserNameDao: jest.fn(),
    getUsersDao: jest.fn(),
    updateUserDao: jest.fn(),
    getUsersBySearchDao: jest.fn(),
    getAllUsersDao: jest.fn(),
    getUsersCountDao: jest.fn(),
    getUsersBySearchCountDao: jest.fn(),
}));

jest.mock('../merchants/merchantDao.js', () => ({
    getMerchantByUserIdDao: jest.fn(),
}));
jest.mock('../company/companyDao.js', () => ({
    getCompanyByIDDao: jest.fn(),
}));
jest.mock('../merchants/merchantService.js', () => ({
    createMerchantService: jest.fn(),
}));
jest.mock('../vendors/vendorService.js', () => ({
    createVendorService: jest.fn(),
}));
jest.mock('../userHierarchy/userHierarchyDao.js', () => ({
    createUserHierarchyDao: jest.fn(),
    getUserHierarchysDao: jest.fn(),
    updateUserHierarchyDao: jest.fn(),
}));
jest.mock('../../utils/logger.js', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    log: jest.fn(),
  },
}));
jest.mock('../../utils/sendMailer.js', () => ({
  sendCredentialsEmail: jest.fn().mockResolvedValue(true),
}));
jest.mock('../roles/rolesDao.js', () => ({
  getRoleDao: jest.fn(),
}));
jest.mock('../designation/designationDao.js', () => ({
  getDesignationDao: jest.fn(),
}));
describe('userService functions', () => {
    beforeEach(() => {
        mockConn = {
        query: jest.fn(),
        };
    });
    it('createUserService: should create user successfully for MERCHANT role', async () => {
        const reqBody = {
            user_name: 'Test User',
            first_name: 'Test',
            last_name: 'User',
            is_enabled: true,
            contact_no: '1234567890',
            email: 'asd@gmail.com',
            password:'TempPass@123',
            created_by: 'user1',
            updated_by: 'user1',
            payin_notify: true,
            payout_notify: true,
            return: 'http://return.url',
            site: 'http://site.url',
            role: 'MERCHANT',
            designation_id: 1,
            role_id: 2,
            country: 'US',
            unique_admin_id: null,
            address: '123 Test St',

            company_id: 'company123',
        };
        const role = { SUPER_ADMIN: 'SUPER_ADMIN',
                        ADMIN: 'ADMIN',
                        TRANSACTIONS: 'TRANSACTIONS',
                        OPERATIONS: 'OPERATIONS',
                        MERCHANT_ADMIN: 'MERCHANT_ADMIN',
                        VENDOR_ADMIN: 'VENDOR_ADMIN',
                        MERCHANT: 'MERCHANT',
                        SUB_MERCHANT: 'SUB_MERCHANT',
                        MERCHANT_OPERATIONS: 'MERCHANT_OPERATIONS',
                        VENDOR: 'VENDOR',
                        VENDOR_OPERATIONS: 'VENDOR_OPERATIONS',
                        BOT: 'BOT',};
        getConnection.mockResolvedValue(mockConn);
        getRoleDao.mockResolvedValue([{ id: 2, role_name: 'MERCHANT' }]);
        getDesignationDao.mockResolvedValue([{ id: 1, designation: 'Manager' }]);
        createUserDao.mockResolvedValue({ id: 1 });
        getCompanyByIDDao.mockResolvedValue([{ config: { defaultBankId: 1 } }]);
        createMerchantService.mockResolvedValue({ id: 1 });
        createUserHierarchyDao.mockResolvedValue({ id: 1 });
        await expect(createUserService(mockConn, reqBody, role)).resolves.toBeDefined();
        expect(getConnection).toHaveBeenCalled();
        expect(createUserDao).toHaveBeenCalledWith(
            expect.objectContaining({
                user_name: 'Test User',
                contact_no: '1234567890',
                email: 'asd@gmail.com',
                role: 'MERCHANT',
                designation_id: 1,
                password: 'hashed_TempPass@123',
                user_id: 'unique-uuid',
                created_by: 'user1',
                company_id: 'company123',
                status: 'ACTIVE',
                bank_id: 1,
                country: 'US',
                kyc_status: 'PENDING',
                kyc_reject_reason: null,
                is_creator: true,
                is_system_user: false,
                is_login_disabled: false,
                is_2fa_enabled: false,
                profile_complete: false,
                contact_no_verified: false,
                email_verified: false,
                password_changed: false,
                last_password_change: expect.any(Date),
                created_at: expect.any(Date),
                updated_at: expect.any(Date),
                updated_by: 'user1',
                deleted_at: null,
                deleted_by: null,
                reset_password_token: null,
                reset_password_expires: null,
                temp_password: null,
                temp_password_expires: null,
                authy_id: null,
                authy_status: null,
                authy_error: null,
                login_attempts: 0,
                lock_until: null,
                last_login: null,
                previous_login: null,
                two_fa_secret: null,
                two_fa_temp_secret: null,
                two_fa_enabled: false,
                two_fa_backup_codes: null,
                profile_image: null,
                dob: null,
                address: null,
                city: null,
                state: null,
                zip: null,
                kyc_submitted_at: null,
                kyc_verified_at: null,
                kyc_rejected_at: null,
                kyc_documents: null,
                additional_info: null,
                is_enabled: true,
                kyc_reviewed_by: null,
                kyc_reviewed_at: null,
                kyc_rejection_reason: null,
                country_code: 'US',
                timezone: 'UTC',
            }),
        );
        expect(createUserHierarchyDao).toHaveBeenCalledWith(
            expect.objectContaining({
                user_id: 1,
                manager_id: null,
                created_by: 'user1',
                updated_by: 'user1',
                company_id: 'company123',
                created_at: expect.any(Date),
                updated_at: expect.any(Date),
                deleted_at: null,
                deleted_by: null,
            }),
        );
        expect(mockConn.query).toHaveBeenCalledWith('COMMIT');
        expect(sendCredentialsEmail).toHaveBeenCalledWith(
            [{email: 'asd@gmail.com',
            username: 'unique-uuid',
            oassword: 'TempPass@123',
            code: 'TST0001',
            designation: 'Manager',
            companyName: undefined,
            role: 'MERCHANT',}]
        );
    });
    it('createUserService: should create user successfully for VENDOR role', async () => {
        const reqBody = {
            user_name: 'Test User',
            contact_no: '1234567890',
            email: 'asd@gmail.com',
            role: 'VENDOR',
            designation_id: 1,
            merchant_id: 1,
        };
        const user = { company_id: 'company123', user_id: 'user1', role: 'ADMIN' };
        getConnection.mockResolvedValue(mockConn);
        getRoleDao.mockResolvedValue([{ id: 3, role_name: 'VENDOR' }]);
        getDesignationDao.mockResolvedValue([{ id: 1, designation: 'Manager' }]);
        getMerchantByUserIdDao.mockResolvedValue([{ id: 1, name: 'Test Merchant', country: 'US' }]);
        createUserDao.mockResolvedValue({ id: 1 });
        createVendorService.mockResolvedValue({ id: 1 });
        createUserHierarchyDao.mockResolvedValue({ id: 1 });
        await expect(createUserService(mockConn, reqBody, user)).resolves.toBeDefined();
        expect(getConnection).toHaveBeenCalled();
        expect(createUserDao).toHaveBeenCalledWith(
            expect.objectContaining({
                user_name: 'Test User',
                contact_no: '1234567890',
                email: 'asd@gmail.com',
                role: 'VENDOR',
                designation_id: 1,
                password: 'hashed_TempPass@123',
                user_id: 'unique-uuid',
                created_by: 'user1',
                company_id: 'company123',
                status: 'ACTIVE',
                bank_id: null,
                country: 'US',
                kyc_status: 'PENDING',
                kyc_reject_reason: null,
                is_creator: true,
                is_system_user: false,
                is_login_disabled: false,
                is_2fa_enabled: false,
                profile_complete: false,
                contact_no_verified: false,
                email_verified: false,
                password_changed: false,
                last_password_change: expect.any(Date),
                created_at: expect.any(Date),
                updated_at: expect.any(Date),
                updated_by: 'user1',
                deleted_at: null,
                deleted_by: null,
                reset_password_token: null,
                reset_password_expires: null,
                temp_password: null,
                temp_password_expires: null,
                authy_id: null,
                authy_status: null,
                authy_error: null,
                login_attempts: 0,
                lock_until: null,
                last_login: null,
                previous_login: null,
                two_fa_secret: null,
                two_fa_temp_secret: null,
                two_fa_enabled: false,
                two_fa_backup_codes: null,
                profile_image: null,
                dob: null,
                address: null,
                city: null,
                state: null,
                zip: null,
                kyc_submitted_at: null,
                kyc_verified_at: null,
                kyc_rejected_at: null,
                kyc_documents: null,
                additional_info: null,
                is_enabled: true,
                kyc_reviewed_by: null,
                kyc_reviewed_at: null,
                kyc_rejection_reason: null,
                country_code: 'US',
                timezone: 'UTC',
            }),
        );
        expect(createVendorService).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'Test User',
                email: 'asd@gmail.com',
                contact_no: '1234567890',
                created_by: 'user1',
                company_id: 'company123',
                status: 'ACTIVE',
                created_at: expect.any(Date),
                updated_at: expect.any(Date),
                updated_by: 'user1',
                deleted_at: null,
                deleted_by: null,
                config: {},
                user_id: 1,
                merchant_id: 1,
                country: 'US',
                kyc_status: 'PENDING',
                kyc_reject_reason: null,
                is_vendor_user: true,
                is_system_vendor: false,
                profile_complete: false,
                kyc_documents: null,
                kyc_submitted_at: null,
                kyc_verified_at: null,
                kyc_rejected_at: null,
                kyc_reviewed_by: null,
                kyc_reviewed_at: null,
                kyc_rejection_reason: null,
                additional_info: null,
                is_enabled: true,
            }),
        );
    });
    it('createUserService: should throw error if role is invalid', async () => {
        const reqBody = {
            user_name: 'Test User',
            contact_no: '1234567890',
            email: 'asd@gmail.com',
            role: 'INVALID_ROLE',
            designation_id: 1,
            merchant_id: 1,
        };
        const user = { company_id: 'company123', user_id: 'user1', role: 'ADMIN' };
        getConnection.mockResolvedValue(mockConn);
        getRoleDao.mockResolvedValue([]);
        await expect(createUserService(null, reqBody, user)).rejects.toThrow(BadRequestError);
        expect(getConnection).toHaveBeenCalled();
        expect(mockConn.query).toHaveBeenCalledWith('ROLLBACK');
        expect(logger.error).toHaveBeenCalledWith('Error in createUserService: Invalid role: INVALID_ROLE');
        expect(mockConn.query).toHaveBeenCalledWith('ROLLBACK');
        expect(createUserDao).not.toHaveBeenCalled();
        expect(createMerchantService).not.toHaveBeenCalled();
        expect(createVendorService).not.toHaveBeenCalled();
        expect(createUserHierarchyDao).not.toHaveBeenCalled();
        expect(sendCredentialsEmail).not.toHaveBeenCalled();
    });
    it('getUsersService: should get users successfully', async () => {
        const filters = { status: 'ACTIVE' };
        const page = 1;
        const limit = 10;
        const sortBy = 'created_at';
        const order = 'ASC';
        const role = 'ADMIN';
        const user = { company_id: 'company123', user_id: 'user1', role: 'ADMIN' };
        getUsersDao.mockResolvedValue([{ id: 1, user_name: 'Test User' }]);
    userDao.getUsersCountDao.mockResolvedValue([{ count: 1 }]);
            await expect(getUsersService(filters, page, limit, sortBy, order, role, user)).resolves.toMatchObject({
                data: [{ id: 1, user_name: 'Test User' }],
                total: 1,
                page,
                limit,
            });
        expect(getUsersDao).toHaveBeenCalledWith(filters, page, limit, sortBy, order, role, user);
    expect(userDao.getUsersCountDao).toHaveBeenCalledWith(filters, role, user);
        expect(filterResponse).toHaveBeenCalledWith([{ id: 1, user_name: 'Test User' }], columns.userColumns);
    });
    it('getUsersService: should handle errors and throw InternalServerError', async () => {
        const filters = { status: 'ACTIVE' };
        const page = 1;
        const limit = 10;
        const sortBy = 'created_at';
        const order = 'ASC';
        const role = 'ADMIN';
        const user = { company_id: 'company123', user_id: 'user1', role: 'ADMIN' };
        getUsersDao.mockRejectedValue(new Error('Database error'));
        await expect(getUsersService(filters, page, limit, sortBy, order, role, user)).rejects.toThrow(InternalServerError);
        expect(getUsersDao).toHaveBeenCalledWith(filters, page, limit, sortBy, order, role, user);
        expect(logger.error).toHaveBeenCalledWith('Error in getUsersService:', new Error('Database error'));
    });
    it('getUsersBySearchService: should get users by search successfully', async () => {
        const search = 'Test';
        const page = 1;
        const limit = 10;
        const user = { company_id: 'company123', user_id: 'user1', role: 'ADMIN' };
        getUsersBySearchDao.mockResolvedValue([{ id: 1, user_name: 'Test User' }]);
    userDao.getUsersBySearchCountDao.mockResolvedValue([{ count: 1 }]);
            await expect(getUsersBySearchService(search, page, limit, user)).resolves.toMatchObject({
                data: [{ id: 1, user_name: 'Test User' }],
                total: 1,
                page,
                limit,
            });
        expect(getUsersBySearchDao).toHaveBeenCalledWith(search, page, limit, user);
    expect(userDao.getUsersBySearchCountDao).toHaveBeenCalledWith(search, user);
        expect(filterResponse).toHaveBeenCalledWith([{ id: 1, user_name: 'Test User' }], columns.userColumns);
    });
    it('getUsersBySearchService: should handle errors and throw InternalServerError', async () => {
        const search = 'Test';
        const page = 1;
        const limit = 10;
        const user = { company_id: 'company123', user_id: 'user1', role: 'ADMIN' };
        getUsersBySearchDao.mockRejectedValue(new Error('Database error'));
        await expect(getUsersBySearchService(search, page, limit, user)).rejects.toThrow(InternalServerError);
        expect(getUsersBySearchDao).toHaveBeenCalledWith(search, page, limit, user);
        expect(logger.error).toHaveBeenCalledWith('Error in getUsersBySearchService:', new Error('Database error'));
    });
    it('getUsersByUserNameService: should get users by username successfully', async () => {
        const username = 'TestUser';
        const user = { company_id: 'company123', user_id: 'user1', role: 'ADMIN' };
        getUsersByUserNameDao.mockResolvedValue([{ id: 1, user_name: 'Test User' }]);
        await expect(getUsersByUserNameService(username, user)).resolves.toEqual([{ id: 1, user_name: 'Test User' }]);
        expect(getUsersByUserNameDao).toHaveBeenCalledWith(username, user);
        expect(filterResponse).toHaveBeenCalledWith([{ id: 1, user_name: 'Test User' }], columns.userColumns);
    });
    it('getUsersByUserNameService: should handle errors and throw InternalServerError', async () => {
        const username = 'TestUser';
        const user = { company_id: 'company123', user_id: 'user1', role: 'ADMIN' };
        getUsersByUserNameDao.mockRejectedValue(new Error('Database error'));
        await expect(getUsersByUserNameService(username, user)).rejects.toThrow(InternalServerError);
        expect(getUsersByUserNameDao).toHaveBeenCalledWith(username, user);
        expect(logger.error).toHaveBeenCalledWith('Error in getUsersByUserNameService:', new Error('Database error'));
    });
    it('getUserByIdService: should get user by ID successfully', async () => {
        const userId = 1;
        const user = { company_id: 'company123', user_id: 'user1', role: 'ADMIN' };
        getUserByIdDao.mockResolvedValue([{ id: 1, user_name: 'Test User' }]);
        await expect(getUserByIdService(userId, user)).resolves.toEqual({ id: 1, user_name: 'Test User' });
        expect(getUserByIdDao).toHaveBeenCalledWith(userId, user);
        expect(filterResponse).toHaveBeenCalledWith([{ id: 1, user_name: 'Test User' }], columns.userColumns);
    });
    it('getUserByIdService: should handle errors and throw InternalServerError', async () => {
        const userId = 1;
        const user = { company_id: 'company123', user_id: 'user1', role: 'ADMIN' };
        getUserByIdDao.mockRejectedValue(new Error('Database error'));
        await expect(getUserByIdService(userId, user)).rejects.toThrow(InternalServerError);
        expect(getUserByIdDao).toHaveBeenCalledWith(userId, user);
        expect(logger.error).toHaveBeenCalledWith('Error in getUserByIdService:', new Error('Database error'));
    });
    it('userUpdateService: should update user successfully', async () => {
        const userId = 1;
        const updateData = { user_name: 'Updated User' };
        const user = { company_id: 'company123', user_id: 'user1', role: 'ADMIN' };
        getConnection.mockResolvedValue(mockConn);
        getUserByIdDao.mockResolvedValue([{ id: 1, user_name: 'Test User', role: 'MERCHANT' }]);
        updateUserDao.mockResolvedValue({ affectedRows: 1 });
        await expect(userUpdateService(mockConn, userId, updateData, user)).resolves.toBeUndefined();
        expect(getConnection).toHaveBeenCalled();
        expect(getUserByIdDao).toHaveBeenCalledWith(userId, user);
        expect(updateUserDao).toHaveBeenCalledWith(mockConn, userId, expect.objectContaining({
            user_name: 'Updated User',
            updated_by: 'user1',
            updated_at: expect.any(Date),
        }), user);
        expect(mockConn.query).toHaveBeenCalledWith('COMMIT');
    });
    it('userUpdateService: should handle errors and throw InternalServerError', async () => {
        const userId = 1;
        const updateData = { user_name: 'Updated User' };
        const user = { company_id: 'company123', user_id: 'user1', role: 'ADMIN' };
        getConnection.mockResolvedValue(mockConn);
        getUserByIdDao.mockResolvedValue([{ id: 1, user_name: 'Test User', role: 'MERCHANT' }]);
        updateUserDao.mockRejectedValue(new Error('Database error'));
        await expect(userUpdateService(mockConn, userId, updateData, user)).rejects.toThrow(InternalServerError);
        expect(getConnection).toHaveBeenCalled();
        expect(getUserByIdDao).toHaveBeenCalledWith(userId, user);
        expect(updateUserDao).toHaveBeenCalledWith(mockConn, userId, expect.objectContaining({
            user_name: 'Updated User',
            updated_by: 'user1',
            updated_at: expect.any(Date),
        }), user);
        expect(logger.error).toHaveBeenCalledWith('Error in userUpdateService:', new Error('Database error'));
        expect(mockConn.query).toHaveBeenCalledWith('ROLLBACK');
    });
    it('sendMailService: should send mail successfully', async () => {
        sendCredentialsEmail.mockClear();
        const emails = ['asd@gmail.com', 'qwe@hmail.com'];
        const subject = 'Test Subject';
        const body = 'Test Body';
        await expect(sendMailService(emails, subject, body)).resolves.toBeUndefined();
        expect(sendCredentialsEmail).toHaveBeenCalledWith(
            emails.map(email => ({
                email,
                subject,
                body,
            })),
        );
    });
    it('sendMailService: should handle errors and throw InternalServerError', async () => {
        sendCredentialsEmail.mockClear();
        const emails = ['asd@gmail.com', 'qwe@gmail.com'];
        const subject = 'Test Subject';
        const body = 'Test Body';
        sendCredentialsEmail.mockRejectedValue(new Error('Email service error'));
        // Assert sendCredentialsEmail is called before awaiting the error
        const sendMailPromise = sendMailService(emails, subject, body);
        expect(sendCredentialsEmail).toHaveBeenCalledWith(
            emails.map(email => ({
                email,
                subject,
                body,
            })),
        );
        await expect(sendMailPromise).rejects.toThrow(Error);
        expect(logger.error).toHaveBeenCalledWith('Error in sendMailService:', new Error('Email service error'));
    });
    it('createUserService: should throw error if country is blocked', async () => {
        const reqBody = {
            user_name: 'Test User',
            contact_no: '1234567890',
            email: 'asd@gmail.com',
            role: 'MERCHANT',
            designation_id: 1,
            country: 'IR', // Blocked country
        };
        const user = { company_id: 'company123', user_id: 'user1', role: 'ADMIN' };
        getConnection.mockResolvedValue(mockConn);
        getRoleDao.mockResolvedValue([{ id: 2, role_name: 'MERCHANT' }]);
        await expect(createUserService(mockConn, reqBody, user)).rejects.toThrow(BadRequestError);
        expect(getConnection).toHaveBeenCalled();
        expect(mockConn.query).toHaveBeenCalledWith('ROLLBACK');
        expect(logger.error).toHaveBeenCalledWith('Error in createUserService: Country IR is blocked');
        expect(createUserDao).not.toHaveBeenCalled();
        expect(createMerchantService).not.toHaveBeenCalled();
        expect(createVendorService).not.toHaveBeenCalled();
        expect(createUserHierarchyDao).not.toHaveBeenCalled();
        expect(sendCredentialsEmail).not.toHaveBeenCalled();
    });
});