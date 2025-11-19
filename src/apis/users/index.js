import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import {
  createUser,
  getUserById,
  getUsers,
  getUsersByUserName,
  updateUser,
  sendMail,
} from './userController.js';
import { authorized, isAuthenticated } from '../../middlewares/auth.js';
import { AccessRoles } from '../../constants/index.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: API endpoints for comprehensive user management including CRUD operations, user profiles, and user administration
 */

/**
 * @swagger
 * /users/get:
 *   get:
 *     summary: Get all users
 *     description: Retrieve a paginated list of all users with role-based filtering and comprehensive user information
 *     tags: [Users]
 *     security:
 *       - xAuthToken: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           example: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           example: 10
 *         description: Number of users per page
 *     responses:
 *       200:
 *         description: Users retrieved successfully.
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
router.get(
  '/get',
  [isAuthenticated, authorized(AccessRoles.USER)],
  tryCatchHandler(getUsers),
);
/**
 * @swagger
 * /users:
 *   get:
 *     summary: Search users
 *     description: Search and filter users with various criteria.
 *     tags: [Users]
 *     security:
 *       - xAuthToken: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for filtering users
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           example: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           example: 10
 *         description: Number of users per page
 *     responses:
 *       200:
 *         description: Users search completed successfully.
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
/**
 * @swagger
 * /users/get-users-by-name:
 *   get:
 *     summary: Get users by username filter
 *     description: Retrieve users filtered by username with partial matching capabilities
 *     tags: [Users]
 *     security:
 *       - xAuthToken: []
 *     parameters:
 *       - in: query
 *         name: username
 *         schema:
 *           type: string
 *         required: true
 *         description: Username filter for searching users (supports partial matching)
 *         example: "john"
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of users per page
 *     responses:
 *       200:
 *         description: Users filtered by username retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       400:
 *         description: Invalid request parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized access
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
router.get(
  '/get-users-by-name',
  [isAuthenticated, authorized(AccessRoles.USER)],
  tryCatchHandler(getUsersByUserName),
);
/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Get user by ID
 *     description: Retrieve detailed information about a specific user by their unique identifier
 *     tags: [Users]
 *     security:
 *       - xAuthToken: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The unique identifier of the user to retrieve
 *     responses:
 *       200:
 *         description: User details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         description: Unauthorized access
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: User not found
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
router.get(
  '/:id',
  [isAuthenticated, authorized(AccessRoles.USER)],
  tryCatchHandler(getUserById),
);

/**
 * @swagger
 * /users/create-user:
 *   post:
 *     summary: Create new user
 *     description: Create a new user account with the provided details.
 *     tags: [Users]
 *     security:
 *       - xAuthToken: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *               - role_id
 *             properties:
 *               username:
 *                 type: string
 *                 example: "john_doe"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "john@example.com"
 *               password:
 *                 type: string
 *                 example: "password123"
 *               role_id:
 *                 type: integer
 *                 example: 2
 *               first_name:
 *                 type: string
 *                 example: "John"
 *               last_name:
 *                 type: string
 *                 example: "Doe"
 *     responses:
 *       201:
 *         description: User created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       400:
 *         description: Invalid request data.
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
  '/create-user',
  [isAuthenticated, authorized(AccessRoles.USER)],
  tryCatchHandler(createUser),
);

/**
 * @swagger
 * /users/update-user/{id}:
 *   put:
 *     summary: Update user details
 *     description: Update an existing user's information including profile details, role assignments, and status changes
 *     tags: [Users]
 *     security:
 *       - xAuthToken: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The unique identifier of the user to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 description: Updated username
 *                 example: "john_doe_updated"
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Updated email address
 *                 example: "john.updated@example.com"
 *               first_name:
 *                 type: string
 *                 description: Updated first name
 *                 example: "John"
 *               last_name:
 *                 type: string
 *                 description: Updated last name
 *                 example: "Doe"
 *               role_id:
 *                 type: integer
 *                 description: Updated role assignment
 *                 example: 3
 *               designation_id:
 *                 type: integer
 *                 description: Updated designation assignment
 *                 example: 2
 *               is_active:
 *                 type: boolean
 *                 description: User active status
 *                 example: true
 *               phone:
 *                 type: string
 *                 description: Updated phone number
 *                 example: "+91-9876543210"
 *     responses:
 *       200:
 *         description: User updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       400:
 *         description: Invalid request data or validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized access
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: User not found
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
router.put(
  '/update-user/:id',
  [isAuthenticated, authorized(AccessRoles.USER)],
  tryCatchHandler(updateUser),
);

/**
 * @swagger
 * /users/send-mail:
 *   post:
 *     summary: Send notification email to user
 *     description: Send email notifications to specific users for account updates, role changes, or system notifications
 *     tags: [Users]
 *     security:
 *       - xAuthToken: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - user_id
 *               - email_type
 *             properties:
 *               user_id:
 *                 type: string
 *                 description: ID of the user to send email to
 *                 example: "user_123"
 *               role_id:
 *                 type: integer
 *                 description: Role ID for role-specific email templates
 *                 example: 2
 *               email_type:
 *                 type: string
 *                 enum: [welcome, password_reset, account_update, role_change, system_notification]
 *                 description: Type of email to send
 *                 example: "welcome"
 *               custom_message:
 *                 type: string
 *                 description: Custom message to include in the email
 *                 example: "Welcome to the Trust-Pay platform!"
 *               priority:
 *                 type: string
 *                 enum: [low, normal, high, urgent]
 *                 default: normal
 *                 description: Email priority level
 *               template_data:
 *                 type: object
 *                 description: Additional data for email template customization
 *                 properties:
 *                   user_name:
 *                     type: string
 *                     example: "John Doe"
 *                   company_name:
 *                     type: string
 *                     example: "TechCorp Solutions"
 *     responses:
 *       200:
 *         description: Email sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       400:
 *         description: Invalid request data or missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized access
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: User not found or invalid email address
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Email service error or internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/send-mail',
  [isAuthenticated, authorized(AccessRoles.USER)],
  tryCatchHandler(sendMail),
);

export default router;
