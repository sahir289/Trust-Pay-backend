import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import { createDesignation, deleteDesignation, getDesignation, updateDesignation } from './designationController.js';
import { isAuthenticated } from '../../middlewares/auth.js';
const router = express.Router();

/**
 * @swagger
 * /designation:
 *   get:
 *     summary: Get Designation by ID
 *     description: Retrieve details of a specific designation by its ID.
 *     tags:
 *       - Designation
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
 */
router.get('/', isAuthenticated, tryCatchHandler(getDesignation));

/**
 * @swagger
 * /designation/create-designation:
 *   post:
 *     summary: Create a new Designation
 *     description: Creates a new designation with the provided details.
 *     tags:
 *       - Designation
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
 */
router.post('/create-designation', isAuthenticated, tryCatchHandler(createDesignation));

/**
 * @swagger
 * /designation/update-designation/{id}:
 *   put:
 *     summary: Update an existing Designation
 *     description: Updates the details of a specific designation by ID.
 *     tags:
 *       - Designation
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
 */
router.put('/update-designation/:id', isAuthenticated, tryCatchHandler(updateDesignation));

/**
 * @swagger
 * /designation/delete-designation/{id}:
 *   delete:
 *     summary: Delete a Designation
 *     description: Deletes a designation by ID.
 *     tags:
 *       - Designation
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
 */
router.delete('/delete-designation/:id', isAuthenticated, tryCatchHandler(deleteDesignation));

export default router;
