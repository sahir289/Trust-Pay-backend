import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import {
  createBankResponse,
  getBankResponse,
  getBankMessage,
  updateBankResponse,
  getBankResponseBySearch,
  createBankBotResponse,
  getClaimResponse,
  importBankResponse,
  resetBankResponseController,
  createBankBotResponseBulk,
} from './bankResponseController.js';
import { isAuthenticated, authorized } from '../../middlewares/auth.js';
import { AccessRoles } from '../../constants/index.js';
import { multerUpload } from '../../utils/index.js';
import { rateLimitMiddleware, rateLimitMiddlewareBot } from '../../middlewares/rateLimiter.js';
const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: BankResponse
 *   description: API endpoints for managing bank response messages and bot communications
 */

/**
 * @swagger
 * /bankResponse/claim:
 *   get:
 *     summary: Get claim response
 *     description: Retrieves claim response data for bank transactions
 *     tags: [BankResponse]
 *     security:
 *       - xAuthToken: []
 *     responses:
 *       200:
 *         description: Claim response retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 */
router.get(
  '/claim',
  [isAuthenticated, authorized(AccessRoles.BANK_RESPONSE)],
  tryCatchHandler(getClaimResponse),
);

/**
 * @swagger
 * /bankResponse/create-bot-message:
 *   post:
 *     summary: Create bot message
 *     description: Creates a new bot message for bank response processing
 *     tags: [BankResponse]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *                 description: Bot message content
 *               reference_id:
 *                 type: string
 *                 description: Reference ID for the message
 *     responses:
 *       201:
 *         description: Bot message created successfully
 *       400:
 *         description: Invalid request data
 *       429:
 *         description: Rate limit exceeded
 */
router.post('/create-bot-message', rateLimitMiddlewareBot, tryCatchHandler(createBankBotResponse));

/**
 * @swagger
 * /bankResponse/create-bot-message-bulk:
 *   post:
 *     summary: Create bulk bot messages
 *     description: Creates multiple bot messages in a single request
 *     tags: [BankResponse]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               messages:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                     reference_id:
 *                       type: string
 *     responses:
 *       201:
 *         description: Bulk bot messages created successfully
 *       400:
 *         description: Invalid request data
 */
router.post('/create-bot-message-bulk', tryCatchHandler(createBankBotResponseBulk));

/**
 * @swagger
 * /bankResponse/create-message:
 *   post:
 *     summary: Create bank response message
 *     description: Creates a new bank response message with authentication and rate limiting
 *     tags: [BankResponse]
 *     security:
 *       - xAuthToken: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *                 description: Bank response message content
 *               transaction_id:
 *                 type: string
 *                 description: Associated transaction ID
 *               bank_reference:
 *                 type: string
 *                 description: Bank reference number
 *     responses:
 *       201:
 *         description: Bank response message created successfully
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 *       429:
 *         description: Rate limit exceeded
 */
router.post(
  '/create-message',
  [isAuthenticated, rateLimitMiddleware, authorized(AccessRoles.BANK_RESPONSE)],
  tryCatchHandler(createBankResponse),
);

/**
 * @swagger
 * /bankResponse:
 *   get:
 *     summary: Search bank responses
 *     description: Retrieves bank responses based on search criteria
 *     tags: [BankResponse]
 *     security:
 *       - xAuthToken: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for filtering responses
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
 *     responses:
 *       200:
 *         description: Bank responses retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get(
  '/',
  [isAuthenticated, authorized(AccessRoles.BANK_RESPONSE)],
  tryCatchHandler(getBankResponseBySearch),
);

/**
 * @swagger
 * /bankResponse/BankResponseReports:
 *   get:
 *     summary: Get bank response reports
 *     description: Retrieves comprehensive bank response reports
 *     tags: [BankResponse]
 *     security:
 *       - xAuthToken: []
 *     responses:
 *       200:
 *         description: Bank response reports retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get(
  '/BankResponseReports',
  [isAuthenticated, authorized(AccessRoles.BANK_RESPONSE)],
  tryCatchHandler(getBankResponse),
);

/**
 * @swagger
 * /bankResponse/get-bank-message:
 *   get:
 *     summary: Get bank messages
 *     description: Retrieves bank messages from the system
 *     tags: [BankResponse]
 *     security:
 *       - xAuthToken: []
 *     parameters:
 *       - in: query
 *         name: message_id
 *         schema:
 *           type: string
 *         description: Specific message ID to retrieve
 *     responses:
 *       200:
 *         description: Bank messages retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get(
  '/get-bank-message',
  [isAuthenticated, authorized(AccessRoles.BANK_RESPONSE)],
  tryCatchHandler(getBankMessage),
);

/**
 * @swagger
 * /bankResponse/update-message/{id}:
 *   put:
 *     summary: Update a bank response message
 *     description: Updates an existing bank response message by ID
 *     tags: [BankResponse]
 *     security:
 *       - xAuthToken: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the bank response to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *                 description: Updated message content
 *               status:
 *                 type: string
 *                 description: Updated status
 *               notes:
 *                 type: string
 *                 description: Additional notes
 *     responses:
 *       200:
 *         description: Bank response updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Bank response not found
 */
router.put(
  '/update-message/:id',
  [isAuthenticated, authorized(AccessRoles.BANK_RESPONSE)],
  tryCatchHandler(updateBankResponse),
);

/**
 * @swagger
 * /bankResponse/reset-message/{id}:
 *   put:
 *     summary: Reset bank response message
 *     description: Resets a bank response message to its initial state
 *     tags: [BankResponse]
 *     security:
 *       - xAuthToken: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the bank response to reset
 *     responses:
 *       200:
 *         description: Bank response reset successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Bank response not found
 */
router.put(
  '/reset-message/:id',
  [isAuthenticated, authorized(AccessRoles.BANK_RESPONSE)],
  tryCatchHandler(resetBankResponseController),
);

/**
 * @swagger
 * /bankResponse/import-bank-response:
 *   post:
 *     summary: Import bank response data
 *     description: Imports bank response data from a file upload
 *     tags: [BankResponse]
 *     security:
 *       - xAuthToken: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: File containing bank response data (CSV, Excel)
 *     responses:
 *       200:
 *         description: Bank response data imported successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       400:
 *         description: Invalid file format or data
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post(
  '/import-bank-response',
  multerUpload.single('file'),
  [isAuthenticated, authorized(AccessRoles.BANK_RESPONSE)],
  tryCatchHandler(importBankResponse),
);

export default router;
