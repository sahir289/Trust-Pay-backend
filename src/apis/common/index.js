import express from 'express';
import { getTotalCount } from './commonController.js';
import { isAuthenticated, authorized } from '../../middlewares/auth.js';
import { AccessRoles } from '../../constants/index.js';

const router = express.Router();

/**
 * @swagger
 * /common/count/{tableName}:
 *   get:
 *     summary: Get total count for a module
 *     description: Returns the total count of records for a given module.
 *     tags:
 *       - Common
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tableName
 *         required: true
 *         schema:
 *           type: string
 *         description: Name of the table/module
 *       - in: query
 *         name: role
 *         required: false
 *         schema:
 *           type: string
 *         description: Role of the user
 *     responses:
 *       200:
 *         description: Total count retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: integer
 *                   example: 100
 *   post:
 *     summary: Get total count for a module (POST)
 *     description: Returns the total count of records for a given module using request body filters.
 *     tags:
 *       - Common
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tableName
 *         required: true
 *         schema:
 *           type: string
 *         description: Name of the table/module
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               role:
 *                 type: string
 *               filters:
 *                 oneOf:
 *                   - type: string
 *                   - type: object
 *     responses:
 *       200:
 *         description: Total count retrieved successfully.
 */
router.get(
  '/count/:tableName',
  [isAuthenticated, authorized(AccessRoles.ALL)],
  getTotalCount,
);

router.post(
  '/count/:tableName',
  [isAuthenticated, authorized(AccessRoles.ALL)],
  getTotalCount,
);

export default router;
