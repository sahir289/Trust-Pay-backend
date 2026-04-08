import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import {
  CloudWatchLogsClient,
  CreateLogGroupCommand,
  CreateLogStreamCommand,
  PutLogEventsCommand,
} from '@aws-sdk/client-cloudwatch-logs';
import { formatLocalTimestamp, getDateStamp, safeJsonParse } from './logShared.js';
import config from '../config/config.js';

const LOG_DIR = process.env.LOG_DIR || 'logs';
const STATE_FILE = process.env.CW_STATE_FILE || path.join(LOG_DIR, '.cw-forwarder-state.json');
const POLL_INTERVAL_MS = Number.parseInt(process.env.CW_POLL_INTERVAL_MS || '1000', 10);
const LOG_LEVEL = String(process.env.CW_LOG_LEVEL || 'info').toLowerCase();
const STREAM_NAME =
  process.env.CW_LOG_STREAM_NAME || process.env.CW_STREAM_PREFIX || 'trust-pay-api-logs';
const START_POSITION = String(process.env.CW_START_POSITION || 'beginning').toLowerCase();
const DLQ_PREFIX = process.env.CW_DLQ_PREFIX || 'cw-dlq';
const ERROR_THROTTLE_MS = Number.parseInt(process.env.CW_ERROR_THROTTLE_MS || '15000', 10);
const DLQ_REPLAY_INTERVAL_MS = Number.parseInt(process.env.CW_DLQ_REPLAY_INTERVAL_MS || '60000', 10);
const DISCOVERY_INTERVAL_MS = Number.parseInt(process.env.CW_DISCOVERY_INTERVAL_MS || '10000', 10);
const MAX_FILES_PER_TICK = Number.parseInt(process.env.CW_MAX_FILES_PER_TICK || '3', 10);
const MAX_BYTES_PER_TICK = Number.parseInt(process.env.CW_MAX_BYTES_PER_TICK || `${2 * 1024 * 1024}`, 10);
const PUT_RETRY_ATTEMPTS = Number.parseInt(process.env.CW_PUT_RETRY_ATTEMPTS || '5', 10);
const PUT_RETRY_BASE_MS = Number.parseInt(process.env.CW_PUT_RETRY_BASE_MS || '1000', 10);
const MAX_EVENT_MSG_SIZE_BYTES = 256000;
const MAX_BATCH_SIZE_BYTES = 1000000;
const BASE_EVENT_SIZE_BYTES = 26;
const LOG_FILE_PATTERN = /^\d{4}-\d{2}-\d{2}\.log$/u;

const awsRegion = config.aws.region;
const awsAccessKeyId = config.aws.accessKeyId;
const awsSecretAccessKey = config.aws.secretAccessKey;
const logGroupName = config.aws.cloudWatchLogGroup;

const cloudWatchLogsClient = new CloudWatchLogsClient({
  region: awsRegion,
  credentials: {
    accessKeyId: awsAccessKeyId,
    secretAccessKey: awsSecretAccessKey,
  },
});

if (!awsRegion || !awsAccessKeyId || !awsSecretAccessKey || !logGroupName) {
  process.stderr.write(
    '[CW Forwarder] Missing AWS config values. Required: aws.region, aws.accessKeyId, aws.secretAccessKey, aws.cloudWatchLogGroup\n',
  );
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isAlreadyExistsError = (error) => {
  const name = error?.name || '';
  const message = error?.message || '';
  return (
    name === 'ResourceAlreadyExistsException' ||
    name === 'ResourceAlreadyExists' ||
    message.includes('already exists')
  );
};

const isRetryablePutError = (error) => {
  const name = error?.name || '';
  const message = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '').toLowerCase();

  return (
    error?.$retryable != null ||
    [
      'ServiceUnavailableException',
      'OperationAbortedException',
      'ThrottlingException',
      'LimitExceededException',
      'InternalFailure',
      'InternalServerException',
      'TimeoutError',
      'NetworkingError',
      'InvalidSequenceTokenException',
      'DataAlreadyAcceptedException',
    ].includes(name) ||
    ['etimedout', 'econnreset', 'enotfound', 'eai_again'].includes(code) ||
    message.includes('timeout') ||
    message.includes('socket hang up') ||
    message.includes('throttle') ||
    message.includes('rate exceeded') ||
    message.includes('network')
  );
};

const isResourceMissingError = (error) => {
  const name = error?.name || '';
  return name === 'ResourceNotFoundException' || name === 'ResourceNotFound';
};

const normalizeTimestamp = (value, fallback = Date.now()) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 1_000_000_000_000 ? value * 1000 : value;
  }

  if (typeof value === 'string' && value.trim()) {
    const normalized = value.includes('T') ? value : value.replace(' ', 'T');
    const parsed = Date.parse(normalized);
    if (Number.isFinite(parsed)) return parsed;
  }

  return fallback;
};

const truncateUtf8 = (value, maxBytes) => {
  const buffer = Buffer.from(value, 'utf8');
  if (buffer.length <= maxBytes) return value;

  let truncated = buffer.subarray(0, maxBytes).toString('utf8');
  while (Buffer.byteLength(truncated, 'utf8') > maxBytes && truncated.length > 0) {
    truncated = truncated.slice(0, -1);
  }
  return truncated;
};

const normalizeLogMessage = (rawLine) => {
  const line = String(rawLine);
  const bytes = Buffer.byteLength(line, 'utf8');
  if (bytes <= MAX_EVENT_MSG_SIZE_BYTES) return line;

  const suffix = ' ... [truncated for CloudWatch size limit]';
  const truncated = truncateUtf8(line, MAX_EVENT_MSG_SIZE_BYTES - Buffer.byteLength(suffix, 'utf8'));
  return `${truncated}${suffix}`;
};

const buildLogEvent = (rawLine, fallbackTimeMs = Date.now()) => {
  const parsed = safeJsonParse(rawLine);
  const timestamp = normalizeTimestamp(parsed?.time || parsed?.timestamp, fallbackTimeMs);
  return {
    message: normalizeLogMessage(rawLine),
    timestamp,
  };
};

const buildBatches = (events) => {
  const batches = [];
  let currentBatch = [];
  let currentBytes = 0;

  for (const event of events) {
    const eventBytes = Buffer.byteLength(event.message, 'utf8') + BASE_EVENT_SIZE_BYTES;
    if (currentBatch.length > 0 && currentBytes + eventBytes > MAX_BATCH_SIZE_BYTES) {
      batches.push(currentBatch);
      currentBatch = [];
      currentBytes = 0;
    }

    currentBatch.push(event);
    currentBytes += eventBytes;
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
};

const readBufferRange = async (filePath, start, end) => {
  const chunks = [];
  const stream = fs.createReadStream(filePath, { start, end });

  for await (const chunk of stream) {
    chunks.push(chunk);
  }

  return chunks.length === 1 ? chunks[0] : Buffer.concat(chunks);
};

const getDlqPath = (date = new Date()) => path.join(LOG_DIR, `${DLQ_PREFIX}-${getDateStamp(date)}.log`);
const getCurrentLogFileName = (date = new Date()) => `${getDateStamp(date)}.log`;

const normalizeState = (state) => {
  const normalized = { version: 2, files: {} };
  if (!state || typeof state !== 'object') return normalized;

  if (state.files && typeof state.files === 'object') {
    for (const [fileName, fileState] of Object.entries(state.files)) {
      const offset = fileState?.offset;
      if (LOG_FILE_PATTERN.test(fileName) && Number.isFinite(offset) && offset >= 0) {
        normalized.files[fileName] = {
          offset,
          updatedAt: fileState?.updatedAt || formatLocalTimestamp(),
        };
      }
    }
    return normalized;
  }

  for (const [key, value] of Object.entries(state)) {
    if (!/^\d{4}-\d{2}-\d{2}$/u.test(key)) continue;
    const offset = value?.offset;
    if (Number.isFinite(offset) && offset >= 0) {
      normalized.files[`${key}.log`] = {
        offset,
        updatedAt: value?.updatedAt || formatLocalTimestamp(),
      };
    }
  }

  return normalized;
};

class CloudWatchStreamForwarder {
  #running = false;
  #state = { version: 2, files: {} };
  #lastErrorSignature = '';
  #lastErrorAt = 0;
  #ensureStreamPromise = null;
  #knownFiles = [];
  #nextDiscoveryAt = 0;

  async init() {
    await fsp.mkdir(LOG_DIR, { recursive: true });
    await this.#loadState();
    await this.#ensureCloudWatchDestination();
    process.stdout.write(`[CW Forwarder] Active stream: ${STREAM_NAME}\n`);
    await this.#replayDLQ().catch((err) =>
      process.stderr.write(
        `[CW Forwarder] DLQ startup replay failed: ${err?.message || 'unknown'}\n`,
      ),
    );
  }

  async #loadState() {
    const text = await fsp.readFile(STATE_FILE, 'utf8').catch(() => null);
    if (!text) {
      this.#state = { version: 2, files: {} };
      return;
    }

    const parsed = safeJsonParse(text);
    this.#state = normalizeState(parsed);
  }

  async #saveState() {
    await fsp.writeFile(STATE_FILE, JSON.stringify(this.#state), 'utf8').catch(() => {});
  }

  #reportError(context, error) {
    const message = error?.message || 'unknown';
    const signature = `${context}:${message}`;
    const now = Date.now();
    if (signature !== this.#lastErrorSignature || now - this.#lastErrorAt >= ERROR_THROTTLE_MS) {
      this.#lastErrorSignature = signature;
      this.#lastErrorAt = now;
      process.stderr.write(`[CW Forwarder] ${context}: ${message}\n`);
    }
  }

  async #ensureCloudWatchDestination() {
    if (this.#ensureStreamPromise) {
      await this.#ensureStreamPromise;
      return;
    }

    this.#ensureStreamPromise = (async () => {
      try {
        try {
          await cloudWatchLogsClient.send(new CreateLogGroupCommand({ logGroupName }));
        } catch (error) {
          if (!isAlreadyExistsError(error)) throw error;
        }

        try {
          await cloudWatchLogsClient.send(
            new CreateLogStreamCommand({
              logGroupName,
              logStreamName: STREAM_NAME,
            }),
          );
        } catch (error) {
          if (!isAlreadyExistsError(error)) throw error;
        }
      } finally {
        this.#ensureStreamPromise = null;
      }
    })();

    await this.#ensureStreamPromise;
  }

  async #putEventsBatch(events, attempt = 1) {
    try {
      const response = await cloudWatchLogsClient.send(
        new PutLogEventsCommand({
          logGroupName,
          logStreamName: STREAM_NAME,
          logEvents: events,
        }),
      );

      const rejected = response?.rejectedLogEventsInfo;
      if (rejected && Object.values(rejected).some((value) => value != null)) {
        throw new Error(`CloudWatch rejected some log events: ${JSON.stringify(rejected)}`);
      }

      return;
    } catch (error) {
      if (isResourceMissingError(error)) {
        await this.#ensureCloudWatchDestination();
      }

      if (attempt < PUT_RETRY_ATTEMPTS && (isRetryablePutError(error) || isResourceMissingError(error))) {
        await sleep(PUT_RETRY_BASE_MS * 2 ** (attempt - 1));
        return this.#putEventsBatch(events, attempt + 1);
      }

      throw error;
    }
  }

  async #writeDLQBatch(rawLines, reason, meta = {}) {
    if (!Array.isArray(rawLines) || rawLines.length === 0) return true;

    const entries = rawLines
      .map((logLine) =>
        JSON.stringify({
          timestamp: formatLocalTimestamp(),
          reason,
          streamName: STREAM_NAME,
          ...meta,
          logLine,
        }),
      )
      .join('\n');

    try {
      await fsp.appendFile(getDlqPath(), `${entries}\n`, 'utf8');
      return true;
    } catch (error) {
      this.#reportError('DLQ append failed', error);
      return false;
    }
  }

  async #sendLines(rawLines, sourceFile, options = {}) {
    const { writeToDlq = true } = options;
    const lines = Array.isArray(rawLines) ? rawLines.filter(Boolean) : [];
    if (lines.length === 0) return true;

    const events = lines
      .map((line, index) => buildLogEvent(line, Date.now() + index))
      .sort((left, right) => left.timestamp - right.timestamp);

    try {
      await this.#ensureCloudWatchDestination();
      const batches = buildBatches(events);
      for (const batch of batches) {
        await this.#putEventsBatch(batch);
      }
      return true;
    } catch (error) {
      this.#reportError(`PutLogEvents [${sourceFile}]`, error);
      const persistedToDlq =
        !writeToDlq ||
        (await this.#writeDLQBatch(lines, 'put-log-events-failed', {
          sourceFile,
          error: error?.message || 'unknown',
        }));

      if (!persistedToDlq) {
        throw error;
      }

      return false;
    }
  }

  async #listLogFiles() {
    const now = Date.now();
    if (now >= this.#nextDiscoveryAt || this.#knownFiles.length === 0) {
      const files = await fsp.readdir(LOG_DIR).catch(() => []);
      this.#knownFiles = files.filter((fileName) => LOG_FILE_PATTERN.test(fileName)).sort();
      this.#nextDiscoveryAt = now + DISCOVERY_INTERVAL_MS;
    }

    const currentFile = getCurrentLogFileName();
    return [...this.#knownFiles].sort((left, right) => {
      if (left === currentFile && right !== currentFile) return -1;
      if (right === currentFile && left !== currentFile) return 1;
      return left.localeCompare(right);
    });
  }

  #getSavedOffset(fileName, currentSize) {
    const offset = this.#state?.files?.[fileName]?.offset;
    if (Number.isFinite(offset) && offset >= 0) return offset;
    return START_POSITION === 'end' ? currentSize : 0;
  }

  async #processFile(fileName) {
    const filePath = path.join(LOG_DIR, fileName);
    const stats = await fsp.stat(filePath).catch(() => null);
    if (!stats?.isFile()) return 0;

    let offset = this.#getSavedOffset(fileName, stats.size);
    if (stats.size < offset) {
      offset = 0;
    }

    if (stats.size <= offset) return 0;

    const deltaBuffer = await readBufferRange(filePath, offset, stats.size - 1);
    if (!deltaBuffer?.length) return 0;

    const lastNewlineIndex = deltaBuffer.lastIndexOf(0x0a);
    if (lastNewlineIndex === -1) return 0;

    const completeBuffer = deltaBuffer.subarray(0, lastNewlineIndex + 1);
    const targetOffset = offset + completeBuffer.length;
    const lines = completeBuffer
      .toString('utf8')
      .split('\n')
      .map((line) => (line.endsWith('\r') ? line.slice(0, -1) : line))
      .filter((line) => line.length > 0);

    if (lines.length === 0) {
      this.#state.files[fileName] = { offset: targetOffset, updatedAt: formatLocalTimestamp() };
      await this.#saveState();
      return completeBuffer.length;
    }

    await this.#sendLines(lines, fileName);
    this.#state.files[fileName] = { offset: targetOffset, updatedAt: formatLocalTimestamp() };
    await this.#saveState();
    return completeBuffer.length;
  }

  async #replayDLQ() {
    const files = await fsp.readdir(LOG_DIR).catch(() => []);
    const dlqFiles = files
      .filter((fileName) => fileName.startsWith(`${DLQ_PREFIX}-`) && fileName.endsWith('.log'))
      .sort();

    if (dlqFiles.length === 0) return;
    process.stdout.write(`[CW Forwarder] Replaying ${dlqFiles.length} DLQ file(s)...\n`);

    for (const fileName of dlqFiles) {
      const filePath = path.join(LOG_DIR, fileName);
      const content = await fsp.readFile(filePath, 'utf8').catch(() => null);
      if (!content?.trim()) {
        await fsp.unlink(filePath).catch(() => {});
        continue;
      }

      const entries = content
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => safeJsonParse(line))
        .filter((entry) => entry?.logLine);

      if (entries.length === 0) {
        await fsp.unlink(filePath).catch(() => {});
        continue;
      }

      const logLines = entries.map((entry) => entry.logLine);

      try {
        const delivered = await this.#sendLines(logLines, `DLQ:${fileName}`, { writeToDlq: false });
        if (delivered) {
          await fsp.unlink(filePath).catch(() => {});
          process.stdout.write(`[CW Forwarder] DLQ replayed and removed: ${fileName}\n`);
        }
      } catch (error) {
        this.#reportError(`DLQ replay [${fileName}]`, error);
      }
    }
  }

  async start() {
    this.#running = true;
    process.stdout.write(`[CW Forwarder] Starting at level ${LOG_LEVEL}\n`);

    let nextDLQReplay = Date.now() + DLQ_REPLAY_INTERVAL_MS;

    while (this.#running) {
      try {
        const files = await this.#listLogFiles();
        let processedFiles = 0;
        let processedBytes = 0;

        for (const fileName of files) {
          if (processedFiles >= MAX_FILES_PER_TICK || processedBytes >= MAX_BYTES_PER_TICK) {
            break;
          }

          const bytesRead = await this.#processFile(fileName);
          if (bytesRead > 0) {
            processedFiles += 1;
            processedBytes += bytesRead;
          }
        }
      } catch (error) {
        process.stderr.write(`[CW Forwarder] Loop error: ${error?.message || 'unknown'}\n`);
      }

      if (Date.now() >= nextDLQReplay) {
        nextDLQReplay = Date.now() + DLQ_REPLAY_INTERVAL_MS;
        this.#replayDLQ().catch((error) =>
          process.stderr.write(
            `[CW Forwarder] Periodic DLQ replay error: ${error?.message || 'unknown'}\n`,
          ),
        );
      }

      await sleep(POLL_INTERVAL_MS);
    }
  }

  async stop() {
    this.#running = false;
    await this.#saveState();
    process.stdout.write('[CW Forwarder] Stopped\n');
  }
}

const forwarder = new CloudWatchStreamForwarder();
await forwarder.init();

let shuttingDown = false;
const shutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  process.stdout.write(`[CW Forwarder] ${signal} received\n`);
  await forwarder.stop();
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

try {
  await forwarder.start();
} catch (error) {
  process.stderr.write(`[CW Forwarder] Fatal error: ${error?.message || 'unknown'}\n`);
  await forwarder.stop();
  process.exit(1);
}
