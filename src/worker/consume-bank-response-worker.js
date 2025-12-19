import { connectRabbitMQ, getRabbitChannel } from '../utils/rabbitmq.js';
import config from '../config/config.js';
import { createBankResponseService } from '../apis/bankResponse/bankResponseServices.js';
import { logger } from '../utils/logger.js';
import chalk from 'chalk';

const MAIN_QUEUE = config.rabbitmq.bankResponseQueue;
const DLX = 'failed_bank_responses_dlx';
const DLQ = 'failed_bank_responses_dlq';

const MAX_RETRIES = 3;
const PREFETCH_COUNT = 5;

let channel;
let consumerTag;
let isShuttingDown = false;

/**
 * Setup RabbitMQ topology ONCE during startup
 */
async function setupTopology(ch) {
  try {
    await ch.assertExchange(DLX, 'direct', { durable: true });

    await ch.assertQueue(DLQ, { durable: true });
    await ch.bindQueue(DLQ, DLX, 'failed');

    await ch.assertQueue(MAIN_QUEUE, {
      durable: true,
      deadLetterExchange: DLX,
      deadLetterRoutingKey: 'failed',
    });

    ch.prefetch(PREFETCH_COUNT);

    logger.info(chalk.blueBright('RabbitMQ topology initialized'));
  } catch (err) {
    logger.error('Error setting up RabbitMQ topology', err);
    throw err;
  }
}

/**
 * Determine if error should be retried
 */
function isRetryAbleError(err) {
  const msg = err?.message || '';
  return (
    msg.includes('timeout') ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('ETIMEDOUT') ||
    msg.includes('deadlock') ||
    msg.includes('could not obtain lock')
  );
}

/**
 * Get retry count safely from headers
 */
function getRetryCount(msg) {
  return msg?.properties?.headers?.['x-retry-count'] || 0;
}

/**
 * Graceful shutdown handler
 */
export async function shutdownWorker(signal) {
  if (!channel) return;
  try {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.warn(`${signal}. RabbitMQ Worker Shutting down gracefully...`);

    if (consumerTag) {
      await channel.cancel(consumerTag);
      logger.info('Consumer cancelled');
    }

    // Allow in-flight handlers to complete
    // await new Promise((res) => setTimeout(res, 500));

    await channel.close();
    logger.info('RabbitMQ channel closed');
  } catch (err) {
    logger.error('Error during worker shutdown', err);
  }
}

/**
 * Start Bank Response Worker
 */
export async function startBankResponseWorker() {
  logger.info('Starting Bank Response Worker');
  try {
    await connectRabbitMQ();
    channel = await getRabbitChannel();
    await setupTopology(channel);
  } catch (err) {
    logger.error('Startup failed', err);
    throw err;
  }

  try {
    const consumeResult = await channel.consume(
      MAIN_QUEUE,
      async (msg) => {
        if (!msg || isShuttingDown) return;

        const retryCount = getRetryCount(msg);

        try {
          const data = JSON.parse(msg.content.toString());

          // Fail fast for bad messages
          if (!data?.payload || !data?.x_auth_token) {
            throw new Error('Invalid message payload');
          }

          logger.info('Processing bank response', {
            attempt: retryCount + 1,
            maxAttempts: MAX_RETRIES + 1,
          });

          await createBankResponseService(
            data.payload,
            data.x_auth_token,
            data.role,
            data.name,
          );

          channel.ack(msg);
          logger.info('Bank response processed successfully');
        } catch (err) {
          const retryAble = isRetryAbleError(err);

          logger.error('Processing failed', {
            error: err.message,
            retryCount,
            retryAble,
          });

          /**
           * RETRY PATH
           */
          if (retryAble && retryCount < MAX_RETRIES) {
            try {
              channel.sendToQueue(MAIN_QUEUE, Buffer.from(msg.content), {
                persistent: true,
                headers: {
                  ...msg.properties.headers,
                  'x-retry-count': retryCount + 1,
                },
              });

              channel.ack(msg);

              logger.warn('Message retried', {
                nextAttempt: retryCount + 2,
              });

              return;
            } catch (e) {
              logger.error('Error during retry delay', e);
            }
          }

          /**
           * FINAL FAILURE → DLQ
           */
          channel.nack(msg, false, false);

          logger.error('Message sent to DLQ', {
            retries: retryCount,
          });
        }
      },
      { noAck: false },
    );

    consumerTag = consumeResult.consumerTag;
  } catch (err) {
    logger.error('Error in worker', err);
    throw err;
  }

  logger.info('Waiting for messages...');
}

export const startBankResponseHandler = async () => {
  try {
    await startBankResponseWorker();
  } catch (err) {
    logger.error('Failed to start Bank Response Worker:', err);
  }
};
