import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import { getUsers, getUsersByUserName } from './userController.js';

const router = express.Router();

/**
 * @swagger
 * /users:
 *   get:
 *     summary: users check
 *     description: Returns a status message to verify the user is authorized or not.
 *     tags:
 *       - users Check
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
router.get('/', tryCatchHandler(getUsers));

/**
 * @swagger
 * /users/by-username:
 *   get:
 *     summary: Get users by username
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
router.get('/get-users-by-name', tryCatchHandler(getUsersByUserName));


export default router;
