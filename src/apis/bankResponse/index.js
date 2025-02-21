import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import {
    createBankResponse,
    resetBankResponse, getBankResponse, getBankMessage
} from "./bankResponseController.js";
import { isAuthenticated } from '../../middlewares/auth.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: BankResponse
 *   description: Api endpoints for managing bankResponse
 */

/**
 * @swagger
 * /bankResponse:
 *   get:
 *     summary: Get all bankResponse
 *     tags: [BankResponse]
 *     responses:
 *       200:
 *         description: A list of bankResponse
 *       500:
 *         description: Internal server error
 */
router.post('/create-message', isAuthenticated, tryCatchHandler(createBankResponse));

/**
 * @swagger
 * /bankResponse/create-complaint:
 *   post:
 *     summary: Create a new complaint
 *     tags: [BankResponse]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               complaint_type:
 *                 type: string
 *               description:
 *                 type: string
 *               user_id:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Complaint created successfully
 *       400:
 *         description: Bad request
 */
router.get('/get-message', isAuthenticated, tryCatchHandler(getBankResponse));

/**
 * @swagger
 * /bankResponse/update-complaint/{id}:
 *   put:
 *     summary: Update a complaint
 *     tags: [BankResponse]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the complaint to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               complaint_type:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Complaint updated successfully
 *       404:
 *         description: Complaint not found
 */

router.get('/get-bank-message',  tryCatchHandler(getBankMessage));

/**
 * @swagger
 * /bankResponse/delete-complaint/{id}:
 *   delete:
 *     summary: Soft delete a complaint
 *     tags: [BankResponse]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the complaint to delete
 *     responses:
 *       200:
 *         description: Complaint deleted successfully
 *       404:
 *         description: Complaint not found
 */

router.put('/reset-message', isAuthenticated, tryCatchHandler(resetBankResponse));

export default router;
