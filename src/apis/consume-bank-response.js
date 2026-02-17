import express from 'express';
import { getRabbitChannel } from '../utils/rabbitmq.js';
import config from '../config/config.js';
import { createBankResponseService } from './bankResponse/bankResponseServices.js';

const DLX_NAME = 'bank_responses.dlx';
const DLQ_NAME = 'bank_responses.dlq';

const router = express.Router();

router.post('/consume-bank-response', async (req, res) => {
  try {
    const channel = await getRabbitChannel();
    if (!channel) throw new Error('RabbitMQ channel not initialized');
    const queue = config.rabbitmq.bankResponseQueue;
    
    // Ensure DLX and DLQ exist
    await channel.assertExchange(DLX_NAME, 'direct', { durable: true });
    await channel.assertQueue(DLQ_NAME, { durable: true });
    await channel.bindQueue(DLQ_NAME, DLX_NAME, 'failed');
    await channel.assertQueue(queue, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': DLX_NAME,
        'x-dead-letter-routing-key': 'failed',
      },
    });

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


