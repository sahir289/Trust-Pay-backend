import express from 'express';
import { getRabbitChannel } from '../utils/rabbitmq.js';
import config from '../config/config.js';
import { createBankResponseService } from './bankResponse/bankResponseServices.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Bank Response
 *   description: Bank response processing endpoints
 */

/**
 * @swagger
 * /consume-bank-response/consume-bank-response:
 *   post:
 *     summary: Process bank responses from queue
 *     description: Consumes and processes bank response messages from RabbitMQ queue.
 *     tags: [Bank Response]
 *     security:
 *       - xAuthToken: []
 *     responses:
 *       200:
 *         description: Bank responses processed successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Bank responses processed successfully"
 *                 processedCount:
 *                   type: number
 *                   example: 5
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       success:
 *                         type: boolean
 *                       result:
 *                         type: object
 *       500:
 *         description: Error processing bank responses.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

router.post('/consume-bank-response', async (req, res) => {
  try {
    const channel = await getRabbitChannel();
    if (!channel) throw new Error('RabbitMQ channel not initialized');
    const queue = config.rabbitmq.bankResponseQueue;
    await channel.assertQueue(queue, { durable: true });

    const results = [];

    while (true) {
      const msg = await channel.get(queue, { noAck: false });
      if (!msg) break;

      try {
        const data = JSON.parse(msg.content.toString());

        const result = await createBankResponseService(
          data.payload,
          data.x_auth_token,
          data.role,
          data.name,
        );

        channel.ack(msg);
        results.push({ success: true, result });

      } catch (innerError) {
        channel.nack(msg, false, false); // discard this message
        results.push({ success: false, error: innerError.message });
      }
    }

    if (results.length === 0) {
      return res.status(200).json({ success: false, message: 'No messages in queue' });
    }

    return res.status(200).json({ success: true, results });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;


