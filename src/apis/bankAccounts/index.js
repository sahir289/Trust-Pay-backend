import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import { createBankaccount, deleteBankaccount, getBankaccountById,getBankaccount, getMerchantBank, updateBankaccount } from './bankaccountController.js';
import { isAuthenticated } from '../../middlewares/auth.js';
const router = express.Router();

/**
 * @swagger
 * /bankAccounts:
 *   get:
 *     summary: Get user by id
 *     description: Returns user filtered by id.
 *     tags:
 *       - Bank Accounts
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
router.get('/', isAuthenticated, tryCatchHandler(getBankaccount));
router.get('/:id', isAuthenticated, tryCatchHandler(getBankaccountById));

/**
 * @swagger
 * /bankAccounts/create-bankAccounts:
 *   post:
 *     summary: create new bankAccounts
 *     description: Returns bankAccounts filtered by bankAccountsname.
 *     tags:
 *       - Bank Accounts
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
router.post('/create-bankAccount', isAuthenticated, tryCatchHandler(createBankaccount));

router.get('/get-merchantBanks', isAuthenticated, tryCatchHandler(getMerchantBank));

router.put('/update-bankAccount/:id', isAuthenticated, tryCatchHandler(updateBankaccount));

/**
 * @swagger
 * /bankAccounts/delete-bankAccounts:
 *   delete:
 *     summary: delete new bankAccounts
 *     description: Returns bankAccounts filtered by bankAccountsname.
 *     tags:
 *       - Bank Accounts
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
router.delete('/delete-bankAccount/:id', isAuthenticated, tryCatchHandler(deleteBankaccount));


export default router;