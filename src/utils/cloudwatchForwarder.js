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

class CloudWatchDailyForwarder {
  #transport = null;
  #activeDate = null;
  #offset = 0;
  #partialLine = '';
  #running = false;
  #state = {};

  async init() {
    await fsp.mkdir(LOG_DIR, { recursive: true });
    await this.#loadState();
    await this.#rolloverIfNeeded();
  }

  async #loadState() {
    const text = await fsp.readFile(STATE_FILE, 'utf8').catch(() => null);
    if (!text) return;

    const parsed = safeJsonParse(text);
    if (parsed && typeof parsed === 'object') {
      this.#state = parsed;
    }
  }

  async #saveState() {
    const payload = JSON.stringify(this.#state);
    await fsp.writeFile(STATE_FILE, payload, 'utf8').catch(() => {});
  }

  #createTransportForDate(dateStr) {
    const streamName = `${STREAM_PREFIX}${dateStr}`;

    const transport = new CloudWatchTransport({
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
      errorHandler: (error) => {
        process.stderr.write(`[CW Forwarder] Transport error: ${error?.message || 'unknown'}\n`);
      },
    });

    return transport;
  }

  async #rolloverIfNeeded(now = new Date()) {
    const dateStr = getDateStamp(now);
    if (this.#activeDate === dateStr && this.#transport) return;

    if (this.#transport) {
      await new Promise((resolve) => {
        this.#transport.kthxbye?.(() => resolve());
        setTimeout(resolve, 5000);
      });
    }

    this.#activeDate = dateStr;
    this.#transport = this.#createTransportForDate(dateStr);

    const stateOffset = this.#state?.[dateStr]?.offset;
    if (Number.isFinite(stateOffset) && stateOffset >= 0) {
      this.#offset = stateOffset;
    } else {
      const filePath = getCurrentFilePath(now);
      const stats = await fsp.stat(filePath).catch(() => null);
      this.#offset = stats?.size || 0;
    }

    this.#partialLine = '';
    process.stdout.write(`[CW Forwarder] Active stream: ${getCurrentStreamName(now)}\n`);
  }

  #emitLine(rawLine) {
    if (!rawLine || !this.#transport) return;

    const parsed = safeJsonParse(rawLine);

    if (parsed && typeof parsed === 'object') {
      this.#transport.log(
        {
          level: parsed.level || 'info',
          message: parsed.message || 'log',
          timestamp: parsed.time || parsed.timestamp || formatLocalTimestamp(),
          metadata: parsed,
        },
        () => {},
      );
      return;
    }

    this.#transport.log(
      {
        level: 'info',
        message: rawLine,
        timestamp: formatLocalTimestamp(),
      },
      () => {},
    );
  }

  async #processDelta(now = new Date()) {
    await this.#rolloverIfNeeded(now);

    const filePath = getCurrentFilePath(now);
    const stats = await fsp.stat(filePath).catch(() => null);
    if (!stats?.isFile()) return;

    // log rotated/truncated unexpectedly
    if (stats.size < this.#offset) {
      this.#offset = 0;
      this.#partialLine = '';
    }

    if (stats.size === this.#offset) return;

    const stream = fs.createReadStream(filePath, {
      encoding: 'utf8',
      start: this.#offset,
      end: stats.size - 1,
    });

    let chunkText = '';
    for await (const chunk of stream) {
      chunkText += chunk;
    }

    this.#offset = stats.size;
    const merged = this.#partialLine + chunkText;
    const lines = merged.split('\n');
    this.#partialLine = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) this.#emitLine(trimmed);
    }

    this.#state[this.#activeDate] = { offset: this.#offset, updatedAt: formatLocalTimestamp() };
    await this.#saveState();
  }

  async start() {
    this.#running = true;
    process.stdout.write('[CW Forwarder] Starting...\n');

    while (this.#running) {
      try {
        await this.#processDelta();
      } catch (error) {
        process.stderr.write(`[CW Forwarder] Loop error: ${error?.message || 'unknown'}\n`);
      }

      await sleep(POLL_INTERVAL_MS);
    }
  }

  async stop() {
    this.#running = false;

    try {
      await this.#saveState();
    } catch {
      // noop
    }

    if (this.#transport) {
      await new Promise((resolve) => {
        this.#transport.kthxbye?.(() => resolve());
        setTimeout(resolve, 5000);
      });
      this.#transport = null;
    }

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
