import { logger } from '../utils/logger.js';

export const QUEUES = {
  BANK_RESPONSE: process.env.RABBITMQ_BANK_RESPONSE_QUEUE || 'bank_response_queue',
  BANK_RESPONSE_BOT_BULK: process.env.RABBITMQ_BANK_RESPONSE_BOT_BULK_QUEUE || 'bank_response_bot_bulk_queue',
  BULK_PAYOUT: process.env.RABBITMQ_BULK_PAYOUT_QUEUE || 'bulk_payout_queue',
  PAYIN_PROCESS: process.env.RABBITMQ_PAYIN_PROCESS_QUEUE || 'payin_process_queue',
  BULK_PAYOUT_CREATE: process.env.RABBITMQ_BULK_PAYOUT_CREATE_QUEUE || 'bulk_payout_create_queue',
};

const DLQ_ROUTING_KEY = 'dead';

const queueTopology = (queueName, retryDelayMs) => ({
  queue: queueName,
  dlx: `${queueName}_dlx`,
  dlq: `${queueName}_dlq`,
  retryQueue: `${queueName}_retry`,
  retryDelayMs,
  dlqRoutingKey: DLQ_ROUTING_KEY,
});

export const TOPOLOGY = {
  bankResponse: queueTopology(
    QUEUES.BANK_RESPONSE,
    Number(process.env.BANK_RESPONSE_RETRY_DELAY_MS || 10000),
  ),
  bankResponseBotBulk: queueTopology(
    QUEUES.BANK_RESPONSE_BOT_BULK,
    Number(process.env.BANK_RESPONSE_BOT_BULK_RETRY_DELAY_MS || 10000),
  ),
  bulkPayout: queueTopology(
    QUEUES.BULK_PAYOUT,
    Number(process.env.BULK_PAYOUT_RETRY_DELAY_MS || 10000),
  ),
  bulkPayoutCreate: queueTopology(
    QUEUES.BULK_PAYOUT_CREATE,
    Number(
      process.env.BULK_PAYOUT_CREATE_RETRY_DELAY_MS || 10000,
    ),
  ),
  payinProcess: queueTopology(
    QUEUES.PAYIN_PROCESS,
    Number(process.env.PAYIN_PROCESS_RETRY_DELAY_MS || 10000),
  ),
};

export async function assertQueueTopology(channel, topology) {
  await channel.assertExchange(topology.dlx, 'direct', { durable: true });
  await channel.assertQueue(topology.dlq, { durable: true });
  await channel.bindQueue(topology.dlq, topology.dlx, topology.dlqRoutingKey);

  await channel.assertQueue(topology.retryQueue, {
    durable: true,
    arguments: {
      'x-message-ttl': topology.retryDelayMs,
      'x-dead-letter-exchange': '',
      'x-dead-letter-routing-key': topology.queue,
    },
  });

  await channel.assertQueue(topology.queue, {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': topology.dlx,
      'x-dead-letter-routing-key': topology.dlqRoutingKey,
    },
  });
}

export async function assertAllTopologies(channel) {
  await assertQueueTopology(channel, TOPOLOGY.bankResponse);
  await assertQueueTopology(channel, TOPOLOGY.bankResponseBotBulk);
  await assertQueueTopology(channel, TOPOLOGY.bulkPayout);
  await assertQueueTopology(channel, TOPOLOGY.bulkPayoutCreate);
  await assertQueueTopology(channel, TOPOLOGY.payinProcess);
  logger.info('[RabbitMQ] Queue topology ensured', {
    bankResponseQueue: TOPOLOGY.bankResponse.queue,
    bankResponseRetryQueue: TOPOLOGY.bankResponse.retryQueue,
    bankResponseDLQ: TOPOLOGY.bankResponse.dlq,
    bankResponseBotBulkQueue: TOPOLOGY.bankResponseBotBulk.queue,
    bankResponseBotBulkRetryQueue: TOPOLOGY.bankResponseBotBulk.retryQueue,
    bankResponseBotBulkDLQ: TOPOLOGY.bankResponseBotBulk.dlq,
    bulkPayoutQueue: TOPOLOGY.bulkPayout.queue,
    bulkPayoutCreateQueue: TOPOLOGY.bulkPayoutCreate.queue,
    bulkPayoutRetryQueue: TOPOLOGY.bulkPayout.retryQueue,
    bulkPayoutDLQ: TOPOLOGY.bulkPayout.dlq,
    payinProcessQueue: TOPOLOGY.payinProcess.queue,
    payinProcessRetryQueue: TOPOLOGY.payinProcess.retryQueue,
    payinProcessDLQ: TOPOLOGY.payinProcess.dlq,
  });
}
