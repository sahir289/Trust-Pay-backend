import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import {
  getRoles,
  createRole,
  updateRole,
  deleteRole,
  getRolesById,
} from './rolesController.js';
import { authorized, isAuthenticated } from '../../middlewares/auth.js';
import { AccessRoles } from '../../constants/index.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Roles
 *   description: API endpoints for managing roles
 */

/**
 * @swagger
 * /roles:
 *   get:
 *     summary: Get all roles
 *     description: Retrieve a list of all roles with their permissions.
 *     tags: [Roles]
 *     security:
 *       - xAuthToken: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           example: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           example: 10
 *         description: Number of roles per page
 *     responses:
 *       200:
 *         description: Roles retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         description: Unauthorized access.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 *       500:
 *         description: Internal server error
 */

router.get(
  '/',
  [isAuthenticated, authorized(AccessRoles.ROLES)],
  tryCatchHandler(getRoles),
);

/**
 * @swagger
 * /roles/{id}:
 *   get:
 *     summary: Get role by ID
 *     description: Retrieves detailed information about a specific role by its ID
 *     tags: [Roles]
 *     security:
 *       - xAuthToken: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the role to retrieve
 *     responses:
 *       200:
 *         description: Role details retrieved successfully
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
 *       404:
 *         description: Role not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 */
router.get(
  '/:id',
  [isAuthenticated, authorized(AccessRoles.ROLES)],
  tryCatchHandler(getRolesById),
);
/**
 * @swagger
 * /roles/create-role:
 *   post:
 *     summary: Create a new role
 *     description: Creates a new role with specified permissions and access levels
 *     tags: [Roles]
 *     security:
 *       - xAuthToken: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role_name
 *               - permissions
 *             properties:
 *               role_name:
 *                 type: string
 *                 description: Name of the role
 *                 example: "Financial Manager"
 *               description:
 *                 type: string
 *                 description: Role description
 *                 example: "Manages financial operations and reports"
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: List of permissions for this role
 *                 example: ["read_transactions", "create_reports", "manage_settlements"]
 *               access_level:
 *                 type: string
 *                 enum: [basic, intermediate, advanced, admin]
 *                 description: Access level for the role
 *                 example: "intermediate"
 *               company_id:
 *                 type: string
 *                 description: Company ID this role belongs to
 *                 example: "comp_123"
 *               is_active:
 *                 type: boolean
 *                 default: true
 *                 description: Whether the role is active
 *     responses:
 *       201:
 *         description: Role created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       400:
 *         description: Invalid request data or validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized access
 *       409:
 *         description: Role name already exists
 *       500:
 *         description: Internal server error
 */
router.post(
  '/create-role',
  [isAuthenticated, authorized(AccessRoles.ROLES)],
  tryCatchHandler(createRole),
);

/**
 * @swagger
 * /roles/update-role/{id}:
 *   put:
 *     summary: Update role details
 *     description: Updates an existing role with new permissions or access levels
 *     tags: [Roles]
 *     security:
 *       - xAuthToken: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the role to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               role_name:
 *                 type: string
 *                 description: Updated role name
 *               description:
 *                 type: string
 *                 description: Updated role description
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Updated list of permissions
 *               access_level:
 *                 type: string
 *                 enum: [basic, intermediate, advanced, admin]
 *                 description: Updated access level
 *               is_active:
 *                 type: boolean
 *                 description: Updated active status
 *     responses:
 *       200:
 *         description: Role updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized access
 *       404:
 *         description: Role not found
 *       500:
 *         description: Internal server error
 */
router.put(
  '/update-role/:id',
  [isAuthenticated, authorized(AccessRoles.ROLES)],
  tryCatchHandler(updateRole),
);

/**
 * @swagger
 * /roles/delete-role/{id}:
 *   delete:
 *     summary: Delete role
 *     description: Soft deletes a role (marks as inactive while preserving audit trail and user assignments)
 *     tags: [Roles]
 *     security:
 *       - xAuthToken: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the role to delete
 *     responses:
 *       200:
 *         description: Role deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         description: Unauthorized access
 *       404:
 *         description: Role not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Cannot delete role - users still assigned
 *       500:
 *         description: Internal server error
 */
router.delete(
  '/delete-role/:id',
  [isAuthenticated, authorized(AccessRoles.ROLES)],
  tryCatchHandler(deleteRole),
);

export default router;
