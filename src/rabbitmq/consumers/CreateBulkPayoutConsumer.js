import XLSX from 'xlsx';
import pLimit from 'p-limit';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { logger } from '../../utils/logger.js';
import { rabbitMQConnectionManager } from '../connection.js';
import { assertQueueTopology, TOPOLOGY } from '../topology.js';
import { createPayoutService } from '../../apis/payOut/payOutService.js';
import config from '../../config/config.js';
import { s3 } from '../../helpers/Aws.js';
import { Role } from '../../constants/index.js';
import { getUserHierarchysDao } from '../../apis/userHierarchy/userHierarchyDao.js';

const PREFETCH_COUNT = Number(
  process.env.BULK_PAYOUT_CREATE_PREFETCH || 1,
);

const MAX_RETRIES = Number(
  process.env.BULK_PAYOUT_CREATE_MAX_RETRIES || 3,
);

const CONCURRENCY = Number(
  process.env.BULK_PAYOUT_CREATE_CONCURRENCY || 5,
);

let channel = null;
let consumerTag = null;
let unsubscribeReconnect = null;
let stopping = false;

function getRetryCount(msg) {
  return Number(msg?.properties?.headers?.['x-retry-count'] || 0);
}

const streamToBuffer = async (stream) => {
  const chunks = [];

  for await (const chunk of stream) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
};

async function processBulkPayoutCreate(payload) {
  const {
    fileKey,
    companyId,
    userId,
    role,
    designation,
    headers = {},
  } = payload;

  if (!fileKey) {
    throw new Error('fileKey is required');
  }
  if (!companyId || !userId || !role) {
    throw new Error('companyId, userId, and role are required');
  }
  let allowedMerchantUserIds = null;
  if (role === Role.MERCHANT) {
    allowedMerchantUserIds = [userId];
    if (designation === Role.MERCHANT_OPERATIONS) {
      const [userHierarchy] = await getUserHierarchysDao({ user_id: userId });
      const parentUserId = userHierarchy?.config?.parent;
      if (!parentUserId) {
        throw new Error('Merchant operations user is not assigned to a merchant.');
      }
      const [parentHierarchy] = await getUserHierarchysDao({
        user_id: parentUserId,
      });
      const subMerchantUserIds =
        parentHierarchy?.config?.siblings?.sub_merchants ?? [];
      allowedMerchantUserIds = [
        ...new Set([parentUserId, ...subMerchantUserIds]),
      ];
    } else if (designation === Role.MERCHANT || designation === Role.SUB_MERCHANT) {
      const [merchantHierarchy] = await getUserHierarchysDao({
        user_id: userId,
      });
      const subMerchantUserIds =
        merchantHierarchy?.config?.siblings?.sub_merchants ?? [];

      allowedMerchantUserIds = [
        ...new Set([userId, ...subMerchantUserIds]),
      ];
    }
  }
  const bulkAuthorization = { allowedMerchantUserIds };

  logger.info('[BulkPayoutCreate] Downloading file from S3', {
    fileKey,
  });

  const command = new GetObjectCommand({
    Bucket: config.bucketName,
    Key: fileKey,
  });

  const response = await s3.send(command);

  const fileBuffer = await streamToBuffer(
    response.Body,
  );

  const workbook = XLSX.read(fileBuffer, {
    type: 'buffer',
  });

  const sheetName = workbook.SheetNames[0];

  const rows = XLSX.utils.sheet_to_json(
    workbook.Sheets[sheetName],
  );

  logger.info('[BulkPayoutCreate] Excel parsed', {
    totalRows: rows.length,
    fileKey,
  });

  const limit = pLimit(CONCURRENCY);

  const results = await Promise.allSettled(
    rows.map((row) =>
      limit(async () => {
        row.company_id = companyId;
        row.created_by = userId;
        row.updated_by = userId;

        return createPayoutService(
          headers,
          row,
          role,
          true,
          bulkAuthorization,
        );
      }),
    ),
  );

  const successCount = results.filter(
    (r) => r.status === 'fulfilled',
  ).length;

  const failedCount = results.filter(
    (r) => r.status === 'rejected',
  ).length;

  logger.info('[BulkPayoutCreate] Processing completed', {
    total: rows.length,
    successCount,
    failedCount,
  });
}

async function handleMessage(msg) {
  if (!msg || stopping) {
    return;
  }

  const retryCount = getRetryCount(msg);

  try {
    const payload = JSON.parse(msg.content.toString());
    logger.info(
      '[RabbitMQ][BulkPayoutCreate] Message received',
      {
        retryCount,
      },
    );

    await processBulkPayoutCreate(payload);

    channel.ack(msg);

    logger.info(
      '[RabbitMQ][BulkPayoutCreate] Message processed',
      {
        retryCount,
      },
    );
  } catch (error) {
    logger.error(
      '[RabbitMQ][BulkPayoutCreate] Processing failed',
      {
        retryCount,
        error: error.message,
      },
    );

    if (retryCount < MAX_RETRIES && channel) {
      const headers = msg.properties.headers
        ? { ...msg.properties.headers }
        : undefined;

      channel.sendToQueue(
        TOPOLOGY.bulkPayoutCreate.retryQueue,
        msg.content,
        {
          persistent: true,
          contentType: 'application/json',
          headers: {
            ...headers,
            'x-retry-count': retryCount + 1,
          },
        },
      );

      channel.ack(msg);

      logger.warn(
        '[RabbitMQ][BulkPayoutCreate] Message scheduled for retry',
        {
          retryCount: retryCount + 1,
          retryQueue:
            TOPOLOGY.bulkPayoutCreate.retryQueue,
        },
      );

      return;
    }

    if (channel) {
      channel.nack(msg, false, false);
    }
  }
}

async function subscribe() {
  channel = await rabbitMQConnectionManager.createChannel();

  await assertQueueTopology(
    channel,
    TOPOLOGY.bulkPayoutCreate,
  );

  await channel.prefetch(PREFETCH_COUNT);

  const result = await channel.consume(
    TOPOLOGY.bulkPayoutCreate.queue,
    handleMessage,
    {
      noAck: false,
    },
  );

  consumerTag = result.consumerTag;

  logger.info(
    '[RabbitMQ][BulkPayoutCreate] Consumer started',
    {
      queue: TOPOLOGY.bulkPayoutCreate.queue,
      prefetch: PREFETCH_COUNT,
    },
  );
}

export async function startBulkPayoutCreateConsumer() {
  stopping = false;

  await subscribe();

  if (!unsubscribeReconnect) {
    unsubscribeReconnect =
      rabbitMQConnectionManager.onReconnect(
        async () => {
          if (stopping) return;

          await subscribe();
        },
      );
  }
}

export async function stopBulkPayoutCreateConsumer() {
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

  logger.info(
    '[RabbitMQ][BulkPayoutCreate] Consumer stopped',
  );
}