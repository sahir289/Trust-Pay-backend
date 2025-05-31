import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import { isAuthenticated } from '../../middlewares/auth.js';
import { createNotifications, deleteNotifications, getNotifications } from './notificationController.js';

const router = express.Router();

/**
 * @swagger
 * /notifications:
 *   get:
 *     summary: Retrieve all Notification
 *     description: Returns a list of all Notifications.
 *     tags:
 *       - Notifications
 *     responses:
 *       200:
 *         description: A list of Notifications.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   status:
 *                     type: string
 *                     example: "active"
 */
router.get('/', isAuthenticated, tryCatchHandler(getNotifications));

/**
 * @swagger
 * /notifications:
 *   get:
 *     summary: Retrieve all Notification
 *     description: Returns a list of all Notifications.
 *     tags:
 *       - Notifications
 *     responses:
 *       200:
 *         description: A list of Notifications.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   status:
 *                     type: string
 *                     example: "active"
 */

router.post('/', isAuthenticated, tryCatchHandler(createNotifications));

router.delete('/:id', isAuthenticated, tryCatchHandler(deleteNotifications));

export default router;
