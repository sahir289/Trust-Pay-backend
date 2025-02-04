import express from 'express';
import { createBank, getBanks,getBankbyId,  updateBank, deleteBank } from './BankAccountsController.js';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
const router = express.Router();

/**
 * @swagger
 * /bank-accounts/create-bank-account:
 *   post:
 *     summary: Create a new bank account
 *     description: Adds a new bank account to the database
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               upi_id:
 *                 type: string
 *               upi_params:
 *                 type: string
 *               name:
 *                 type: string
 *               ac_no:
 *                 type: string
 *               ac_name:
 *                 type: string
 *               ifsc:
 *                 type: string
 *               bank_name:
 *                 type: string
 *               is_qr:
 *                 type: boolean
 *               is_bank:
 *                 type: boolean
 *               min_payin:
 *                 type: number
 *               max_payin:
 *                 type: number
 *               is_enabled:
 *                 type: boolean
 *               payin_count:
 *                 type: number
 *               balance:
 *                 type: number
 *               bank_used_for:
 *                 type: string
 *               config:
 *                 type: string
 *     responses:
 *       201:
 *         description: Bank account created successfully
 *       400:
 *         description: Invalid input
 */

/**
 * @swagger
 * /bank-accounts/get-all-banks:
 *   get:
 *     summary: Retrieve all bank accounts
 *     description: Fetches a list of all bank accounts from the database
 *     responses:
 *       200:
 *         description: List of bank accounts
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   name:
 *                     type: string
 *                   balance:
 *                     type: number
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /bank-accounts/getbank/{id}:
 *   get:
 *     summary: Retrieve a specific bank account by ID
 *     description: Fetches a bank account by its ID from the database
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the bank account to retrieve
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Bank account details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 name:
 *                   type: string
 *                 balance:
 *                   type: number
 *       404:
 *         description: Bank account not found
 */

/**
 * @swagger
 * /bank-accounts/update-bank-account/{id}:
 *   put:
 *     summary: Update an existing bank account
 *     description: Updates the details of a bank account by its ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the bank account to update
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               upi_id:
 *                 type: string
 *               upi_params:
 *                 type: string
 *               name:
 *                 type: string
 *               ac_no:
 *                 type: string
 *               ac_name:
 *                 type: string
 *               ifsc:
 *                 type: string
 *               bank_name:
 *                 type: string
 *               is_qr:
 *                 type: boolean
 *               is_bank:
 *                 type: boolean
 *               min_payin:
 *                 type: number
 *               max_payin:
 *                 type: number
 *               is_enabled:
 *                 type: boolean
 *               payin_count:
 *                 type: number
 *               balance:
 *                 type: number
 *               bank_used_for:
 *                 type: string
 *               config:
 *                 type: string
 *     responses:
 *       200:
 *         description: Bank account updated successfully
 *       400:
 *         description: Invalid input
 *       404:
 *         description: Bank account not found
 */

/**
 * @swagger
 * /bank-accounts/delete-bank-account/{id}:
 *   delete:
 *     summary: Delete a bank account by ID
 *     description: Soft delete a bank account by its ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the bank account to delete
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Bank account deleted successfully
 *       404:
 *         description: Bank account not found
 */

router.get('/getbanks', tryCatchHandler(getBanks));
router.get('/getbanks/:id', tryCatchHandler(getBankbyId));
router.post('/create-bank-account', tryCatchHandler(createBank));
router.put('/update-bank-account/:id', tryCatchHandler(updateBank));
router.put('/delete-bank-account/:id', tryCatchHandler(deleteBank));

export default router;
