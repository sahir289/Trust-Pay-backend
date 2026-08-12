import { Buffer } from 'node:buffer';
import { logger } from '../utils/logger.js';
import { rabbitMQConnectionManager } from './connection.js';
import { assertAllTopologies, QUEUES } from './topology.js';

const PRODUCER_RETRY_ATTEMPTS = Number(process.env.RABBITMQ_PRODUCER_RETRY_ATTEMPTS || 3);
const PRODUCER_RETRY_DELAY_MS = Number(process.env.RABBITMQ_PRODUCER_RETRY_DELAY_MS || 500);

let producerChannel = null;
let isTopologyReady = false;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getProducerChannel() {
  if (producerChannel) {
    return producerChannel;
  }

  producerChannel = await rabbitMQConnectionManager.createConfirmChannel();
  producerChannel.on('close', () => {
    producerChannel = null;
    isTopologyReady = false;
  });

  if (!isTopologyReady) {
    await assertAllTopologies(producerChannel);
    isTopologyReady = true;
  }

  return producerChannel;
}

export async function publishMessage(queueName, payload, options = {}) {
  const message = Buffer.from(JSON.stringify(payload));

  for (let attempt = 1; attempt <= PRODUCER_RETRY_ATTEMPTS; attempt += 1) {
    try {
      const channel = await getProducerChannel();
      const published = channel.sendToQueue(
        queueName,
        message,
        {
          persistent: true,
          contentType: 'application/json',
          ...options,
        },
        (error) => {
          if (error) {
            logger.error('[RabbitMQ][Producer] Broker negative confirm', {
              queue: queueName,
              error: error.message,
            });
          }
        },
      );

      if (!published) {
        await new Promise((resolve) => channel.once('drain', resolve));
      }

      await channel.waitForConfirms();

      logger.info('[RabbitMQ][Producer] Message published', {
        queue: queueName,
      });
      return true;
    } catch (error) {
      logger.error('[RabbitMQ][Producer] Publish failed', {
        queue: queueName,
        attempt,
        error: error.message,
      });

      if (attempt < PRODUCER_RETRY_ATTEMPTS) {
        await sleep(PRODUCER_RETRY_DELAY_MS * attempt);
      } else {
        throw error;
      }
    }
  }

  return false;
}

export async function publishBankResponse(payload) {
  return publishMessage(QUEUES.BANK_RESPONSE, payload);
}

export async function publishBankResponseBotBulk(payload) {
  return publishMessage(QUEUES.BANK_RESPONSE_BOT_BULK, payload);
}

export async function publishBulkPayout(payload) {
  return publishMessage(QUEUES.BULK_PAYOUT, payload);
}

export async function publishBulkPayoutCreate(payload) {
  return publishMessage(QUEUES.BULK_PAYOUT_CREATE, payload);
}


export async function publishPayInProcess(payload) {
  return publishMessage(QUEUES.PAYIN_PROCESS, payload);
}

export async function publishMerchantCallback(payload) {
  return publishMessage(QUEUES.MERCHANT_CALLBACK, payload);
}

export async function publishTelegramMessage(payload) {
  return publishMessage(QUEUES.TELEGRAM_MESSAGE, payload);
}

export async function publishTelegramOcr(payload) {
  return publishMessage(QUEUES.TELEGRAM_OCR, payload);
}

export async function publishGetClientsAccountReport(payload) {
  return publishMessage(QUEUES.ACCOUNT_REPORT, payload);
}

rabbitMQConnectionManager.onReconnect(async () => {
  producerChannel = null;
  isTopologyReady = false;
  await getProducerChannel();
});
