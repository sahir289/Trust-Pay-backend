import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import { createSettlement, deleteSettlement, getSettlementById, updateSettlement } from './settlementController.js';
const router = express.Router();
/**
 * @swagger
 * /settlement:
 *   get:
 *     summary: Get all settlements
 *     description: Returns a status message to verify if the settlement is authorized or not.
 *     tags:
 *       - settlement
 *     responses:
 *       200:
 *         description: Successfully retrieved settlements.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Get settlements successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 */
router.get('/:id', tryCatchHandler(getSettlementById));

/**
 * @swagger
 * /settlement/create-settlement:
 *   post:
 *     summary: Create a new settlement
 *     description: Creates a new settlement in the system.
 *     tags:
 *       - settlement
 *     parameters:
 *       - in: query
 *         name: Settlementname
 *         schema:
 *           type: string
 *         required: true
 *         description: The name of the settlement to create.
 *     responses:
 *       200:
 *         description: Settlement created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Settlement created successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     Settlementname:
 *                       type: string
 *                       example: "john_doe"
 */
router.post('/create-settlement', tryCatchHandler(createSettlement));

/**
 * @swagger
 * /settlement/update-settlement/{id}:
 *   put:
 *     summary: Update an existing settlement
 *     description: Updates an existing settlement by its ID.
 *     tags:
 *       - settlement
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The ID of the settlement to update.
 *         schema:
 *           type: integer
 *       - in: query
 *         name: Settlementname
 *         schema:
 *           type: string
 *         required: true
 *         description: The updated settlement name.
 *     responses:
 *       200:
 *         description: Settlement updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Settlement updated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     Settlementname:
 *                       type: string
 *                       example: "john_doe"
 */
router.put('/update-settlement/:id', tryCatchHandler(updateSettlement));

/**
 * @swagger
 * /settlement/delete-settlement/{id}:
 *   delete:
 *     summary: Delete a settlement
 *     description: Deletes an existing settlement.
 *     tags:
 *       - settlement
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The ID of the settlement to delete.
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Settlement deleted successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Settlement deleted successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     Settlementname:
 *                       type: string
 *                       example: "john_doe"
 */
router.delete('/delete-settlement/:id', tryCatchHandler(deleteSettlement));

export default router;
