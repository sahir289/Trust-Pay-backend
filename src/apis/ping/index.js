// apis/ping/index.js

import express from 'express';
import pong from './pingController.js';
import tryCatchHandler from '../../utils/tryCatchHandler.js';

const router = express.Router();

/**
 * @swagger
 * /ping:
 *   get:
 *     summary: Server health check
 *     description: Returns a status message to verify the server is running.
 *     tags:
 *       - Health Check
 *     responses:
 *       200:
 *         description: Ping successful.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Ping successful!"
 */
router.get('/', tryCatchHandler(pong.ping)); // Ping route

export default router;