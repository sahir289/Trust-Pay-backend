import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import { createSettlement, deleteSettlement, getSettlementById, updateSettlement } from './settlementController.js';
const router = express.Router();



/**
 * @swagger
 * /settlement:
 *   get:
 *     summary: Get all settlement
 *     description: Returns a status message to verify the Settlement is authorized or not.
 *     tags:
 *       - Settlement/{id}
 *      responses:
 *       200:
 *         description: Successfully retrieved chargebacks.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "get chargeBacks successfully"
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
 *     summary: create new Settlement
 *     description: Returns Settlements filtered by Settlementname.
 *     tags:
 *       - settlement
 *     parameters:
 *       - in: query
 *         name: Settlementname
 *         schema:
 *           type: string
 *         required: true
 *         description: The Settlementname to filter Settlements by.
 *     responses:
 *       200:
 *         description: A filtered list of Settlements.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Settlement created successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       Settlementname:
 *                         type: string
 *                         example: "john_doe"
 */
 router.post('/create-settlement', tryCatchHandler(createSettlement));
/**
 * @swagger
 * /settlement/update-settlement:
 *   put:
 *     summary: update new Settlement
 *     description: Returns Settlements filtered by Settlementname.
 *     tags:
 *       - settlement
 *     parameters:
 *       - in: query
 *         name: Settlementname
 *         schema:
 *           type: string
 *         required: true
 *         description: The Settlementname to filter Settlements by.
 *     responses:
 *       200:
 *         description: A filtered list of Settlements.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Settlement created successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       Settlementname:
 *                         type: string
 *                         example: "john_doe"
 */
 router.put('/update-settlement/:id', tryCatchHandler(updateSettlement));
/**
 * @swagger
 * /settlement/delete-settlement:
 *   put:
 *     summary: create new Settlement
 *     description: Returns Settlements filtered by Settlementname.
 *     tags:
 *       - settlement
 *     parameters:
 *       - in: query
 *         name: Settlementname
 *         schema:
 *           type: string
 *         required: true
 *         description: The Settlementname to filter Settlements by.
 *     responses:
 *       200:
 *         description: A filtered list of Settlements.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Settlement created successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       Settlementname:
 *                         type: string
 *                         example: "john_doe"
 */
 router.put('/delete-settlement/:id', tryCatchHandler(deleteSettlement));

export default router;
