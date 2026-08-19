import { logger } from '../utils/logger.js';

export const QUEUES = {
  BANK_RESPONSE: process.env.RABBITMQ_BANK_RESPONSE_QUEUE || 'bank_response_queue',
  BANK_RESPONSE_BOT_BULK: process.env.RABBITMQ_BANK_RESPONSE_BOT_BULK_QUEUE || 'bank_response_bot_bulk_queue',
  BULK_PAYOUT: process.env.RABBITMQ_BULK_PAYOUT_QUEUE || 'bulk_payout_queue',
  PAYIN_PROCESS: process.env.RABBITMQ_PAYIN_PROCESS_QUEUE || 'payin_process_queue',
  BULK_PAYOUT_CREATE: process.env.RABBITMQ_BULK_PAYOUT_CREATE_QUEUE || 'bulk_payout_create_queue',
  BULK_PAYOUT_UPDATE: process.env.RABBITMQ_BULK_PAYOUT_UPDATE_QUEUE || 'bulk_payout_update_queue',
  MERCHANT_CALLBACK: process.env.RABBITMQ_MERCHANT_CALLBACK_QUEUE || 'merchant_callback_queue',
  TELEGRAM_MESSAGE: process.env.RABBITMQ_TELEGRAM_MESSAGE_QUEUE || 'telegram_message_queue',
  TELEGRAM_OCR: process.env.RABBITMQ_TELEGRAM_OCR_QUEUE || 'telegram_ocr_queue',
  ACCOUNT_REPORT: process.env.RABBITMQ_ACCOUNT_REPORT_QUEUE || 'account_report_queue',
  PAYIN_REPORT: process.env.RABBITMQ_PAYIN_REPORT_QUEUE || 'payin_report_queue',
  PAYOUT_REPORT: process.env.RABBITMQ_PAYOUT_REPORT_QUEUE || 'payout_report_queue',
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
  bulkPayoutUpdate: queueTopology(
    QUEUES.BULK_PAYOUT_UPDATE,
    Number(
      process.env.BULK_PAYOUT_UPDATE_RETRY_DELAY_MS || 10000,
    ),
  ),
  payinProcess: queueTopology(
    QUEUES.PAYIN_PROCESS,
    Number(process.env.PAYIN_PROCESS_RETRY_DELAY_MS || 10000),
  ),
  merchantCallback: queueTopology(
    QUEUES.MERCHANT_CALLBACK,
    Number(process.env.MERCHANT_CALLBACK_RETRY_DELAY_MS || 10000),
  ),
  telegramMessage: queueTopology(
    QUEUES.TELEGRAM_MESSAGE,
    Number(process.env.TELEGRAM_MESSAGE_RETRY_DELAY_MS || 10000),
  ),
  telegramOcr: queueTopology(
    QUEUES.TELEGRAM_OCR,
    Number(process.env.TELEGRAM_OCR_RETRY_DELAY_MS || 15000),
  ),
  accountReport: queueTopology(
    QUEUES.ACCOUNT_REPORT,
    Number(process.env.ACCOUNT_REPORT_RETRY_DELAY_MS || 10000),
  ),
  PayInReport: queueTopology(
    QUEUES.PAYIN_REPORT,
    Number(process.env.ACCOUNT_REPORT_RETRY_DELAY_MS || 10000),
  ),
  PayOutReport: queueTopology(
    QUEUES.PAYOUT_REPORT,
    Number(process.env.ACCOUNT_REPORT_RETRY_DELAY_MS || 10000),
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
  await assertQueueTopology(channel, TOPOLOGY.bulkPayoutUpdate);
  await assertQueueTopology(channel, TOPOLOGY.payinProcess);
  await assertQueueTopology(channel, TOPOLOGY.merchantCallback);
  await assertQueueTopology(channel, TOPOLOGY.telegramMessage);
  await assertQueueTopology(channel, TOPOLOGY.telegramOcr);
  await assertQueueTopology(channel, TOPOLOGY.accountReport);
  await assertQueueTopology(channel, TOPOLOGY.PayInReport);
  await assertQueueTopology(channel, TOPOLOGY.PayOutReport);
  logger.info('[RabbitMQ] Queue topology ensured', {
    bankResponseQueue: TOPOLOGY.bankResponse.queue,
    bankResponseRetryQueue: TOPOLOGY.bankResponse.retryQueue,
    bankResponseDLQ: TOPOLOGY.bankResponse.dlq,
    bankResponseBotBulkQueue: TOPOLOGY.bankResponseBotBulk.queue,
    bankResponseBotBulkRetryQueue: TOPOLOGY.bankResponseBotBulk.retryQueue,
    bankResponseBotBulkDLQ: TOPOLOGY.bankResponseBotBulk.dlq,
    bulkPayoutQueue: TOPOLOGY.bulkPayout.queue,
    bulkPayoutCreateQueue: TOPOLOGY.bulkPayoutCreate.queue,
    bulkPayoutUpdateQueue: TOPOLOGY.bulkPayoutUpdate.queue,
    bulkPayoutRetryQueue: TOPOLOGY.bulkPayout.retryQueue,
    bulkPayoutDLQ: TOPOLOGY.bulkPayout.dlq,
    payinProcessQueue: TOPOLOGY.payinProcess.queue,
    payinProcessRetryQueue: TOPOLOGY.payinProcess.retryQueue,
    payinProcessDLQ: TOPOLOGY.payinProcess.dlq,
    merchantCallbackQueue: TOPOLOGY.merchantCallback.queue,
    merchantCallbackRetryQueue: TOPOLOGY.merchantCallback.retryQueue,
    merchantCallbackDLQ: TOPOLOGY.merchantCallback.dlq,
    telegramMessageQueue: TOPOLOGY.telegramMessage.queue,
    telegramMessageRetryQueue: TOPOLOGY.telegramMessage.retryQueue,
    telegramMessageDLQ: TOPOLOGY.telegramMessage.dlq,
    telegramOcrQueue: TOPOLOGY.telegramOcr.queue,
    accountReportQueue: TOPOLOGY.accountReport.queue,
    payInReportQueue: TOPOLOGY.PayInReport.queue,
    payOutReportQueue: TOPOLOGY.PayOutReport.queue,
    telegramOcrRetryQueue: TOPOLOGY.telegramOcr.retryQueue,
    telegramOcrDLQ: TOPOLOGY.telegramOcr.dlq,
  });
}
