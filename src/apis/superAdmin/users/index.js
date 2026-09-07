import express from 'express';
import tryCatchHandler from '../../../utils/tryCatchHandler.js';
import { setSuperAdminTenant } from '../middleware.js';
import {
  getUsers,
  getUsersBySearch,
  getUsersInfoBySearch,
  getUserById,
} from '../../users/userController.js';

const router = express.Router();

// All routes in this sub-module require x-tenant-id to scope data by company
router.use(setSuperAdminTenant);

/**
 * @swagger
 * /super-admin/users/get-users:
 *   get:
 *     summary: Get all users for a company (Super Admin)
 *     description: >
 *       Returns a paginated list of users belonging to the company specified
 *       via the `x-tenant-id` header.
 *     tags: [Super Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: x-tenant-id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Company ID to scope the query
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 *       400:
 *         description: Missing or invalid x-tenant-id header
 *       401:
 *         description: Unauthorized
 */
router.get('/get-users', tryCatchHandler(getUsers));

/**
 * @swagger
 * /super-admin/users/:
 *   get:
 *     summary: Search users for a company (Super Admin)
 *     description: >
 *       Search and paginate users belonging to the company specified
 *       via the `x-tenant-id` header. Supports free-text search across
 *       user fields.
 *     tags: [Super Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: x-tenant-id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Company ID to scope the query
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Comma-separated search terms
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 *       400:
 *         description: Missing or invalid x-tenant-id header
 *       401:
 *         description: Unauthorized
 */
router.get('/', tryCatchHandler(getUsersBySearch));

/**
 * @swagger
 * /super-admin/users/user-info:
 *   get:
 *     summary: Get user login/info details for a company (Super Admin)
 *     description: >
 *       Returns user login activity and device information for users
 *       belonging to the company specified via the `x-tenant-id` header.
 *     tags: [Super Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: x-tenant-id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Company ID to scope the query
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: User info retrieved successfully
 *       400:
 *         description: Missing or invalid x-tenant-id header
 *       401:
 *         description: Unauthorized
 */
router.get('/user-info', tryCatchHandler(getUsersInfoBySearch));

/**
 * @swagger
 * /super-admin/users/{id}:
 *   get:
 *     summary: Get a user by ID for a company (Super Admin)
 *     description: >
 *       Returns details of a specific user belonging to the company
 *       specified via the `x-tenant-id` header.
 *     tags: [Super Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: x-tenant-id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Company ID to scope the query
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     responses:
 *       200:
 *         description: User retrieved successfully
 *       400:
 *         description: Missing or invalid x-tenant-id header
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
router.get('/:id', tryCatchHandler(getUserById));

export default router;
