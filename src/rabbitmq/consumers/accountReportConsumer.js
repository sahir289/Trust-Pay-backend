import { logger } from '../../utils/logger.js';
import { rabbitMQConnectionManager } from '../connection.js';
import { assertQueueTopology, TOPOLOGY } from '../topology.js';
import { withRedisKeyLock } from '../utils/redisKeyedLock.js';
import { getClientsAccountReportService } from '../../apis/reports/reportsService.js';
import { generateFile } from '../../utils/genrate-xlsx-csv.js';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import config from '../../config/config.js';
import { v4 as uuidv4 } from 'uuid';
import { s3 } from '../../helpers/Aws.js';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { emitTableEntryAsync } from '../../utils/socket/sessionUtils.js';
import { tableName } from '../../constants/index.js';

// Initialize dayjs plugins
dayjs.extend(utc);
dayjs.extend(timezone);

// ---------- Helper: Upload buffer/stream to S3 ----------
const uploadToS3 = async (buffer, fileName, contentType) => {
  const key = `reports/${dayjs().format('YYYY-MM-DD')}/${fileName}`;
  const putCommand = new PutObjectCommand({
    Bucket: config.bucketName,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    ContentDisposition: `attachment; filename="${fileName}"`,
  });

  await s3.send(putCommand); 

  const getCommand = new GetObjectCommand({
    Bucket: config.bucketName,
    Key: key,
  });

  const signedUrl = await getSignedUrl(s3, getCommand, {
    expiresIn: 60 * 60 * 24, // 24 hours
  });

  return {
    key,
    url: signedUrl,
  };
};

const PREFETCH_COUNT = Number(process.env.PAYIN_PROCESS_PREFETCH || 20);
const MAX_RETRIES = Number(process.env.PAYIN_PROCESS_MAX_RETRIES || 3);

let channel = null;
let consumerTag = null;
let unsubscribeReconnect = null;
let stopping = false;

function getRetryCount(msg) {
  return Number(msg?.properties?.headers?.['x-retry-count'] || 0);
}

async function processAccountReportJob(messagePayload) {
  console.log(messagePayload, 'processAccountReportJob messagePayload');
  const payload = messagePayload;
  
  const result = await getClientsAccountReportService(payload);
  const fileType = payload?.fileType || 'csv';
  const role_name = payload?.role_name || 'all';
  if (!result || !Array.isArray(result) || result.length === 0) {
    return {
      success: true,
      message: 'No data found for the given filters',
      downloadUrl: null,
      totalRecords: 0,
      fileType,
    };
  }

  let buffer;
  let contentType;
  let extension;

  if (fileType === 'csv') {
    const csvContent = generateFile(result, 'csv');
    buffer = Buffer.from(csvContent, 'utf-8');
    contentType = 'text/csv';
    extension = 'csv';
  } 
  else if (fileType === 'xlsx') {
    buffer = generateFile(result, 'xlsx');
    contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    extension = 'xlsx';
  } 
  // else if (fileType === 'pdf') {
  //   buffer = await generatePDF(result);
  //   contentType = 'application/pdf';
  //   extension = 'pdf';
  // }

  const fileName = `client_account_report_${role_name || 'all'}_${dayjs().format(
    'YYYYMMDD_HHmmss',
  )}_${uuidv4().slice(0, 8)}.${extension}`;

  const { url, key } = await uploadToS3(buffer, fileName, contentType);

  logger.info(
    `Report uploaded to S3 | Type: ${fileType} | Key: ${key} | Records: ${result.length}`,
  );

  const responseObj = {
    success: true,
    message: 'Report generated successfully',
    downloadUrl: url,
    fileName,
    fileType,
    totalRecords: result.length,
    s3Key: key,
  }
  emitTableEntryAsync(tableName.ACCOUNT_REPORT, responseObj);

  logger.info(`Report generation completed | Type: ${fileType} | Records: ${result.length} | Download URL: ${url}`);

}

function getPayInLockKey(messagePayload) {
  return messagePayload?.code || null;
}

async function handleMessage(msg) {
  if (!msg || stopping) {
    return;
  }

  const retryCount = getRetryCount(msg);

  try {
    const payload = JSON.parse(msg.content.toString());
    const lockKey = getPayInLockKey(payload);

    await withRedisKeyLock('account-report-process', lockKey, () => processAccountReportJob(payload));
    channel.ack(msg);

    logger.info('[RabbitMQ][AccountReport] Message processed', {
      retryCount,
      code: payload?.code,
    });
  } catch (error) {
    logger.error('[RabbitMQ][AccountReport] Processing failed', {
      retryCount,
      error: error.message,
    });

    if (retryCount < MAX_RETRIES && channel) {
      const headers = msg.properties.headers
        ? { ...msg.properties.headers }
        : undefined;

      channel.sendToQueue(TOPOLOGY.accountReport.retryQueue, msg.content, {
        persistent: true,
        contentType: 'application/json',
        headers: {
          ...headers,
          'x-retry-count': retryCount + 1,
        },
      });
      channel.ack(msg);
      logger.warn('[RabbitMQ][AccountReport] Message scheduled for retry', {
        retryCount: retryCount + 1,
        retryQueue: TOPOLOGY.accountReport.retryQueue,
        retryDelayMs: TOPOLOGY.accountReport.retryDelayMs,
      });
      return;
    }

    if (channel) {
      channel.nack(msg, false, false);
    }
  }
}

async function subscribe() {
  channel = await rabbitMQConnectionManager.createChannel();
  await assertQueueTopology(channel, TOPOLOGY.accountReport);
  await channel.prefetch(PREFETCH_COUNT);

  const result = await channel.consume(TOPOLOGY.accountReport.queue, handleMessage, {
    noAck: false,
  });

  consumerTag = result.consumerTag;

  logger.info('[RabbitMQ][AccountReport] Consumer started', {
    queue: TOPOLOGY.accountReport.queue,
    prefetch: PREFETCH_COUNT,
  });
}

export async function startAccountReportConsumer() {
  stopping = false;
  await subscribe();

  if (!unsubscribeReconnect) {
    unsubscribeReconnect = rabbitMQConnectionManager.onReconnect(async () => {
      if (stopping) return;
      await subscribe();
    });
  }
}

export async function stopAccountReportConsumer() {
  stopping = true;

  if (unsubscribeReconnect) {
    unsubscribeReconnect();
    unsubscribeReconnect = null;
  }

  if (channel && consumerTag) {
    try {
      await channel.cancel(consumerTag);
    } catch {
      // no-op
    }
  }

  if (channel) {
    try {
      await channel.close();
    } catch {
      // no-op
    }
    channel = null;
    consumerTag = null;
  }

  logger.info('[RabbitMQ][AccountReport] Consumer stopped');
}
