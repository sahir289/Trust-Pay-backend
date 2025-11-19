// import express from 'express';
// import tryCatchHandler from '../../utils/tryCatchHandler.js';
// import { isAuthenticated } from '../../middlewares/auth.js';
// import {
//   createNotifications,
//   deleteNotifications,
//   getNotificationCounts,
//   getNotifications,
//   getNotificationsById,
//   updateNotifications,
// } from './notificationController.js';

// const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Notifications
 *   description: API endpoints for managing user notifications and alerts
 */

/**
 * @swagger
 * /notifications:
 *   get:
 *     summary: Get all notifications
 *     description: Retrieves all notifications for the authenticated user
 *     tags: [Notifications]
 *     security:
 *       - xAuthToken: []
 *     parameters:
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
 *         description: Number of items per page
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [info, warning, error, success]
 *         description: Filter by notification type
 *       - in: query
 *         name: read
 *         schema:
 *           type: boolean
 *         description: Filter by read status
 *     responses:
 *       200:
 *         description: Notifications retrieved successfully
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
 *       500:
 *         description: Internal server error
 */
// router.get('/', isAuthenticated, tryCatchHandler(getNotifications));

/**
 * @swagger
 * /notifications/counts:
 *   get:
 *     summary: Get notification counts
 *     description: Retrieves notification counts (total, unread, by type) for the authenticated user
 *     tags: [Notifications]
 *     security:
 *       - xAuthToken: []
 *     responses:
 *       200:
 *         description: Notification counts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         description: Unauthorized access
 *       500:
 *         description: Internal server error
 */
// router.get('/counts', isAuthenticated, tryCatchHandler(getNotificationCounts));

/**
 * @swagger
 * /notifications/{id}:
 *   get:
 *     summary: Get notification by ID
 *     description: Retrieves a specific notification by its ID
 *     tags: [Notifications]
 *     security:
 *       - xAuthToken: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the notification to retrieve
 *     responses:
 *       200:
 *         description: Notification retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         description: Unauthorized access
 *       404:
 *         description: Notification not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 */
// router.get('/:id', isAuthenticated, tryCatchHandler(getNotificationsById));

/**
 * @swagger
 * /notifications/create-notification:
 *   post:
 *     summary: Create a new notification
 *     description: Creates a new notification for users
 *     tags: [Notifications]
 *     security:
 *       - xAuthToken: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - message
 *               - type
 *             properties:
 *               title:
 *                 type: string
 *                 description: Notification title
 *                 example: "Payment Received"
 *               message:
 *                 type: string
 *                 description: Notification message content
 *                 example: "You have received a payment of ₹1000"
 *               type:
 *                 type: string
 *                 enum: [info, warning, error, success]
 *                 description: Type of notification
 *                 example: "success"
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, urgent]
 *                 description: Notification priority
 *                 example: "medium"
 *               target_users:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of user IDs to send notification to
 *               category:
 *                 type: string
 *                 description: Notification category
 *                 example: "payment"
 *     responses:
 *       201:
 *         description: Notification created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       400:
 *         description: Invalid request data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized access
 *       500:
 *         description: Internal server error
 */
// router.post('/create-notification', isAuthenticated, tryCatchHandler(createNotifications));

/**
 * @swagger
 * /notifications/update-notification/{id}:
 *   put:
 *     summary: Update notification
 *     description: Updates an existing notification (typically to mark as read/unread)
 *     tags: [Notifications]
 *     security:
 *       - xAuthToken: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the notification to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               is_read:
 *                 type: boolean
 *                 description: Mark notification as read/unread
 *                 example: true
 *               title:
 *                 type: string
 *                 description: Updated notification title
 *               message:
 *                 type: string
 *                 description: Updated notification message
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, urgent]
 *                 description: Updated priority
 *     responses:
 *       200:
 *         description: Notification updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized access
 *       404:
 *         description: Notification not found
 *       500:
 *         description: Internal server error
 */
// router.put('/update-notification/:id', isAuthenticated, tryCatchHandler(updateNotifications));

/**
 * @swagger
 * /notifications/delete-notification/{id}:
 *   delete:
 *     summary: Delete notification
 *     description: Deletes a notification by ID (soft delete to maintain audit trail)
 *     tags: [Notifications]
 *     security:
 *       - xAuthToken: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the notification to delete
 *     responses:
 *       200:
 *         description: Notification deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         description: Unauthorized access
 *       404:
 *         description: Notification not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 */
// router.delete('/delete-notification/:id', isAuthenticated, tryCatchHandler(deleteNotifications));

// export default router;
