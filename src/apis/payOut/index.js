import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import { createPayout, deletePayout, getPayouts, updatePayout, getPayoutsById } from './payOutController.js';
import { isAuthenticated } from '../../middlewares/auth.js';

const router = express.Router();

/**
 * @swagger
 * /payout:
 *   get:
 *     summary: Retrieve all payouts
 *     description: Returns a list of all payouts.
 *     tags:
 *       - Payout
 *     responses:
 *       200:
 *         description: A list of payouts.
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
 *       401:
 *         description: Unauthorized access
 */
router.get('/', isAuthenticated, tryCatchHandler(getPayouts));

/**
 * @swagger
 * /payout/{id}:
 *   get:
 *     summary: Retrieve a specific payout by ID
 *     description: Retrieves the details of a specific payout by its ID.
 *     tags:
 *       - Payout
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the payout to retrieve.
 *     responses:
 *       200:
 *         description: Payout details retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 name:
 *                   type: string
 *                 status:
 *                   type: string
 *       404:
 *         description: Payout not found.
 *       401:
 *         description: Unauthorized access
 */
router.get('/:id', isAuthenticated, tryCatchHandler(getPayoutsById));

/**
 * @swagger
 * /payout/create-payout:
 *   post:
 *     summary: Create a new payout
 *     description: Adds a new payout to the system.
 *     tags:
 *       - Payout
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Payout A"
 *               status:
 *                 type: string
 *                 example: "active"
 *     responses:
 *       201:
 *         description: Payout created successfully.
 *       400:
 *         description: Invalid request data.
 *       401:
 *         description: Unauthorized access
 */
router.post('/create-payout', isAuthenticated, tryCatchHandler(createPayout));

/**
 * @swagger
 * /payout/update-payout/{id}:
 *   put:
 *     summary: Update payout details
 *     description: Updates an existing payout's details by its ID.
 *     tags:
 *       - Payout
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the payout to update.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Updated Payout"
 *               status:
 *                 type: string
 *                 example: "inactive"
 *     responses:
 *       200:
 *         description: Payout updated successfully.
 *       404:
 *         description: Payout not found.
 *       401:
 *         description: Unauthorized access
 */
router.put('/update-payout/:id', isAuthenticated, tryCatchHandler(updatePayout));

/**
 * @swagger
 * /payout/delete-payout/{id}:
 *   delete:
 *     summary: Delete a payout
 *     description: Soft deletes a payout by changing its status to inactive.
 *     tags:
 *       - Payout
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the payout to delete.
 *     responses:
 *       200:
 *         description: Payout deleted successfully.
 *       404:
 *         description: Payout not found.
 *       401:
 *         description: Unauthorized access
 */
router.delete('/delete-payout/:id', isAuthenticated, tryCatchHandler(deletePayout));

export default router;
