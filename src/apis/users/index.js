import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import {
  createUser,
  getUserById,
  getUsers,
  getUsersByUserName,
  updateUser,
  getUsersBySearch,
  getUsersInfoBySearch,
  sendMail,
  toggleUser2FA,
  toggleUser2FAExemption,
  resetUser2FA,
} from './userController.js';
import { authorized, isAuthenticated } from '../../middlewares/auth.js';
import { AccessRoles, Role } from '../../constants/index.js';

const router = express.Router();

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Get all users
 *     description: Returns a status message to verify the user is authorized or not.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: x-auth-token
 *         required: true
 *         schema:
 *           type: string
 *         description: Authentication token
 *     responses:
 *       200:
 *         description: Login successful.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "get users successfully"
 *       401:
 *         description: Unauthorized, invalid or missing token.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Unauthorized access"
 */
router.get(
  '/get',
  [isAuthenticated, authorized(AccessRoles.USER)],
  tryCatchHandler(getUsers),
);
router.get(
  '/',
  [isAuthenticated, authorized(AccessRoles.USER)],
  tryCatchHandler(getUsersBySearch),
);

router.get(
  '/info',
  [isAuthenticated, authorized(AccessRoles.USER_INFO)],
  tryCatchHandler(getUsersInfoBySearch),
);
/**
 * @swagger
 * /users/by-username:
 *   get:
 *     summary: Get all users by username
 *     description: Returns users filtered by username.
 *     tags:
 *       - Users
 *     parameters:
 *       - in: query
 *         name: username
 *         schema:
 *           type: string
 *         required: true
 *         description: The username to filter users by.
 *     responses:
 *       200:
 *         description: A filtered list of users.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "get users by username successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       username:
 *                         type: string
 *                         example: "john_doe"
 */
router.get(
  '/get-users-by-name',
  [isAuthenticated, authorized(AccessRoles.USER)],
  tryCatchHandler(getUsersByUserName),
);
/**
 * @swagger
 * /users/id:
 *   get:
 *     summary: Get user by ID
 *     description: Returns user filtered by ID.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: x-auth-token
 *         required: true
 *         schema:
 *           type: string
 *         description: Authentication token
 *       - in: query
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The ID of the user to retrieve.
 *     responses:
 *       200:
 *         description: User retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "get user by id successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     username:
 *                       type: string
 *                       example: "john_doe"
 *       401:
 *         description: Unauthorized, invalid or missing token.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Unauthorized access"
 *       404:
 *         description: User not found.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "User not found"
 */
router.get(
  '/:id',
  [isAuthenticated, authorized(AccessRoles.ALL)],
  tryCatchHandler(getUserById),
);

/**
 * @swagger
 * /users/create-user:
 *   post:
 *     summary: create new user
 *     description: Returns users filtered by username.
 *     tags:
 *       - Users
 *     parameters:
 *       - in: query
 *         name: username
 *         schema:
 *           type: string
 *         required: true
 *         description: The username to filter users by.
 *     responses:
 *       200:
 *         description: A filtered list of users.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "user created successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       username:
 *                         type: string
 *                         example: "john_doe"
 */
router.post(
  '/create-user',
  [isAuthenticated, authorized(AccessRoles.USER)],
  tryCatchHandler(createUser),
);

/**
 * @swagger
 * /users/update-user/{id}:
 *   put:
 *     summary: Update an existing user
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the user to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 description: The new username for the user
 *     responses:
 *       200:
 *         description: User updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "User updated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     username:
 *                       type: string
 *                       example: "john_doe"
 */
router.put(
  '/update-user/:id',
  [isAuthenticated, authorized(AccessRoles.USER)],
  tryCatchHandler(updateUser),
);

/**
 * @swagger
 * /users/send-mail:
 *   post:
 *     summary: send new mail
 *     description: Returns users filtered by username.
 *     tags:
 *       - Users
 *     parameters:
 *       - in: query
 *         user_id: user_id
 *         role_id: role_id
 *         schema:
 *           type: string
 *         required: true
 *         description: The username to filter users by.
 *     responses:
 *       200:
 *         description: A filtered list of users.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "send mail successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       username:
 *                         type: string
 *                         example: "john_doe"
 */
router.post(
  '/send-mail',
  [isAuthenticated, authorized(AccessRoles.USER)],
  tryCatchHandler(sendMail),
);

/**
 * PATCH /users/:id/2fa
 * Allows Admin/Super Admin to set 2FA requirement for a specific user.
 * This sets is_two_factor_required flag (not is_two_factor_enabled).
 * The user must complete actual 2FA setup (scan QR + verify OTP) themselves.
 */
router.patch(
  '/:id/2fa',
  [isAuthenticated, authorized([Role.ADMIN, Role.SUPER_ADMIN])],
  tryCatchHandler(toggleUser2FA),
);

/**
 * POST /users/:id/2fa/reset
 * Allows any authenticated user with proper designation to reset 2FA for a specific user.
 * Available for: ADMIN, TRANSACTIONS, SUB_MERCHANT, VENDOR_ADMIN, SUB_VENDOR, ADMIN_OPERATIONS and all other roles.
 */
router.post(
  '/:id/2fa/reset',
  [isAuthenticated, authorized(AccessRoles.ALL)],
  tryCatchHandler(resetUser2FA),
);

/**
 * PATCH /users/:id/2fa-exemption
 * Allows Admin/Super Admin to toggle 2FA enforcement exemption for a specific user.
 * When exempt = true, user bypasses global 2FA enforcement even if company-level enforcement is enabled.
 * Body: { exempt: boolean }
 */
router.patch(
  '/:id/2fa-exemption',
  [isAuthenticated, authorized([Role.ADMIN, Role.SUPER_ADMIN])],
  tryCatchHandler(toggleUser2FAExemption),
);

export default router;
