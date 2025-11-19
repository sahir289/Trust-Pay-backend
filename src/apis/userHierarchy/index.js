import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import {
  createUserHierarchy,
  deleteUserHierarchy,
  getUserHierarchys,
  updateUserHierarchy,
  getUserHierarchysById,
} from './userHierarchyController.js';
import { authorized, isAuthenticated } from '../../middlewares/auth.js';
import { AccessRoles } from '../../constants/index.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: User Hierarchy
 *   description: API endpoints for managing user hierarchies and organizational structures
 */

/**
 * @swagger
 * /userHierarchy:
 *   get:
 *     summary: Retrieve all user hierarchies
 *     description: Returns a list of all user hierarchy configurations in the system
 *     tags: [User Hierarchy]
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
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for filtering hierarchies
 *     responses:
 *       200:
 *         description: User hierarchies retrieved successfully
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
router.get(
  '/',
  [isAuthenticated, authorized(AccessRoles.USER_HIERARCHY.UPDATE_READ)],
  tryCatchHandler(getUserHierarchys),
);

/**
 * @swagger
 * /userHierarchy/{id}:
 *   get:
 *     summary: Retrieve a specific user hierarchy by ID
 *     description: Returns the details of a user hierarchy configuration based on the provided ID
 *     tags: [User Hierarchy]
 *     security:
 *       - xAuthToken: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The ID of the user hierarchy to retrieve
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User hierarchy details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         description: Unauthorized access
 *       404:
 *         description: User hierarchy not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 */
router.get(
  '/:id',
  [isAuthenticated, authorized(AccessRoles.USER_HIERARCHY.UPDATE_READ)],
  tryCatchHandler(getUserHierarchysById),
);

/**
 * @swagger
 * /userHierarchy/create-userHierarchy:
 *   post:
 *     summary: Create a new user hierarchy
 *     description: Creates a new user hierarchy configuration in the system
 *     tags: [User Hierarchy]
 *     security:
 *       - xAuthToken: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - hierarchy_name
 *               - parent_id
 *             properties:
 *               hierarchy_name:
 *                 type: string
 *                 description: Name of the hierarchy level
 *                 example: "Regional Manager"
 *               parent_id:
 *                 type: string
 *                 description: ID of the parent hierarchy level (null for root level)
 *                 example: "parent_hierarchy_123"
 *               level:
 *                 type: integer
 *                 description: Hierarchy level number
 *                 example: 2
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: List of permissions for this hierarchy level
 *               config:
 *                 type: object
 *                 description: Additional configuration settings
 *     responses:
 *       201:
 *         description: User hierarchy created successfully
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
router.post(
  '/create-userHierarchy',
  [isAuthenticated, authorized(AccessRoles.USER_HIERARCHY.CREATE_DELETE)],
  tryCatchHandler(createUserHierarchy),
);

/**
 * @swagger
 * /userHierarchy/update-userHierarchy/{id}:
 *   put:
 *     summary: Update userHierarchy details
 *     description: Updates an existing userHierarchy’s details by its ID.
 *     tags: [User Hierarchy]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The ID of the userHierarchy to update.
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Updated UserHierarchy"
 *               status:
 *                 type: string
 *                 example: "inactive"
 *     responses:
 *       200:
 *         description: UserHierarchy updated successfully.
 *       404:
 *         description: UserHierarchy not found.
 */
router.put(
  '/update-userHierarchy/:id',
  [isAuthenticated, authorized(AccessRoles.USER_HIERARCHY.UPDATE_READ)],
  tryCatchHandler(updateUserHierarchy),
);

/**
 * @swagger
 * /userHierarchy/delete-userHierarchy/{id}:
 *   delete:
 *     summary: Delete a userHierarchy
 *     description: Soft deletes a userHierarchy by changing its status to inactive.
 *     tags: [User Hierarchy]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The ID of the userHierarchy to delete.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: UserHierarchy deleted successfully.
 *       404:
 *         description: UserHierarchy not found.
 */
router.delete(
  '/delete-userHierarchy/:id',
  [isAuthenticated, authorized(AccessRoles.USER_HIERARCHY.CREATE_DELETE)],
  tryCatchHandler(deleteUserHierarchy),
);

export default router;
