import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import CloudWatchTransport from 'winston-cloudwatch';
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
const START_POSITION = String(process.env.CW_START_POSITION || 'beginning').toLowerCase();
// Dead-letter queue: lines that failed transport delivery are stored here for auto-replay.
const DLQ_PREFIX = process.env.CW_DLQ_PREFIX || 'cw-dlq';
const ERROR_THROTTLE_MS = Number.parseInt(process.env.CW_ERROR_THROTTLE_MS || '15000', 10);
// How often to attempt replaying any accumulated DLQ files (default every 60 s).
const DLQ_REPLAY_INTERVAL_MS = Number.parseInt(process.env.CW_DLQ_REPLAY_INTERVAL_MS || '60000', 10);

const awsRegion = config.aws.region;
const awsAccessKeyId = config.aws.accessKeyId;
const awsSecretAccessKey = config.aws.secretAccessKey;
const logGroupName = config.aws.cloudWatchLogGroup;

if (!awsRegion || !awsAccessKeyId || !awsSecretAccessKey || !logGroupName) {
  process.stderr.write(
    '[CW Forwarder] Missing AWS config values. Required: aws.region, aws.accessKeyId, aws.secretAccessKey, aws.cloudWatchLogGroup\n',
  );
  process.exit(1);
}

const getCurrentFilePath = (date = new Date()) => getDailyLogFilePath(LOG_DIR, date);
const getCurrentStreamName = (date = new Date()) => `${STREAM_PREFIX}${getDateStamp(date)}`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
    if (this.#activeDate === dateStr && this.#transport) return;

    await closeTransport(this.#transport);
    this.#transport = null;
    this.#activeDate = dateStr;
    this.#transport = buildTransport(
      `${STREAM_PREFIX}${dateStr}`,
      (error) => this.#reportError(`Transport [${STREAM_PREFIX}${dateStr}]`, error),
    );

    const stateOffset = this.#state?.[dateStr]?.offset;
    if (Number.isFinite(stateOffset) && stateOffset >= 0) {
      this.#offset = stateOffset;
    } else {
      const filePath = getCurrentFilePath(now);
      const stats = await fsp.stat(filePath).catch(() => null);
      this.#offset = START_POSITION === 'end' ? stats?.size || 0 : 0;
    }

    this.#partialLine = '';
    process.stdout.write(`[CW Forwarder] Active stream: ${getCurrentStreamName(now)}\n`);
  }

  /**
   * Emit a single raw log line to the given transport and await its callback.
   * Returns true on success, false on transport callback error (also writes DLQ).
   * This is async so callers can use Promise.all() for parallel batch emit.
   */
  async #emitLine(rawLine, dateStr, transport = this.#transport) {
    if (!rawLine || !transport) return true;

    return new Promise((resolve) => {
      transport.log(buildInfo(rawLine), (error) => {
        if (error) {
          this.#reportError('emit error', error);
          this.#writeDLQ(rawLine, 'emit-error', dateStr).catch(() => {});
          resolve(false);
        } else {
          resolve(true);
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
      await Promise.all(trimmedLines.map((line) => this.#emitLine(line, today)));
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

  /** Emit all lines for a single date to the correct CW stream, return true if all succeeded. */
  async #replayDateBatch(dateStr, logLines) {
    const isToday = dateStr === this.#activeDate;
    const transport = isToday
      ? this.#transport
      : buildTransport(
          `${STREAM_PREFIX}${dateStr}`,
          (error) => this.#reportError(`DLQ replay transport [${dateStr}]`, error),
        );

    const results = await Promise.all(
      logLines.map(
        (line) =>
          new Promise((resolve) => {
            transport.log(buildInfo(line), (err) => {
              if (err) this.#reportError(`DLQ replay emit [${dateStr}]`, err);
              resolve(!err);
            });
          }),
      ),
    );

    if (!isToday) await closeTransport(transport);
    return results.every(Boolean);
  }

  /**
   * Scan for DLQ files, re-emit their lines to the correct date-specific CloudWatch stream,
   * and delete the file once all lines are confirmed. Called on startup and periodically.
   *
   * Each DLQ entry carries the original `date` field so logs are always routed to the
   * correct stream (e.g. yesterday's failures go to yesterday's CW stream, not today's).
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
      try {
        await this.#processDelta();
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
