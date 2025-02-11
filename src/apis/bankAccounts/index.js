import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import { createBankaccount, deleteBankaccount, getBankaccountById, getMerchantBankById, updateBankaccount } from './bankaccountController.js';
const router = express.Router();




 /* /bankAccounts/by-id:
 *   get:
 *     summary: Get user by id
 *     description: Returns user filtered by id.
 *     tags:
 *       - bank Accounts
 *     parameters:
 *       - in: query
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The bankAccountsname to filter bankAccounts by.
 *     responses:
 *       200:
 *         description: A filtered list of bankAccounts.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "get bankAccounts by id successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       bankAccountsname:
 *                         type: string
 *                         example: "john_doe"
 */
 router.get('/:id', tryCatchHandler(getBankaccountById));

/**
 * @swagger
 * /bankAccounts/create-bankAccounts:
 *   post:
 *     summary: create new bankAccounts
 *     description: Returns bankAccounts filtered by bankAccountsname.
 *     tags:
 *       - bank Accounts
 *     parameters:
 *       - in: query
 *         name: bankAccountsname
 *         schema:
 *           type: string
 *         required: true
 *         description: The bankAccountsname to filter bankAccounts by.
 *     responses:
 *       200:
 *         description: A filtered list of bankAccounts.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "bankAccounts created successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       bankAccountsname:
 *                         type: string
 *                         example: "john_doe"
 */
 router.post('/create-Bankaccount', tryCatchHandler(createBankaccount));


router.get('/get-merchant-banks', tryCatchHandler(getMerchantBankById));

 router.put('/update-Bankaccount/:id', tryCatchHandler(updateBankaccount));

/**
 * @swagger
 * /bankAccounts/delete-bankAccounts:
 *   put:
 *     summary: delete new bankAccounts
 *     description: Returns bankAccounts filtered by bankAccountsname.
 *     tags:
 *       - bank Accounts
 *     parameters:
 *       - in: query
 *         name: bankAccountsname
 *         schema:
 *           type: string
 *         required: true
 *         description: The bankAccountsname to filter bankAccounts by.
 *     responses:
 *       200:
 *         description: A filtered list of bankAccounts.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "bankAccounts created successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       bankAccountsname:
 *                         type: string
 *                         example: "john_doe"
 */
  router.put('/delete-Bankaccount/:id', tryCatchHandler(deleteBankaccount));

export default router;
