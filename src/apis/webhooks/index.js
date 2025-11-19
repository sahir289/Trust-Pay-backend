import express from 'express';
// import cashfreeWebHook from './cashfree/index.js';
// import zenTechIndWebhook from './zenTechInd/index.js';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import { cashfreeWebHook } from './cashfree.js';
import { zenTechIndWebhook } from './zenTechInd.js';
import { clickrrWebhook } from './clickrr.js';
import { nmplPayWebhook } from './nmplPay.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Webhooks
 *   description: Payment gateway webhook endpoints
 */

/**
 * @swagger
 * /webhook/cashfree:
 *   post:
 *     summary: Cashfree payment webhook
 *     description: Handles payment status updates from Cashfree payment gateway.
 *     tags: [Webhooks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 example: "PAYMENT_SUCCESS_WEBHOOK"
 *               data:
 *                 type: object
 *                 properties:
 *                   order_id:
 *                     type: string
 *                     example: "order_123"
 *                   payment_status:
 *                     type: string
 *                     example: "SUCCESS"
 *                   amount:
 *                     type: number
 *                     example: 100.50
 *     responses:
 *       200:
 *         description: Webhook processed successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       400:
 *         description: Invalid webhook data.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/cashfree', tryCatchHandler(cashfreeWebHook));

/**
 * @swagger
 * /webhook/zenTechInd:
 *   post:
 *     summary: ZenTech India payment webhook
 *     description: Handles payment status updates from ZenTech India payment gateway.
 *     tags: [Webhooks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               transaction_id:
 *                 type: string
 *                 example: "txn_123"
 *               status:
 *                 type: string
 *                 example: "success"
 *               amount:
 *                 type: number
 *                 example: 100.50
 *     responses:
 *       200:
 *         description: Webhook processed successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       400:
 *         description: Invalid webhook data.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/zenTechInd', tryCatchHandler(zenTechIndWebhook));

/**
 * @swagger
 * /webhook/nmplPay:
 *   post:
 *     summary: NMPL Pay webhook
 *     description: Handles payment status updates from NMPL Pay payment gateway.
 *     tags: [Webhooks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               orderId:
 *                 type: string
 *                 example: "order_123"
 *               paymentStatus:
 *                 type: string
 *                 example: "SUCCESS"
 *               amount:
 *                 type: number
 *                 example: 100.50
 *     responses:
 *       200:
 *         description: Webhook processed successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       400:
 *         description: Invalid webhook data.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/nmplPay', tryCatchHandler(nmplPayWebhook));

/**
 * @swagger
 * /webhook/clickrr:
 *   post:
 *     summary: Clickrr payment webhook
 *     description: Handles payment status updates from Clickrr payment gateway.
 *     tags: [Webhooks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               order_id:
 *                 type: string
 *                 example: "click_order_123"
 *               status:
 *                 type: string
 *                 example: "completed"
 *               amount:
 *                 type: number
 *                 example: 100.50
 *     responses:
 *       200:
 *         description: Webhook processed successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       400:
 *         description: Invalid webhook data.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/clickrr', tryCatchHandler(clickrrWebhook)); 

export default router;
