import express from 'express';
import { cashfreeWebHook } from '../webhooks/cashfree.js';
import tryCatchHandler from '../../utils/tryCatchHandler.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Cashfree Webhook
 *   description: Cashfree payment gateway webhook endpoints
 */

/**
 * @swagger
 * /cashfreeWebhook/cashfree:
 *   post:
 *     summary: Cashfree payment webhook handler
 *     description: Dedicated endpoint for handling Cashfree payment webhook callbacks.
 *     tags: [Cashfree Webhook]
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
 *                 description: Type of webhook event
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
 *                   cf_payment_id:
 *                     type: string
 *                     example: "cf_12345"
 *                   payment_method:
 *                     type: string
 *                     example: "upi"
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

export default router;
