import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import { createPayout, deletePayout, getPayouts, updatePayout } from './payOutController.js';

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
 */
router.get('/', tryCatchHandler(getPayouts));

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
 */
router.post('/create-payout', tryCatchHandler(createPayout));

/**
 * @swagger
 * /payout/update-payout/{id}:
 *   put:
 *     summary: Update payout details
 *     description: Updates an existing vendor’s details.
 *     tags:
 *       - Payout
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *               name:
 *                 type: string
 *               status:
 *                 type: string
 *                 example: "inactive"
 *     responses:
 *       200:
 *         description: Payout updated successfully.
 *       404:
 *         description: Payout not found.
 */
router.put('/update-payout/:id', tryCatchHandler(updatePayout));

/**
 * @swagger
 * /payout/delete-payout/{id}:
 *   delete:
 *     summary: Delete a payout
 *     description: Soft deletes a payout by changing its status.
 *     tags:
 *       - Payout
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payout deleted successfully.
 *       404:
 *         description: Payout not found.
 */
router.delete('/delete-payout/:id', tryCatchHandler(deletePayout));

export default router;
