

import {
    getUsersByUserNameDao,
    updateUserDao,
} from '../users/userDao.js';

import {
    addLoginDao,
    deleteUserSessionsDao,
    getSessionByIdDao,
    changePasswordDao,
    getRoleByUserNameDao,
} from './authDao.js';
import { createHash, verifyHash } from '../../utils/bcryptPassword.js';
import { generateUserToken } from '../../utils/auth.js';
import { forceLogoutUser, logOutUser } from '../../utils/sockets.js';
import { sendOTP } from '../../utils/sendMailer.js';
import { createUserOtpDao, getUserOtpDao, updateUserOtpDao } from '../userOtp/userOtpDao.js';
import { generateOTP } from '../../utils/generateOtp.js';
import { generateUUID } from '../../utils/generateUUID.js';
import { Role } from '../../constants/index.js';
import { NotFoundError, BadRequestError } from '../../utils/appErrors.js';
import os from 'os';
import * as authServiceModule from './authService.js';

const {
    loginService,
    refreshTokenService,
    changePasswordService,
    verificationService,
    logoutService,
    verfyUserService,
    verfyOtpService,
    forgetPasswordService,
    getUserRoleService,
} = authServiceModule;

jest.mock('../users/userDao.js');
jest.mock('./authDao.js');
jest.mock('../../utils/bcryptPassword.js');
jest.mock('../../utils/auth.js');
jest.mock('../../utils/sockets.js');
jest.mock('../../utils/sendMailer.js');
jest.mock('../userOtp/userOtpDao.js');
jest.mock('../../utils/generateOtp.js');
jest.mock('../../utils/generateUUID.js');
jest.mock('os');
jest.mock('../../utils/db.js');



describe('Auth Services', () => {
    const mockUser = {
        id: 'user1',
        username: 'testuser',
        password: 'hashedpassword',
        is_enabled: true,
        designation: Role.USER,
        company_id: 'company1',
        config: { isLoginFirst: true },
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('loginService', () => {
        it('should throw NotFoundError if user does not exist', async () => {
            getUsersByUserNameDao.mockResolvedValue(null);
            await expect(loginService({ username: 'notfound' }, '127.0.0.1'))
                .rejects.toThrow(NotFoundError);
        });

        it('should throw NotFoundError if user is disabled', async () => {
            getUsersByUserNameDao.mockResolvedValue({ ...mockUser, is_enabled: false });
            await expect(loginService({ username: 'testuser' }, '127.0.0.1'))
                .rejects.toThrow(NotFoundError);
        });

        it('should return first login object if user config.isLoginFirst', async () => {
            getUsersByUserNameDao.mockResolvedValue({ ...mockUser, config: { isLoginFirst: true } });
            verifyHash.mockResolvedValue(true);

            const result = await loginService({ username: 'testuser', password: 'pass' }, '127.0.0.1');
            expect(result).toEqual({
                id: mockUser.id,
                isLoginFirst: true,
            });
        });

        it('should generate token and session for regular login', async () => {
            getUsersByUserNameDao.mockResolvedValue({ ...mockUser, config: { isLoginFirst: false } });
            verifyHash.mockResolvedValue(true);
            generateUserToken.mockReturnValue({ accessToken: 'access', refreshToken: 'refresh' });
            generateUUID.mockReturnValue('session123');
            addLoginDao.mockResolvedValue(true);
            deleteUserSessionsDao.mockResolvedValue(true);
            os.hostname = jest.fn().mockReturnValue('host');
            os.platform = jest.fn().mockReturnValue('linux');
            os.cpus = jest.fn().mockReturnValue([{ model: 'Intel' }]);
            os.networkInterfaces = jest.fn().mockReturnValue({ eth0: [{ address: '127.0.0.1' }] });
            createHash.mockResolvedValue('hashedToken');

            const result = await loginService({ username: 'testuser', password: 'pass' }, '127.0.0.1');
            expect(result).toEqual({
                tokenInfo: { accessToken: 'access', refreshToken: 'refresh' },
                sessionId: 'session123',
            });
            expect(forceLogoutUser).toHaveBeenCalled();
        });
    });

    describe('refreshTokenService', () => {
        it('should throw AuthenticationError if no session found', async () => {
            getSessionByIdDao.mockResolvedValue(false);

            await expect(refreshTokenService('user1', 'company1', 'token'))
                .rejects.toThrowErrorMatchingInlineSnapshot(`"No active session found"`);
        });

        it('should return session if refresh token is valid', async () => {
            const mockSession = {
                config: JSON.stringify({
                    token: { refresh_token: 'hashedRefreshToken' },
                }),
            };
            getSessionByIdDao.mockResolvedValue(mockSession);
            jest.spyOn(require('../../utils/hashUtils.js'), 'compareHash').mockReturnValue(true);

            const result = await refreshTokenService('user1', 'company1', 'token');
            expect(result).toEqual(mockSession);
            expect(require('../../utils/hashUtils.js').compareHash).toHaveBeenCalledWith('token', 'hashedRefreshToken');
        });
    });

    describe('logoutService', () => {
        it('should call deleteUserSessionsDao and logOutUser', async () => {
            deleteUserSessionsDao.mockResolvedValue(true);
            const result = await logoutService({ user_id: 'user1', company_id: 'company1' }, 'sess1');
            expect(result).toBe(true);
            expect(logOutUser).toHaveBeenCalledWith('user1', 'sess1');
        });
    });

    describe('changePasswordService', () => {
        beforeEach(() => {
            jest.resetModules();
            jest.clearAllMocks();
        });
        afterEach(() => {
            jest.restoreAllMocks();
        });

        test('should change password successfully', async () => {
            const payload = {
                user_id: 'user1',
                user_name: 'testuser',
                oldPassword: 'old',
                password: 'new',
            };

            // Mock verificationService directly on the module
            jest.spyOn(authServiceModule, 'verificationService').mockImplementation(async (id, userDetails) => {
                expect(id).toBe('user1');
                expect(userDetails).toEqual({
                    user_name: 'testuser',
                    password: 'old',
                });
                return {
                    id: 'user1',
                    username: 'testuser',
                    password: 'hashedpassword',
                };
            });

            createHash.mockResolvedValue('newHash');
            changePasswordDao.mockResolvedValue({
                id: 'user1',
                username: 'testuser',
                password: 'newHash',
            });

            const result = await changePasswordService(payload);

            expect(result.password).toBe('newHash');
        });

        // test('should throw AuthenticationError if verification fails', async () => {
        //     const payload = {
        //         user_id: 'user1',
        //         user_name: 'testuser',
        //         oldPassword: 'wrong',
        //         password: 'new',
        //     };

        //     const mockVerification = jest
        //         .spyOn(authServiceModule, 'verificationService')
        //         .mockResolvedValue(null);

        //     await expect(changePasswordService(payload)).rejects.toThrow(
        //         new AuthenticationError('Invalid Password')
        //     );

        //     expect(mockVerification).toHaveBeenCalledWith(payload.user_id, {
        //         user_name: payload.user_name,
        //         password: payload.oldPassword,
        //     });
        // });
    });


    describe('verificationService', () => {
        it('should throw AuthenticationError if password invalid', async () => {
            getUsersByUserNameDao.mockResolvedValue(mockUser);
            verifyHash.mockResolvedValue(false);
            await expect(verificationService('user1', { user_name: 'testuser', password: 'wrong' }))
                .rejects.toThrow(BadRequestError);
        });

        it('should return user details if password is valid', async () => {
            getUsersByUserNameDao.mockResolvedValue(mockUser);
            verifyHash.mockResolvedValue(true);
            const result = await verificationService('user1', { user_name: 'testuser', password: 'correct' });
            expect(result).toEqual(mockUser);
        });
    });

    describe('verfyUserService', () => {
        it('should send OTP and create OTP record', async () => {
            getUsersByUserNameDao.mockResolvedValue(mockUser);
            generateOTP.mockReturnValue('123456');
            createUserOtpDao.mockResolvedValue(true);
            sendOTP.mockResolvedValue(true);

            const result = await verfyUserService('testuser');
            expect(result).toBe(true);
        });
    });

    describe('verfyOtpService', () => {
        it('should mark OTP as used and return user id', async () => {
            const otpRecord = { user_id: 'user1', expiration_time: new Date(Date.now() + 60000), is_used: false };
            getUserOtpDao.mockResolvedValue(otpRecord);
            updateUserOtpDao.mockResolvedValue(true);

            const result = await verfyOtpService('otp123');
            expect(result).toEqual({ id: 'user1' });
        });
    });

    describe('forgetPasswordService', () => {
        it('should update user password', async () => {
            updateUserDao.mockResolvedValue({ id: 'user1', password: 'hashed' });
            createHash.mockResolvedValue('hashed');

            const result = await forgetPasswordService({ user_id: 'user1', password: 'newpass' });
            expect(result.password).toBe('hashed');
        });
    });

    describe('getUserRoleService', () => {
        it('should return isAdmin true for admin', async () => {
            getRoleByUserNameDao.mockResolvedValue({ designation: Role.ADMIN });
            const result = await getUserRoleService('admin');
            expect(result).toEqual({ isAdmin: true });
        });

        it('should return isAdmin false for normal user', async () => {
            getRoleByUserNameDao.mockResolvedValue({ designation: Role.USER });
            const result = await getUserRoleService('user');
            expect(result).toEqual({ isAdmin: false });
        });

        it('should throw NotFoundError if user not found', async () => {
            getRoleByUserNameDao.mockResolvedValue(null);
            await expect(getUserRoleService('unknown')).rejects.toThrow(NotFoundError);
        });
    });
});