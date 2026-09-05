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
import { generatePDFBuffer } from '../../utils/generatePdf.js';

// Initialize dayjs plugins
dayjs.extend(utc);
dayjs.extend(timezone);

const getAccountReportColumns = (role_name) => {
  const isMerchant = role_name === 'MERCHANT';

  const columns = [
    { header: 'Date',                     key: 'created_at',                            width: 110, format: 'date' },
    {
      header: isMerchant ? 'Merchant Code' : 'Vendor Code',
      key: 'code',
      width: 80,
    },
    { header: 'G-Master Code',            key: 'gm_code',                               width: 70 },
    { header: 'PayIn Amount',             key: 'total_payin_amount',                    width: 85,  format: 'currency', align: 'right' },
    { header: 'PayIn Commission',         key: 'total_payin_commission',                width: 85,  format: 'currency', align: 'right' },
    { header: 'PayIn Count',              key: 'total_payin_count',                     width: 80,  align: 'right' },
    { header: 'PayOut Amount',            key: 'total_payout_amount',                   width: 85,  format: 'currency', align: 'right' },
    { header: 'PayOut Commission',        key: 'total_payout_commission',               width: 85,  format: 'currency', align: 'right' },
    { header: 'PayOut Count',             key: 'total_payout_count',                    width: 85,  align: 'right' },
    { header: 'Settlement Amount',        key: 'total_settlement_amount',               width: 85,  format: 'currency', align: 'right' },
    { header: 'Aed Sent Settlement',      key: 'total_aed_sent_settlement_amount',      width: 90,  format: 'currency', align: 'right' },
    { header: 'Bank Sent Settlement',     key: 'total_bank_sent_settlement_amount',     width: 90,  format: 'currency', align: 'right' },
    { header: 'Cash Sent Settlement',     key: 'total_cash_sent_settlement_amount',     width: 90,  format: 'currency', align: 'right' },
    { header: 'Crypto Sent Settlement',   key: 'total_crypto_sent_settlement_amount',   width: 95,  format: 'currency', align: 'right' },
    { header: 'Aed Recieved Settlement',  key: 'total_aed_received_settlement_amount',  width: 95,  format: 'currency', align: 'right' },
  ];

  // Vendor only columns
  if (!isMerchant) {
    columns.push(
      { header: 'Internal Qr Settlement',   key: 'total_internal_settlement_amount',      width: 100, format: 'currency', align: 'right' },
      { header: 'Internal Bank Settlement', key: 'total_internal_bank_settlement_amount', width: 110, format: 'currency', align: 'right' },
    );
  }

  // Common ending columns
  columns.push(
    { header: 'Chargeback Amount',          key: 'total_chargeback_amount',             width: 90,  format: 'currency', align: 'right' },
    { header: 'Reverse Payout Amount',      key: 'total_reverse_payout_amount',         width: 95,  format: 'currency', align: 'right' },
    { header: 'Reverse Payout Commission',  key: 'total_reverse_payout_commission',     width: 110, format: 'currency', align: 'right' },
    { header: 'Reverse Payout Count',       key: 'total_reverse_payout_count',          width: 95,  align: 'right' },
    { header: 'Adjustment Amount',          key: 'total_adjustment_amount',             width: 95,  format: 'currency', align: 'right' },
    { header: 'Current Balance',            key: 'current_balance',                     width: 90,  format: 'currency', align: 'right' },
    { header: 'Net Balance',                key: 'net_balance',                         width: 85,  format: 'currency', align: 'right' },
  );

  return columns;
};

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
  const payload = messagePayload;
  
  const result = await getClientsAccountReportService(payload);
  const fileType = payload?.fileType || 'csv';
  const role_name = payload?.role_name || 'all';
  if (!result || !Array.isArray(result) || result.length === 0) {
    const responseObj = {
      userId: payload?.userId || null,
      success: false,
      message: 'No data found for the given filters',
      downloadUrl: null,
      totalRecords: 0,
      fileType,
    }
    emitTableEntryAsync(tableName.ACCOUNT_REPORT, responseObj);
    logger.info(`Account Report generation completed | Type: ${fileType} | Records: 0 | No data found for the given filters`);
    return;
  }

  let buffer;
  let contentType;
  let extension;

  const columns = getAccountReportColumns(role_name);

  if (fileType === 'csv') {
    const csvContent = generateFile(result, 'csv', columns);
    buffer = Buffer.from(csvContent, 'utf-8');
    contentType = 'text/csv';
    extension = 'csv';
  } 
  else if (fileType === 'xlsx') {
    buffer = generateFile(result, 'xlsx', columns);
    contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    extension = 'xlsx';
  } 
  else if (fileType === 'pdf') {
  
    buffer = await generatePDFBuffer(result, {
      title: 'Account Report',
      columns,
    });
    contentType = 'application/pdf';
    extension = 'pdf';
  }

  const fileName = `client_account_report_${role_name || 'all'}_${dayjs().format(
    'YYYYMMDD_HHmmss',
  )}_${uuidv4().slice(0, 8)}.${extension}`;

  const { url, key } = await uploadToS3(buffer, fileName, contentType);

  logger.info(
    `Report uploaded to S3 | Type: ${fileType} | Key: ${key} | Records: ${result.length}`,
  );

  const responseObj = {
    userId: payload?.userId || null,
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
