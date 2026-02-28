process.env.LOG_INGESTOR = 'true';

import amqp from 'amqplib';
import Redis from 'ioredis';
import winston from 'winston';
import CloudWatchTransport from 'winston-cloudwatch';
import config from '../config/config.js';

const QUEUE_NAME = process.env.LOG_INGESTOR_QUEUE || 'trust-pay-central-logs';
const DEDUPE_TTL_SECONDS = parseInt(process.env.LOG_DEDUPE_TTL_SECONDS || '300', 10);

let connection;
let channel;

const redis = new Redis(config.redis?.url || 'redis://localhost:6379');

const hasAwsConfig =
  config.aws?.cloudWatchLogGroup &&
  config.aws?.region &&
  config.aws?.accessKeyId &&
  config.aws?.secretAccessKey;

const cloudWatchLogger = hasAwsConfig
  ? winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.json(),
      ),
      transports: [
        new CloudWatchTransport({
          logGroupName: config.aws.cloudWatchLogGroup,
          logStreamName: `ingestor-${new Date().toISOString().split('T')[0]}`,
          awsRegion: config.aws.region,
          awsAccessKeyId: config.aws.accessKeyId,
          awsSecretAccessKey: config.aws.secretAccessKey,
          retentionInDays: 30,
          jsonMessage: true,
          createLogGroup: true,
          createLogStream: true,
          uploadRate: 2000,
        }),
      ],
    })
  : null;

const writeToSink = (event) => {
  if (cloudWatchLogger) {
    cloudWatchLogger.log(event.level || 'info', event.message || 'log-event', {
      ...event,
      ingested_at: new Date().toISOString(),
    });
    return;
  }

  // fallback sink if CloudWatch is not configured
  const msg = JSON.stringify({ ...event, ingested_at: new Date().toISOString() });
  console.log(`[LOG-INGESTOR] ${msg}`);
};

const isDuplicate = async (dedupeKey) => {
  if (!dedupeKey) return false;

  const redisKey = `log-dedupe:${dedupeKey}`;
  const result = await redis.set(redisKey, '1', 'EX', DEDUPE_TTL_SECONDS, 'NX');
  return result !== 'OK';
};

const processMessage = async (msg) => {
  if (!msg) return;

  const raw = msg.content.toString();
  const event = JSON.parse(raw);

  const duplicate = await isDuplicate(event.dedupeKey);
  if (duplicate) {
    channel.ack(msg);
    return;
  }

  writeToSink(event);
  channel.ack(msg);
};

const connect = async () => {
  connection = await amqp.connect(config.rabbitmq.url, {
    heartbeat: config.rabbitmq?.heartbeat || 60,
    connection_timeout: config.rabbitmq?.connectionTimeout || 10000,
  });
  channel = await connection.createChannel();

  await channel.assertQueue(QUEUE_NAME, { durable: true });
  await channel.prefetch(100);

  await channel.consume(
    QUEUE_NAME,
    async (msg) => {
      try {
        await processMessage(msg);
      } catch (error) {
        console.error('[LOG-INGESTOR] message processing failed:', error.message);
        if (msg) channel.nack(msg, false, true);
      }
    },
    { noAck: false },
  );

  console.log(`[LOG-INGESTOR] consuming queue=${QUEUE_NAME}, dedupe_ttl=${DEDUPE_TTL_SECONDS}s`);
};

let shuttingDown = false;
const gracefulShutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`[LOG-INGESTOR] received ${signal}, shutting down...`);

  try {
    if (channel) await channel.close();
    if (connection) await connection.close();
    await redis.quit();
  } catch (error) {
    console.error('[LOG-INGESTOR] shutdown error:', error.message);
  } finally {
    process.exit(0);
  }
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

connect().catch((error) => {
  console.error('[LOG-INGESTOR] startup failed:', error);
  process.exit(1);
});
