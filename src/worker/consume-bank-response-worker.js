import { connectRabbitMQ } from '../utils/rabbitmq.js';
import { getRabbitChannel } from '../utils/rabbitmq.js';
import config from '../config/config.js';
import { createBankResponseService } from '../apis/bankResponse/bankResponseServices.js';
import { logger } from '../utils/logger.js';

export async function startBankResponseWorker() {
  try {
    await connectRabbitMQ();
  } catch (err) {
    logger.error('Failed to connect to RabbitMQ:', err);
    return;
  }
  const channel = getRabbitChannel();
  const queue = config.rabbitmq.bankResponseQueue;
  await channel.assertQueue(queue, { durable: true });

  logger.info('Worker started. Waiting for messages...');
  // while (true) {
  //   const msg = await channel.get(queue, { noAck: false });
  channel.consume(queue, async (msg) => {
    // if (!msg) {
    //   await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before checking again
    //   continue;
    // }
    if (!msg) return;
    try {
      const data = JSON.parse(msg.content.toString());
      await createBankResponseService(
        data.payload,
        data.x_auth_token,
        data.role,
        null
      );
      channel.ack(msg);
      logger.info('[Worker] Bank response processed successfully:', data);
    } catch (err) {
      channel.nack(msg, false, false);
      logger.error('[Worker] Error processing bank response:', err);
    }
  }, { noAck: false })
}
