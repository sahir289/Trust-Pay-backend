import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import CloudWatchTransport from 'winston-cloudwatch';
import {
  CloudWatchLogsClient,
  CreateLogGroupCommand,
  CreateLogStreamCommand,
} from '@aws-sdk/client-cloudwatch-logs';
import {
  formatLocalTimestamp,
  getDateStamp,
  getDailyLogFilePath,
  safeJsonParse,
} from './logShared.js';
import config from '../config/config.js';

const LOG_DIR = process.env.LOG_DIR || 'logs';
const STATE_FILE = process.env.CW_STATE_FILE || path.join(LOG_DIR, '.cw-forwarder-state.json');
const POLL_INTERVAL_MS = Number.parseInt(process.env.CW_POLL_INTERVAL_MS || '1000', 10);
const LOG_LEVEL = process.env.CW_LOG_LEVEL || 'info';
const STREAM_PREFIX = process.env.CW_STREAM_PREFIX || '';
const STREAM_NAME =
  process.env.CW_LOG_STREAM_NAME ||
  process.env.CW_STREAM_NAME ||
  `${STREAM_PREFIX}app-stream`;
const START_POSITION = String(process.env.CW_START_POSITION || 'beginning').toLowerCase();
// Dead-letter queue: lines that failed transport delivery are stored here for auto-replay.
const DLQ_PREFIX = process.env.CW_DLQ_PREFIX || 'cw-dlq';
const ERROR_THROTTLE_MS = Number.parseInt(process.env.CW_ERROR_THROTTLE_MS || '15000', 10);
const RECENT_ATTEMPT_WINDOW_MS = Number.parseInt(
  process.env.CW_RECENT_ATTEMPT_WINDOW_MS || '90000',
  10,
);
// How often to attempt replaying any accumulated DLQ files (default every 60 s).
const DLQ_REPLAY_INTERVAL_MS = Number.parseInt(process.env.CW_DLQ_REPLAY_INTERVAL_MS || '60000', 10);

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

const getCurrentFilePath = (date = new Date()) => getDailyLogFilePath(LOG_DIR, date);

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

const ensureCloudWatchStream = async (streamName, reportError) => {
  try {
    await cloudWatchLogsClient.send(new CreateLogGroupCommand({ logGroupName }));
  } catch (error) {
    if (!isAlreadyExistsError(error)) {
      reportError('CreateLogGroup', error);
    }
  }

  try {
    await cloudWatchLogsClient.send(
      new CreateLogStreamCommand({
        logGroupName,
        logStreamName: streamName,
      }),
    );
  } catch (error) {
    if (!isAlreadyExistsError(error)) {
      reportError(`CreateLogStream [${streamName}]`, error);
    }
  }
};

/**
 * Build a winston-cloudwatch transport for a given stream name.
 * Callers that create a temporary transport for DLQ replay must call closeTransport() on it.
 */
const buildTransport = (streamName, errorHandler) =>
  new CloudWatchTransport({
    logGroupName,
    logStreamName: streamName,
    awsRegion,
    awsAccessKeyId,
    awsSecretAccessKey,
    jsonMessage: true,
    createLogGroup: true,
    createLogStream: true,
    uploadRate: 2000,
    level: LOG_LEVEL,
    retentionInDays: 30,
    errorHandler,
  });

/** Gracefully drain all in-flight logs and close transport. */
const closeTransport = (transport) =>
  new Promise((resolve) => {
    if (!transport) {
      resolve();
      return;
    }
    transport.kthxbye?.(() => resolve());
    setTimeout(resolve, 8000);
  });

/**
 * Build the uniform info object that winston-cloudwatch expects.
 * Always preserves the original timestamp so CloudWatch date stream is accurate.
 */
const buildInfo = (rawLine) => {
  const parsed = safeJsonParse(rawLine);
  if (parsed && typeof parsed === 'object') {
    return {
      level: parsed.level || 'info',
      message: parsed.msg || 'log',
      timestamp: parsed.time || parsed.timestamp || formatLocalTimestamp(),
      metadata: parsed,
    };
  }
  return { level: 'info', message: rawLine, timestamp: formatLocalTimestamp() };
};

class CloudWatchDailyForwarder {
  #transport = null;
  #activeDate = null;
  #offset = 0;
  #partialLine = '';
  #running = false;
  #state = {};
  #lastErrorSignature = '';
  #lastErrorAt = 0;
  #recentAttempts = new Map();

  async init() {
    await fsp.mkdir(LOG_DIR, { recursive: true });
    await this.#loadState();
    await this.#rolloverIfNeeded();
    // Replay any DLQ files left over from previous crashes / CW outages.
    await this.#replayDLQ().catch((err) =>
      process.stderr.write(
        `[CW Forwarder] DLQ startup replay failed: ${err?.message || 'unknown'}\n`,
      ),
    );
  }

  async #loadState() {
    const text = await fsp.readFile(STATE_FILE, 'utf8').catch(() => null);
    if (!text) return;
    const parsed = safeJsonParse(text);
    if (parsed && typeof parsed === 'object') this.#state = parsed;
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
  #buildFingerprint(rawLine, dateStr) {
    return `${dateStr}:${rawLine}`;
  }
  #pruneRecent(map, now = Date.now()) {
    for (const [fingerprint, expiry] of map.entries()) {
      if (expiry <= now) {
        map.delete(fingerprint);
      }
    }
  }
  #markRecentAttempt(fingerprint, now = Date.now()) {
    this.#pruneRecent(this.#recentAttempts, now);
    this.#recentAttempts.set(fingerprint, now + RECENT_ATTEMPT_WINDOW_MS);
  }
  #wasRecentlyAttempted(fingerprint, now = Date.now()) {
    this.#pruneRecent(this.#recentAttempts, now);
    return (this.#recentAttempts.get(fingerprint) || 0) > now;
  }
  /**
   * Append a raw log line that failed CloudWatch delivery into the dead-letter queue file for
   * its original date. The `date` field ensures replay targets the correct CW stream.
   */
  async #writeDLQ(rawLine, reason, dateStr) {
    const dlqPath = path.join(LOG_DIR, `${DLQ_PREFIX}-${dateStr}.log`);
    const entry = JSON.stringify({
      timestamp: formatLocalTimestamp(),
      reason,
      date: dateStr,
      logLine: rawLine,
    });
    await fsp.appendFile(dlqPath, `${entry}\n`, 'utf8').catch(() => {});
  }

  async #rolloverIfNeeded(now = new Date()) {
    const dateStr = getDateStamp(now);
    const isFirstRun = !this.#transport;
    const didDateChange = this.#activeDate !== dateStr;
    if (!isFirstRun && !didDateChange) return;

    if (isFirstRun) {
      this.#transport = buildTransport(STREAM_NAME, (error) =>
        this.#reportError(`Transport [${STREAM_NAME}]`, error),
      );
      await ensureCloudWatchStream(STREAM_NAME, (context, error) => this.#reportError(context, error));
      process.stdout.write(`[CW Forwarder] Active stream: ${STREAM_NAME}\n`);
    }

    this.#activeDate = dateStr;

    const stateOffset = this.#state?.[dateStr]?.offset;
    if (Number.isFinite(stateOffset) && stateOffset >= 0) {
      this.#offset = stateOffset;
    } else {
      const filePath = getCurrentFilePath(now);
      const stats = await fsp.stat(filePath).catch(() => null);
      this.#offset = START_POSITION === 'end' ? stats?.size || 0 : 0;
    }

    this.#partialLine = '';
  }

  /**
   * Emit a single raw log line to the given transport and await its callback.
   * Returns true on success, false on transport callback error (also writes DLQ).
   * This is async so callers can use Promise.all() for parallel batch emit.
   */
  async #emitLine(rawLine, dateStr, transport = this.#transport, source = 'primary') {
    if (!rawLine || !transport) return true;
    const now = Date.now();
    const fingerprint = this.#buildFingerprint(rawLine, dateStr);
    if (source === 'replay' && this.#wasRecentlyAttempted(fingerprint, now)) {
      return 'defer-retry';
    }
    this.#markRecentAttempt(fingerprint, now);
    return new Promise((resolve) => {
      transport.log(buildInfo(rawLine), (error) => {
        if (error) {
          this.#reportError('emit error', error);
          if (source === 'primary') {
            this.#writeDLQ(rawLine, 'emit-error', dateStr).catch(() => {});
          }
          resolve('failed');
        } else {
          resolve('sent');
        }
      });
    });
  }

  async #processDelta(now = new Date()) {
    await this.#rolloverIfNeeded(now);

    const filePath = getCurrentFilePath(now);
    const stats = await fsp.stat(filePath).catch(() => null);
    if (!stats?.isFile()) return;

    // Reset if file was truncated (e.g., unexpected rotation).
    if (stats.size < this.#offset) {
      this.#offset = 0;
      this.#partialLine = '';
    }

    if (stats.size === this.#offset) return;

    const readStream = fs.createReadStream(filePath, {
      encoding: 'utf8',
      start: this.#offset,
      end: stats.size - 1,
    });

    let chunkText = '';
    for await (const chunk of readStream) chunkText += chunk;

    // targetOffset is where we WANT to advance to — but we only commit it AFTER
    // every transport.log() callback fires. This is the core correctness guarantee:
    // if the process crashes mid-batch, the next restart re-reads from the last
    // committed offset (at-least-once delivery, no permanent skips).
    const targetOffset = stats.size;
    const merged = this.#partialLine + chunkText;
    const lines = merged.split('\n');
    this.#partialLine = lines.pop() || '';

    const today = getDateStamp(now);
    const trimmedLines = lines.map((l) => l.trim()).filter(Boolean);

    if (trimmedLines.length > 0) {
      // Emit all lines in parallel; await ALL callbacks before touching offset.
      await Promise.all(trimmedLines.map((line) => this.#emitLine(line, today, this.#transport, 'primary')));
    }

    // Only here — after every callback fired (success or DLQ) — do we advance the cursor.
    this.#offset = targetOffset;
    this.#state[this.#activeDate] = { offset: this.#offset, updatedAt: formatLocalTimestamp() };
    await this.#saveState();
  }

  /** Parse a DLQ file into valid entries, grouped by original log date. */
  async #parseDLQFile(filePath) {
    const content = await fsp.readFile(filePath, 'utf8').catch(() => null);
    if (!content?.trim()) return null;

    const entries = content
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => safeJsonParse(l))
      .filter((e) => e?.logLine);

    if (entries.length === 0) return null;

    const byDate = new Map();
    for (const entry of entries) {
      const d = entry.date || this.#activeDate;
      if (!byDate.has(d)) byDate.set(d, []);
      byDate.get(d).push(entry.logLine);
    }
    return byDate;
  }

  /** Emit all lines to the single configured CW stream, return true if all succeeded. */
  async #replayDateBatch(dateStr, logLines) {
    if (!this.#transport) return false;

    const results = await Promise.all(
      logLines.map((line) => this.#emitLine(line, dateStr, this.#transport, 'replay')),
    );
    for (const result of results) {
      if (result === 'failed') {
        this.#reportError(`DLQ replay emit [${dateStr}]`, new Error('replay delivery failed'));
        return false;
      }
      if (result === 'defer-retry') {
        return false;
      }
    }

    return true;
  }

  /**
   * Scan for DLQ files and re-emit their lines to the single configured CloudWatch stream,
   * and delete the file once all lines are confirmed. Called on startup and periodically.
   *
   * Each DLQ entry still carries the original `date` field for traceability/debugging.
   */
  async #replayDLQ() {
    const files = await fsp.readdir(LOG_DIR).catch(() => []);
    const dlqFiles = files
      .filter((f) => f.startsWith(`${DLQ_PREFIX}-`) && f.endsWith('.log'))
      .sort(); // oldest first

    if (dlqFiles.length === 0) return;
    process.stdout.write(`[CW Forwarder] Replaying ${dlqFiles.length} DLQ file(s)...\n`);

    for (const filename of dlqFiles) {
      const filePath = path.join(LOG_DIR, filename);
      const byDate = await this.#parseDLQFile(filePath);

      if (!byDate) {
        await fsp.unlink(filePath).catch(() => {});
        continue;
      }

      let allSucceeded = true;
      for (const [dateStr, logLines] of byDate) {
        const ok = await this.#replayDateBatch(dateStr, logLines);
        if (!ok) allSucceeded = false;
      }

      if (allSucceeded) {
        await fsp.unlink(filePath).catch(() => {});
        process.stdout.write(`[CW Forwarder] DLQ replayed and removed: ${filename}\n`);
      }
    }
  }

  async start() {
    this.#running = true;
    process.stdout.write('[CW Forwarder] Starting...\n');

    let nextDLQReplay = Date.now() + DLQ_REPLAY_INTERVAL_MS;

    while (this.#running) {
      const now = new Date();
      try {
        await this.#processDelta(now);
      } catch (error) {
        process.stderr.write(`[CW Forwarder] Loop error: ${error?.message || 'unknown'}\n`);
      }

      // Periodic DLQ replay — non-blocking, errors are logged but don't stop the loop.
      if (Date.now() >= nextDLQReplay) {
        nextDLQReplay = Date.now() + DLQ_REPLAY_INTERVAL_MS;
        this.#replayDLQ().catch((err) =>
          process.stderr.write(
            `[CW Forwarder] Periodic DLQ replay error: ${err?.message || 'unknown'}\n`,
          ),
        );
      }

      await sleep(POLL_INTERVAL_MS);
    }
  }

  async stop() {
    this.#running = false;
    await this.#saveState();
    // kthxbye drains all in-flight logs to CloudWatch before the transport closes.
    await closeTransport(this.#transport);
    this.#transport = null;
    process.stdout.write('[CW Forwarder] Stopped\n');
  }
}

const forwarder = new CloudWatchDailyForwarder();
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
