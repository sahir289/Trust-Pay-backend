import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import { authorized, isAuthenticated } from '../../middlewares/auth.js';
import { AccessRoles } from '../../constants/index.js';
import { getNotifications } from './notificationController.js';

const router = express.Router();

/**
 * @swagger
 * /notifications:
 *   get:
 *     summary: Retrieve all merchants
 *     description: Returns a list of all merchants.
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
router.get(
  '/',
  [isAuthenticated, authorized(AccessRoles.MERCHANT)],
  tryCatchHandler(getNotifications),
);

export default router;