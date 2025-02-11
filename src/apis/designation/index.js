import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import { createDesignation, deleteDesignation, getDesignationById, updateDesignation } from './designationController.js';
const router = express.Router();




 /* /users/by-id:
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
 router.get('/:id', tryCatchHandler(getDesignationById));

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
 router.post('/create-designation', tryCatchHandler(createDesignation));

 router.put('/update-designation', tryCatchHandler(updateDesignation));

 router.put('/delete-designation', tryCatchHandler(deleteDesignation));

export default router;
