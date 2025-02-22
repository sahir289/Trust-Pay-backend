import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import { createUser, getUserById, getUsers, getUsersByUserName } from './userController.js';
import { authorized, isAuthenticated } from '../../middlewares/auth.js';
import { AccessRoles } from '../../constants/index.js';

const router = express.Router();

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Get all users
 *     description: Returns a status message to verify the user is authorized or not.
 *     tags:
 *       - Users
 *     responses:
 *       200:
 *         description: login successful.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "get users successfully"
 */
router.get('/', [isAuthenticated, authorized(AccessRoles.USER)], tryCatchHandler(getUsers));

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
router.get('/get-users-by-name', [isAuthenticated, authorized(AccessRoles.USER)], tryCatchHandler(getUsersByUserName));

/**
 * @swagger
 * /users/by-id:
 *   get:
 *     summary: Get user by id
 *     description: Returns user filtered by id.
 *     tags:
 *       - Users
 *     parameters:
 *       - in: query
 *         name: id
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
 *                   example: "get users by id successfully"
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
router.get('/:id', [isAuthenticated, authorized(AccessRoles.USER)], tryCatchHandler(getUserById));

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
router.post('/create-user', [isAuthenticated, authorized(AccessRoles.USER)], tryCatchHandler(createUser));



export default router;
