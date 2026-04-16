/**
 * Parking Queue Replayer
 *
 * Moves all messages from a *_dlq_parking queue back into the
 * corresponding retry queue so they get reprocessed normally.
 *
 * Usage:
 *   node scripts/replayParkingQueue.js bank_response_queue
 *   node scripts/replayParkingQueue.js payin_process_queue
 *   node scripts/replayParkingQueue.js bulk_payout_queue
 *   node scripts/replayParkingQueue.js bank_response_bot_bulk_queue
 *
 * Optional env overrides:
 *   RABBITMQ_URL=amqp://user:pass@host:5672
 *   REPLAY_RATE_MS=200          (delay between publishes, default 200ms)
 *   DRY_RUN=true                (inspect only, no ack/publish)
 */

import amqp from 'amqplib';
import dotenv from 'dotenv';
import logger from '../src/utils/logger';
dotenv.config();

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
const REPLAY_RATE_MS = Math.max(
  0,
  Number(process.env.REPLAY_RATE_MS || 200),
);
const DRY_RUN = ['1', 'true', 'yes'].includes(
  String(process.env.DRY_RUN || '').toLowerCase(),
);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const QUEUE_NAMES = [
  'bank_response_queue',
  'bank_response_bot_bulk_queue',
  'bulk_payout_queue',
  'payin_process_queue',
];

function deriveQueues(mainQueueName) {
  if (!QUEUE_NAMES.includes(mainQueueName)) {
    const validList = QUEUE_NAMES.map((q) => '  ' + q).join('\n');
    logger.error(
      '\nUnknown queue: "' + mainQueueName + '"\nValid options:\n' + validList + '\n',
    );
    process.exit(1);
  }

  return {
    parkingQueue: `${mainQueueName}_dlq_parking`,
    retryQueue: `${mainQueueName}_retry`,
    mainQueue: mainQueueName,
  };
}

async function replayParkingQueue(mainQueueName) {
  const { parkingQueue, retryQueue, mainQueue } = deriveQueues(mainQueueName);

  logger.log(`\n${'─'.repeat(60)}`);
  logger.log(`  Parking Queue Replayer`);
  logger.log(`${'─'.repeat(60)}`);
  logger.log(`  Parking queue : ${parkingQueue}`);
  logger.log(`  Retry queue   : ${retryQueue}`);
  logger.log(`  Main queue    : ${mainQueue}`);
  logger.log(`  Rate          : ${REPLAY_RATE_MS}ms between messages`);
  logger.log(`  Dry run       : ${DRY_RUN}`);
  logger.log(`${'─'.repeat(60)}\n`);

  let connection;
  let channel;

  try {
    connection = await amqp.connect(RABBITMQ_URL, { heartbeat: 30 });
    channel = await connection.createConfirmChannel();

    // Passively assert parking queue (must already exist; do not create here)
    let queueInfo;
    try {
      queueInfo = await channel.checkQueue(parkingQueue);
    } catch {
      logger.log(`Parking queue "${parkingQueue}" does not exist or is empty. Nothing to replay.\n`);
      await connection.close();
      return;
    }

    const totalMessages = queueInfo.messageCount;
    if (totalMessages === 0) {
      logger.log(`Parking queue "${parkingQueue}" is empty. Nothing to replay.\n`);
      await connection.close();
      return;
    }

    logger.log(`Found ${totalMessages} message(s) to replay.\n`);

    let replayed = 0;
    let skipped = 0;
    let failed = 0;

    await channel.prefetch(1);

    await new Promise((resolve) => {
      channel.consume(
        parkingQueue,
        async (msg) => {
          if (!msg) {
            // Consumer was cancelled
            resolve();
            return;
          }

          const headers = msg.properties.headers || {};
          const replayCount = Number(headers['x-dlq-replay-count'] || 0);
          const originalDlq = headers['x-original-dlq'] || 'unknown';
          const parkedAt = headers['x-dlq-parked-at'] || 'unknown';

          logger.log(
            `[${replayed + skipped + failed + 1}/${totalMessages}] ` +
              `replay_count=${replayCount} ` +
              `original_dlq=${originalDlq} ` +
              `parked_at=${parkedAt}`,
          );

          if (DRY_RUN) {
            logger.log(`  → DRY RUN: would replay to ${retryQueue}\n`);
            channel.nack(msg, false, true); // requeue, don't consume
            skipped++;
            if (replayed + skipped + failed >= totalMessages) {
              resolve();
            }
            return;
          }

          try {
            const freshHeaders = { ...headers };
            // Reset replay counter so dlqReplayConsumer gives it fresh attempts
            freshHeaders['x-retry-count'] = 0;
            freshHeaders['x-dlq-replay-count'] = 0;
            freshHeaders['x-parking-replayed-at'] = new Date().toISOString();
            delete freshHeaders['x-dlq-park-reason'];
            delete freshHeaders['x-dlq-parked-at'];

            channel.sendToQueue(retryQueue, msg.content, {
              persistent: true,
              contentType: msg.properties.contentType || 'application/json',
              contentEncoding: msg.properties.contentEncoding,
              correlationId: msg.properties.correlationId,
              messageId: msg.properties.messageId,
              timestamp: Date.now(),
              headers: freshHeaders,
            });

            await channel.waitForConfirms();
            channel.ack(msg);
            replayed++;
            logger.log(`  → Replayed to ${retryQueue}\n`);

            if (replayed + skipped + failed >= totalMessages) {
              resolve();
              return;
            }

            if (REPLAY_RATE_MS > 0) {
              await sleep(REPLAY_RATE_MS);
            }
          } catch (error) {
            logger.error(`  → Publish failed: ${error.message}\n`);
            channel.nack(msg, false, true);
            failed++;

            if (replayed + skipped + failed >= totalMessages) {
              resolve();
            }
          }
        },
        { noAck: false },
      );
    });

    logger.log(`${'─'.repeat(60)}`);
    logger.log(`  Done.`);
    logger.log(`  Replayed : ${replayed}`);
    if (DRY_RUN) {
      logger.log(`  Inspected: ${skipped} (dry run, not consumed)`);
    }
    if (failed > 0) {
      logger.log(`  Failed   : ${failed} (requeued to parking, check logs)`);
    }
    logger.log(`${'─'.repeat(60)}\n`);
  } finally {
    if (channel) {
      try {
        await channel.close();
      } catch {
        // no-op
      }
    }
    if (connection) {
      try {
        await connection.close();
      } catch {
        // no-op
      }
    }
  }
}

const mainQueueName = process.argv[2];

if (!mainQueueName) {
  logger.error(
    '\nUsage:\n' +
      '  node scripts/replayParkingQueue.js <main-queue-name>\n\n' +
      'Examples:\n' +
      '  node scripts/replayParkingQueue.js bank_response_queue\n' +
      '  node scripts/replayParkingQueue.js payin_process_queue\n' +
      '  DRY_RUN=true node scripts/replayParkingQueue.js bank_response_queue\n',
  );
  process.exit(1);
}

try {
  await replayParkingQueue(mainQueueName);
} catch (error) {
  logger.error('Fatal error:', error.message);
  process.exit(1);
}
