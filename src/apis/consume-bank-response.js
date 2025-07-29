import express from 'express';
import { getRabbitChannel } from '../utils/rabbitmq.js';
import config from '../config/config.js';
import { createBankResponseService } from './bankResponse/bankResponseServices.js';


const router = express.Router();

router.post('/consume-bank-response', async (req, res) => {
  try {
    const channel = getRabbitChannel();
    if (!channel) throw new Error('RabbitMQ channel not initialized');
    const queue = config.rabbitmq.bankResponseQueue;
    await channel.assertQueue(queue, { durable: true });
    const msg = await channel.get(queue, { noAck: false });
    if (msg) {
      const data = JSON.parse(msg.content.toString());
      const result = await createBankResponseService(data.payload, data.company_id, data.role, data.user_name, data.user_id);
      channel.ack(msg);
      res.status(200).json({ success: true, result });
    } else { 
      res.status(200).json({ success: false, message: 'No messages in queue' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;


