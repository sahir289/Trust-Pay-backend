import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import {
  createDesignation,
  deleteDesignation,
  getDesignation,
  updateDesignation,
  getDesignationById,
} from './designationController.js';
import { authorized, isAuthenticated } from '../../middlewares/auth.js';
import { AccessRoles } from '../../constants/index.js';
const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Designation
 *   description: API endpoints for managing designations
 */

/**
 * @swagger
 * /designation:
 *   get:
 *     summary: Get all designations
 *     description: Retrieve a list of all designations with pagination support.
 *     tags: [Designation]
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
 *         description: Number of designations per page
 *     responses:
 *       200:
 *         description: Designations retrieved successfully.
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
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get(
  '/',
  [isAuthenticated, authorized(AccessRoles.DESIGNATION)],
  tryCatchHandler(getDesignation),
);

/**
 * @swagger
 * /designation/{id}:
 *   get:
 *     summary: Get a specific designation by ID
 *     description: Retrieves the details of a specific designation by its ID.
 *     tags: [Designation]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the designation to retrieve.
 *     responses:
 *       200:
 *         description: Designation details retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Designation retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "1"
 *                     name:
 *                       type: string
 *                       example: "Manager"
 *       404:
 *         description: Designation not found
 *       500:
 *         description: Internal server error
 */
router.get(
  '/:id',
  [isAuthenticated, authorized(AccessRoles.DESIGNATION)],
  tryCatchHandler(getDesignationById),
);

/**
 * @swagger
 * /designation/create-designation:
 *   post:
 *     summary: Create a new designation
 *     description: Adds a new designation to the system with the provided details.
 *     tags: [Designation]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Manager"
 *     responses:
 *       201:
 *         description: Designation created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Designation created successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "1"
 *                     name:
 *                       type: string
 *                       example: "Manager"
 *       400:
 *         description: Bad request (validation error)
 *       500:
 *         description: Internal server error
 */
router.post(
  '/create-designation',
  [isAuthenticated, authorized(AccessRoles.DESIGNATION)],
  tryCatchHandler(createDesignation),
);

/**
 * @swagger
 * /designation/update-designation/{id}:
 *   put:
 *     summary: Update an existing designation
 *     description: Updates the details of a specific designation by its ID.
 *     tags: [Designation]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the designation to update.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Senior Manager"
 *     responses:
 *       200:
 *         description: Designation updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Designation updated successfully"
 *       404:
 *         description: Designation not found
 *       500:
 *         description: Internal server error
 */
router.put(
  '/update-designation/:id',
  [isAuthenticated, authorized(AccessRoles.DESIGNATION)],
  tryCatchHandler(updateDesignation),
);

/**
 * @swagger
 * /designation/delete-designation/{id}:
 *   delete:
 *     summary: Delete a designation
 *     description: Deletes a specific designation by its ID from the system.
 *     tags: [Designation]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the designation to delete.
 *     responses:
 *       200:
 *         description: Designation deleted successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Designation deleted successfully"
 *       404:
 *         description: Designation not found
 *       500:
 *         description: Internal server error
 */
router.delete(
  '/delete-designation/:id',
  [isAuthenticated, authorized(AccessRoles.DESIGNATION)],
  tryCatchHandler(deleteDesignation),
);

export default router;
