import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import {
  createBeneficiaryAccount,
  deleteBeneficiaryAccount,
  getBeneficiaryAccountById,
  getBeneficiaryAccount,
  updateBeneficiaryAccount,
  getBeneficiaryAccountByBankName,
  getBeneficiaryAccountBySearch,
} from './beneficiaryAccountController.js';
const router = express.Router();
import { authorized, isAuthenticated } from '../../middlewares/auth.js';
import { AccessRoles } from '../../constants/index.js';

/**
 * @swagger
 * tags:
 *   name: Beneficiary Accounts
 *   description: API endpoints for managing beneficiary accounts and bank account information
 */

/**
 * @swagger
 * /beneficiaryAccounts/get:
 *   get:
 *     summary: Get all beneficiary accounts
 *     description: Returns a complete list of all beneficiary accounts in the system
 *     tags: [Beneficiary Accounts]
 *     security:
 *       - xAuthToken: []
 *     responses:
 *       200:
 *         description: List of beneficiary accounts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         description: Unauthorized access
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 */
router.get(
  '/get',
  [isAuthenticated, authorized(AccessRoles.BENEFICIARY_ACCOUNTS)],
  tryCatchHandler(getBeneficiaryAccount),
);

/**
 * @swagger
 * /beneficiaryAccounts:
 *   get:
 *     summary: Search beneficiary accounts
 *     description: Returns beneficiary accounts based on search criteria with pagination
 *     tags: [Beneficiary Accounts]
 *     security:
 *       - xAuthToken: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for filtering accounts
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: bank_name
 *         schema:
 *           type: string
 *         description: Filter by bank name
 *     responses:
 *       200:
 *         description: Beneficiary accounts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         description: Unauthorized access
 *       500:
 *         description: Internal server error
 */
router.get(
  '/',
  [isAuthenticated, authorized(AccessRoles.BENEFICIARY_ACCOUNTS)],
  tryCatchHandler(getBeneficiaryAccountBySearch),
);

/**
 * @swagger
 * /beneficiaryAccounts/beneficiarybanknames:
 *   get:
 *     summary: Get beneficiary bank names
 *     description: Returns a list of all unique bank names from beneficiary accounts
 *     tags: [Beneficiary Accounts]
 *     security:
 *       - xAuthToken: []
 *     responses:
 *       200:
 *         description: Beneficiary bank names retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         description: Unauthorized access
 *       500:
 *         description: Internal server error
 */
router.get(
  '/beneficiarybanknames',
  [isAuthenticated, authorized(AccessRoles.ALL)],
  tryCatchHandler(getBeneficiaryAccountByBankName),
);

/**
 * @swagger
 * /beneficiaryAccounts/{id}:
 *   get:
 *     summary: Get a beneficiary account by ID
 *     description: Returns the details of a specific beneficiary account
 *     tags: [Beneficiary Accounts]
 *     security:
 *       - xAuthToken: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the beneficiary account to fetch
 *     responses:
 *       200:
 *         description: Beneficiary account details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         description: Unauthorized access
 *       404:
 *         description: Beneficiary account not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 */
router.get(
  '/:id',
  [isAuthenticated, authorized(AccessRoles.BENEFICIARY_ACCOUNTS)],
  tryCatchHandler(getBeneficiaryAccountById),
);
/**
 * @swagger
 * /beneficiaryAccounts/create-beneficiary:
 *   post:
 *     summary: Create a new beneficiary account
 *     description: Creates a new beneficiary account and returns the created account
 *     tags: [Beneficiary Accounts]
 *     security:
 *       - xAuthToken: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - account_holder_name
 *               - account_number
 *               - ifsc_code
 *               - bank_name
 *             properties:
 *               account_holder_name:
 *                 type: string
 *                 description: Name of the account holder
 *                 example: "John Doe"
 *               account_number:
 *                 type: string
 *                 description: Bank account number
 *                 example: "1234567890"
 *               ifsc_code:
 *                 type: string
 *                 description: IFSC code of the bank
 *                 example: "HDFC0001234"
 *               bank_name:
 *                 type: string
 *                 description: Name of the bank
 *                 example: "HDFC Bank"
 *               branch_name:
 *                 type: string
 *                 description: Bank branch name
 *                 example: "Mumbai Main Branch"
 *               account_type:
 *                 type: string
 *                 enum: [savings, current, nre, nro]
 *                 description: Type of bank account
 *                 example: "savings"
 *     responses:
 *       201:
 *         description: Beneficiary account created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       400:
 *         description: Invalid request data or validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized access
 *       500:
 *         description: Internal server error
 */
router.post(
  '/create-beneficiary',
  [isAuthenticated, authorized(AccessRoles.BENEFICIARY_ACCOUNTS)],
  tryCatchHandler(createBeneficiaryAccount),
);

/**
 * @swagger
 * /beneficiaryAccounts/update-beneficiary/{id}:
 *   put:
 *     summary: Update a beneficiary account
 *     description: Updates the details of a specific beneficiary account
 *     tags: [Beneficiary Accounts]
 *     security:
 *       - xAuthToken: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the beneficiary account to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               account_holder_name:
 *                 type: string
 *                 description: Updated account holder name
 *               account_number:
 *                 type: string
 *                 description: Updated account number
 *               ifsc_code:
 *                 type: string
 *                 description: Updated IFSC code
 *               bank_name:
 *                 type: string
 *                 description: Updated bank name
 *               branch_name:
 *                 type: string
 *                 description: Updated branch name
 *               account_type:
 *                 type: string
 *                 enum: [savings, current, nre, nro]
 *                 description: Updated account type
 *               status:
 *                 type: string
 *                 enum: [active, inactive, blocked]
 *                 description: Account status
 *     responses:
 *       200:
 *         description: Beneficiary account updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       400:
 *         description: Invalid request data or validation error
 *       401:
 *         description: Unauthorized access
 *       404:
 *         description: Beneficiary account not found
 *       500:
 *         description: Internal server error
 */
router.put(
  '/update-beneficiary/:id',
  [isAuthenticated, authorized(AccessRoles.BENEFICIARY_ACCOUNTS)],
  tryCatchHandler(updateBeneficiaryAccount),
);

/**
 * @swagger
 * /beneficiaryAccounts/delete-beneficiary/{id}:
 *   delete:
 *     summary: Delete a beneficiary account
 *     description: Deletes a specific beneficiary account by ID (soft delete to maintain audit trail)
 *     tags: [Beneficiary Accounts]
 *     security:
 *       - xAuthToken: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the beneficiary account to delete
 *     responses:
 *       200:
 *         description: Beneficiary account deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         description: Unauthorized access
 *       404:
 *         description: Beneficiary account not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 */
router.delete(
  '/delete-beneficiary/:id',
  [isAuthenticated, authorized(AccessRoles.BENEFICIARY_ACCOUNTS)],
  tryCatchHandler(deleteBeneficiaryAccount),
);

export default router;
