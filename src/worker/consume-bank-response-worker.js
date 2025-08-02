import { connectRabbitMQ } from '../utils/rabbitmq.js';
import { getRabbitChannel } from '../utils/rabbitmq.js';
import config from '../config/config.js';
import { createBankResponseService } from '../apis/bankResponse/bankResponseServices.js';

(async () => {
  await connectRabbitMQ();
  const channel = getRabbitChannel();
  const queue = config.rabbitmq.bankResponseQueue;
  await channel.assertQueue(queue, { durable: true });

  console.log('Worker started. Waiting for messages...');
  while (true) {
    const msg = await channel.get(queue, { noAck: false });
    if (!msg) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before checking again
      continue;
    }
    try {
      const data = JSON.parse(msg.content.toString());
      await createBankResponseService(
        data.payload,
        data.x_auth_token,
        data.role,
        null
      );
      channel.ack(msg);
      console.log('[Worker] Processed bank response:', data);
    } catch (err) {
      channel.nack(msg, false, false);
      console.error('[Worker] Error processing bank response:', err);
    }
  }
})();
