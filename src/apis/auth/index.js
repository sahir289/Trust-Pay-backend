import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import { loginController } from './authController.js';

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
 *         description: login successful.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "login successful!"
 */
router.post('/', tryCatchHandler(loginController)); // login route

export default router;
