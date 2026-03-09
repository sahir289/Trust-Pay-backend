import { logger } from '../utils/logger.js';
import { rabbitMQConnectionManager } from './connection.js';
import {
  startBankResponseConsumer,
  stopBankResponseConsumer,
} from './consumers/bankResponseConsumer.js';
import {
  startBulkPayoutConsumer,
  stopBulkPayoutConsumer,
} from './consumers/bulkPayoutConsumer.js';

let consumersStarted = false;

export async function startRabbitMQConsumers() {
  if (consumersStarted) {
    return;
  }

  await rabbitMQConnectionManager.connect();
  await Promise.all([startBankResponseConsumer(), startBulkPayoutConsumer()]);

  consumersStarted = true;
  logger.info('[RabbitMQ] All consumers started');
}

export async function stopRabbitMQ() {
  if (consumersStarted) {
    await Promise.all([stopBankResponseConsumer(), stopBulkPayoutConsumer()]);
  }

  await rabbitMQConnectionManager.close();
  consumersStarted = false;

  logger.info('[RabbitMQ] Shutdown complete');
}
