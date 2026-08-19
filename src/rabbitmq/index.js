import { logger } from '../utils/logger.js';
import { rabbitMQConnectionManager } from './connection.js';
import {
  startBankResponseBulkConsumer,
  stopBankResponseBulkConsumer,
} from './consumers/bankResponseBulkConsumer.js';
import {
  startBankResponseConsumer,
  stopBankResponseConsumer,
} from './consumers/bankResponseConsumer.js';
import {
  startBulkPayoutConsumer,
  stopBulkPayoutConsumer,
} from './consumers/bulkPayoutConsumer.js';
import {
  startPayInProcessConsumer,
  stopPayInProcessConsumer,
} from './consumers/payinProcessConsumer.js';
import {
  startDlqReplayConsumer,
  stopDlqReplayConsumer,
} from './consumers/dlqReplayConsumer.js';
import { startBulkPayoutCreateConsumer } from './consumers/CreateBulkPayoutConsumer.js';
import {
  startBulkPayoutUpdateConsumer,
  stopBulkPayoutUpdateConsumer,
} from './consumers/UpdateBulkPayoutConsumer.js';
import {
  startMerchantCallbackConsumer,
  stopMerchantCallbackConsumer,
} from './consumers/merchantCallbackConsumer.js';
import {
  startTelegramMessageConsumer,
  stopTelegramMessageConsumer,
} from './consumers/telegramMessageConsumer.js';
import {
  startTelegramOcrConsumer,
  stopTelegramOcrConsumer,
} from './consumers/telegramOcrConsumer.js';
import { startAccountReportConsumer, stopAccountReportConsumer } from './consumers/accountReportConsumer.js';
import { startPayInReportConsumer, stopPayInReportConsumer } from './consumers/payInReportConsumer.js';
import { startPayOutReportConsumer, stopPayOutReportConsumer } from './consumers/payOutReportConsumer.js';

let consumersStarted = false;

export async function startRabbitMQConsumers() {
  if (consumersStarted) {
    return;
  }

  await rabbitMQConnectionManager.connect();
  await Promise.all([
    startBankResponseConsumer(),
    startBankResponseBulkConsumer(),
    startAccountReportConsumer(),
    startPayInReportConsumer(),
    startPayOutReportConsumer(),
    startBulkPayoutConsumer(),
    startBulkPayoutCreateConsumer(),
    startBulkPayoutUpdateConsumer(),
    startPayInProcessConsumer(),
    startMerchantCallbackConsumer(),
    startTelegramMessageConsumer(),
    startTelegramOcrConsumer(),
    startDlqReplayConsumer(),
  ]);

  consumersStarted = true;
  logger.info('[RabbitMQ] All consumers started');
}

export async function stopRabbitMQ() {
  if (consumersStarted) {
    await Promise.all([
      stopBankResponseConsumer(),
      stopBankResponseBulkConsumer(),
      stopBulkPayoutConsumer(),
      stopBulkPayoutUpdateConsumer(),
      stopAccountReportConsumer(),
      stopPayInReportConsumer(),
      stopPayOutReportConsumer(),
      stopPayInProcessConsumer(),
      stopMerchantCallbackConsumer(),
      stopTelegramMessageConsumer(),
      stopTelegramOcrConsumer(),
      stopDlqReplayConsumer(),
    ]);
  }

  await rabbitMQConnectionManager.close();
  consumersStarted = false;

  logger.info('[RabbitMQ] Shutdown complete');
}
