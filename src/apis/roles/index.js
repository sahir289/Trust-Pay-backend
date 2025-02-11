import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import { getRoles, createRole, updateRole, deleteRole } from './rolesController.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Roles
 *   description: API endpoints for managing roles
 */

/**
 * @swagger
 * /v1/roles:
 *   get:
 *     summary: Get all roles
 *     tags: [Roles]
 *     responses:
 *       200:
 *         description: A list of roles
 *       500:
 *         description: Internal server error
 */
router.get('/', tryCatchHandler(getRoles));

/**
 * @swagger
 * /v1/roles/create-role:
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
router.post('/create-role', tryCatchHandler(createRole));

/**
 * @swagger
 * /v1/roles/update-role/{id}:
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
router.put('/update-role/:id', tryCatchHandler(updateRole));

/**
 * @swagger
 * /v1/roles/delete-role/{id}:
 *   put:
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
router.put('/delete-role/:id', tryCatchHandler(deleteRole));

export default router;
