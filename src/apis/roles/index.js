import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import { getRoles, createRole, updateRole, deleteRole,getRolesById} from './rolesController.js';
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
 *     tags: [Roles]
 *     responses:
 *       200:
 *         description: A list of roles
 *       500:
 *         description: Internal server error
 */
router.get('/',[isAuthenticated, authorized(AccessRoles.ROLES)], tryCatchHandler(getRoles));
router.get('/:id',[isAuthenticated, authorized(AccessRoles.ROLES)], tryCatchHandler(getRolesById));

/**
 * @swagger
 * /roles/create-role:
 *   post:
 *     summary: Create a new role
 *     tags: [Roles]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               role:
 *                 type: string
 *               company_id:
 *                 type: integer
 *               created_by:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Role created successfully
 *       400:
 *         description: Bad request
 */
router.post('/create-role',[isAuthenticated, authorized(AccessRoles.ROLES)], tryCatchHandler(createRole));

/**
 * @swagger
 * /roles/update-role/{id}:
 *   put:
 *     summary: Update a role
 *     tags: [Roles]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the role to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               role:
 *                 type: string
 *               company_id:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Role updated successfully
 *       404:
 *         description: Role not found
 */
router.put('/update-role/:id',[isAuthenticated, authorized(AccessRoles.ROLES)], tryCatchHandler(updateRole));

/**
 * @swagger
 * /roles/delete-role/{id}:
 *   delete:
 *     summary: Soft delete a role
 *     tags: [Roles]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the role to delete
 *     responses:
 *       200:
 *         description: Role deleted successfully
 *       404:
 *         description: Role not found
 */
router.delete('/delete-role/:id',[isAuthenticated, authorized(AccessRoles.ROLES)], tryCatchHandler(deleteRole));

export default router;
