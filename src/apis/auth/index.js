import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import {
  loginController,
  logoutController,
  refreshTokenController,
  verificationController,
  changePasswordController,
  verfyUserController,
  verfyOtpController,
  forgetPasswordController,
  getUserRoleController,
} from './authController.js';
import { isAuthenticated } from '../../middlewares/auth.js';
import  {geoLocationGuard}  from '../../middlewares/loginLocationRestrict.js';
const router = express.Router();

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: 🔐 Login to get Authentication Token
 *     description: |
 *       **Step 1**: Use this endpoint to authenticate and get your JWT token
 *       
 *       **Step 2**: Copy the `accessToken` from the response
 *       
 *       **Step 3**: Click the "Authorize" 🔒 button above and paste the token
 *       
 *       **Step 4**: All protected endpoints will now work with your token
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 description: Your Trust-Pay username
 *                 example: "john_doe"
 *               password:
 *                 type: string
 *                 description: Your Trust-Pay password
 *                 example: "password123"
 *                 format: password
 *               newPassword:
 *                 type: string
 *                 description: New password (required for first-time login)
 *                 example: "newPassword123"
 *                 format: password
 *               unique_admin_id:
 *                 type: string
 *                 description: Required for admin users only
 *                 example: "admin_unique_123"
 *     responses:
 *       200:
 *         description: ✅ Login Successful - Copy the accessToken below
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "login successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     accessToken:
 *                       type: string
 *                       description: 🔑 **COPY THIS TOKEN** - Use this in the Authorize button above
 *                       example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiMTIzIiwidXNlcm5hbWUiOiJqb2huX2RvZSIsInJvbGUiOiJtYW5hZ2VyIiwiY29tcGFueV9pZCI6ImNvbXBfMTIzIiwiaWF0IjoxNjQyMjQ4NjAwLCJleHAiOjE2NDIzMzUwMDB9.ABC123"
 *                     sessionId:
 *                       type: string
 *                       description: Session identifier
 *                       example: "sess_789xyz"
 *       206:
 *         description: First-time login - Password change required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "user's first login"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "123"
 *                     isLoginFirst:
 *                       type: boolean
 *                       example: true
 *       400:
 *         description: Invalid request data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: User not found or account disabled
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/login', geoLocationGuard, tryCatchHandler(loginController)); // login route

/**
 * @swagger
 * /auth/refresh-token:
 *   post:
 *     summary: Refresh authentication token
 *     description: Generate a new access token using refresh token.
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *     responses:
 *       200:
 *         description: Token refreshed successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         description: Invalid refresh token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/refresh-token', tryCatchHandler(refreshTokenController));

/**
 * @swagger
 * /auth/get-user-role:
 *   get:
 *     summary: Get user role information
 *     description: Retrieve the current user's role and permissions.
 *     tags:
 *       - Authentication
 *     security:
 *       - xAuthToken: []
 *     responses:
 *       200:
 *         description: User role retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         description: Unauthorized access.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/get-user-role', tryCatchHandler(getUserRoleController));

/**
 * @swagger
 * /logout:
 *   get:
 *     summary: logout user
 *     description: Returns a status message to verify the user is authorized or not.
 *     tags:
 *       - logout user
 *     responses:
 *       200:
 *         description: logout successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "logout successfully!"
 */
router.post('/logout', isAuthenticated, tryCatchHandler(logoutController));

router.post('/otp_verification',loginMiddleware, tryCatchHandler(verfyOtpController));

router.post('/reset_password',loginMiddleware, tryCatchHandler(forgetPasswordController));

router.post('/user_verification',loginMiddleware, tryCatchHandler(verfyUserController));

/**
 * @swagger
 * /auth/change-password:
 *   post:
 *     summary: Change user password
 *     description: Change password for authenticated user.
 *     tags:
 *       - Authentication
 *     security:
 *       - xAuthToken: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 example: "currentPassword123"
 *               newPassword:
 *                 type: string
 *                 example: "newPassword456"
 *     responses:
 *       200:
 *         description: Password changed successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       400:
 *         description: Invalid current password.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized access.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/change-password',
  isAuthenticated,
  tryCatchHandler(changePasswordController),
);

/**
 * @swagger
 * /auth/password-verification:
 *   post:
 *     summary: Verify user password
 *     description: Verify current user password for sensitive operations.
 *     tags:
 *       - Authentication
 *     security:
 *       - xAuthToken: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               password:
 *                 type: string
 *                 example: "password123"
 *     responses:
 *       200:
 *         description: Password verified successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       400:
 *         description: Invalid password.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized access.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/password-verification',
  isAuthenticated,
  tryCatchHandler(verificationController),
);

export default router;
