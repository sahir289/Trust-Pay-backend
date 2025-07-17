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
} from './authController.js';
import {
  getUserSessionsController,
  terminateSessionController,
  terminateAllOtherSessionsController,
  checkConcurrentSessionsController
} from './sessionController.js';
import { isAuthenticated } from '../../middlewares/auth.js';

const router = express.Router();

/**
 * @swagger
 * /login:
 *   get:
 *     summary: login check
 *     description: Returns a status message to verify the user is authorized or not.
 *     tags:
 *       - login Check
 *     responses:
 *       200:
 *         description: login successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "login successfully!"
 */
router.post('/login', tryCatchHandler(loginController)); // login route

router.post('/refresh-token', tryCatchHandler(refreshTokenController));

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

router.post('/otp_verification', tryCatchHandler(verfyOtpController));

router.post('/reset_password', tryCatchHandler(forgetPasswordController));

router.post('/user_verification', tryCatchHandler(verfyUserController));

router.post(
  '/change-password',
  isAuthenticated,
  tryCatchHandler(changePasswordController),
);

router.post(
  '/password-verification',
  isAuthenticated,
  tryCatchHandler(verificationController),
);

// Session management routes
/**
 * @swagger
 * /sessions:
 *   get:
 *     summary: Get all active sessions
 *     description: Returns all active sessions for the authenticated user
 *     tags:
 *       - Session Management
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sessions retrieved successfully
 */
router.get('/sessions', isAuthenticated, tryCatchHandler(getUserSessionsController));

/**
 * @swagger
 * /sessions/terminate:
 *   post:
 *     summary: Terminate a specific session
 *     description: Terminates a specific session by session ID
 *     tags:
 *       - Session Management
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               session_id:
 *                 type: string
 *                 description: Session ID to terminate
 *     responses:
 *       200:
 *         description: Session terminated successfully
 */
router.post('/sessions/terminate', isAuthenticated, tryCatchHandler(terminateSessionController));

/**
 * @swagger
 * /sessions/terminate-all:
 *   post:
 *     summary: Terminate all other sessions
 *     description: Terminates all other sessions except the current one
 *     tags:
 *       - Session Management
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All other sessions terminated successfully
 */
router.post('/sessions/terminate-all', isAuthenticated, tryCatchHandler(terminateAllOtherSessionsController));

/**
 * @swagger
 * /sessions/check-concurrent:
 *   get:
 *     summary: Check for concurrent sessions
 *     description: Checks if the user has concurrent sessions active
 *     tags:
 *       - Session Management
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Concurrent session check completed
 */
router.get('/sessions/check-concurrent', isAuthenticated, tryCatchHandler(checkConcurrentSessionsController));

export default router;
