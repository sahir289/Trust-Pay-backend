import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { once } from 'node:events';
import os from 'node:os';
import path from 'node:path';
import pino from 'pino';
import chalk from 'chalk';
import appConfig from '../config/config.js';
import {
  formatLocalTimestamp,
  getDateStamp,
  getDailyLogFilePath,
} from './logShared.js';

const isProduction = appConfig?.env === 'production';
const LOG_LEVEL = process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug');
const LOG_DIR = process.env.LOG_DIR || 'logs';
const LOG_TO_STDOUT = process.env.LOG_TO_STDOUT !== 'false';
const LOG_TO_FILE = process.env.LOG_TO_FILE !== 'false';
const LOG_RETENTION_DAYS = Number.parseInt(process.env.LOG_RETENTION_DAYS || '7', 10);
const MAX_QUEUE_BYTES = Number.parseInt(process.env.LOG_MAX_QUEUE_BYTES || `${8 * 1024 * 1024}`, 10);

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Error);

const safeToJSON = (value) => {
  const seen = new WeakSet();
  return JSON.parse(
    JSON.stringify(value, (_key, val) => {
      if (typeof val === 'bigint') return `${val.toString()}n`;
      if (typeof val === 'function') return '[Function]';
      if (typeof val === 'object' && val !== null) {
        if (seen.has(val)) return '[Circular]';
        seen.add(val);
      }
      return val;
    }),
  );
};

const truncateString = (value, max = 10_000) => {
  if (typeof value !== 'string') return value;
  if (value.length <= max) return value;
  return `${value.slice(0, max)}... [truncated ${value.length - max} chars]`;
};

const serializeError = (error) => {
  if (!(error instanceof Error)) return error;
  return {
    name: error.name,
    message: truncateString(error.message, 4000),
    stack: truncateString(error.stack, 10000),
    code: error.code,
    cause: error.cause,
  };
};

class DailyFileSink {
  #logDir;
  #retentionDays;
  #stream = null;
  #activeDate = null;
  #queue = [];
  #queuedBytes = 0;
  #droppedMessages = 0;
  #draining = false;
  #closed = false;
  #cleanupTimer = null;

  constructor({ logDir, retentionDays }) {
    this.#logDir = logDir;
    this.#retentionDays = Number.isFinite(retentionDays) && retentionDays > 0 ? retentionDays : 7;
  }

  async init() {
    await fsp.mkdir(this.#logDir, { recursive: true });
    await this.#rotateIfNeeded();
    await this.#cleanupOldFiles();

    // Periodic cleanup (lightweight), keeps retention bounded even for low-traffic services
    this.#cleanupTimer = setInterval(() => {
      this.#cleanupOldFiles().catch(() => {});
    }, 6 * 60 * 60 * 1000);

    if (typeof this.#cleanupTimer?.unref === 'function') {
      this.#cleanupTimer.unref();
    }
  }

  async #rotateIfNeeded() {
    const today = getDateStamp();
    if (this.#stream && this.#activeDate === today) return;

    if (this.#stream) {
      await new Promise((resolve) => this.#stream.end(resolve));
      this.#stream = null;
    }

    this.#activeDate = today;
    const filePath = getDailyLogFilePath(this.#logDir);
    this.#stream = fs.createWriteStream(filePath, {
      flags: 'a',
      encoding: 'utf8',
      highWaterMark: 1024 * 1024,
    });

    this.#stream.on('error', () => {
      // Keep service alive even if disk has transient issues.
    });

    this.#flushQueue();
  }

  async #cleanupOldFiles() {
    const files = await fsp.readdir(this.#logDir);
    const cutoff = Date.now() - this.#retentionDays * 24 * 60 * 60 * 1000;

    await Promise.all(
      files
        .filter((file) => /^\d{4}-\d{2}-\d{2}\.log$/u.test(file))
        .map(async (file) => {
          const fullPath = path.join(this.#logDir, file);
          const stats = await fsp.stat(fullPath);
          if (stats.mtimeMs < cutoff) {
            await fsp.unlink(fullPath).catch(() => {});
          }
        }),
    );
  }

  #enqueue(chunk) {
    const bytes = Buffer.byteLength(chunk, 'utf8');

    if (this.#queuedBytes + bytes > MAX_QUEUE_BYTES) {
      this.#droppedMessages += 1;
      return;
    }

    this.#queue.push(chunk);
    this.#queuedBytes += bytes;
  }

  #flushQueue() {
    if (!this.#stream || this.#draining || this.#closed) return;

    if (this.#droppedMessages > 0) {
      const droppedLine = JSON.stringify({
        timestamp: formatLocalTimestamp(),
        level: 'warn',
        message: 'logger file queue overflow: dropped log messages',
        droppedMessages: this.#droppedMessages,
      });
      this.#queue.unshift(`${droppedLine}\n`);
      this.#queuedBytes += Buffer.byteLength(droppedLine, 'utf8') + 1;
      this.#droppedMessages = 0;
    }

    while (this.#queue.length > 0) {
      const line = this.#queue.shift();
      this.#queuedBytes -= Buffer.byteLength(line, 'utf8');

      const ok = this.#stream.write(line);
      if (!ok) {
        this.#draining = true;
        this.#stream.once('drain', () => {
          this.#draining = false;
          this.#flushQueue();
        });
        return;
      }
    }
  }

  write(chunk) {
    if (this.#closed) return false;

    const line = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
    this.#rotateIfNeeded().catch(() => {});

    if (!this.#stream || this.#draining) {
      this.#enqueue(line);
      return this.#queuedBytes < MAX_QUEUE_BYTES;
    }

    const canContinue = this.#stream.write(line);
    if (!canContinue) {
      this.#draining = true;
      this.#stream.once('drain', () => {
        this.#draining = false;
        this.#flushQueue();
      });
    }

    return canContinue;
  }

  async close() {
    if (this.#cleanupTimer) {
      clearInterval(this.#cleanupTimer);
      this.#cleanupTimer = null;
    }

    if (this.#stream) {
      if (this.#droppedMessages > 0) {
        const droppedLine = JSON.stringify({
          timestamp: formatLocalTimestamp(),
          level: 'warn',
          message: 'logger file queue overflow: dropped log messages',
          droppedMessages: this.#droppedMessages,
        });
        this.#queue.unshift(`${droppedLine}\n`);
        this.#queuedBytes += Buffer.byteLength(droppedLine, 'utf8') + 1;
        this.#droppedMessages = 0;
      }

      while (this.#queue.length > 0) {
        const line = this.#queue.shift();
        this.#queuedBytes -= Buffer.byteLength(line, 'utf8');

        const canContinue = this.#stream.write(line);
        if (!canContinue) {
          await once(this.#stream, 'drain').catch(() => {});
        }
      }

      await new Promise((resolve) => this.#stream.end(resolve));
      this.#stream = null;
    }

    this.#closed = true;
  }
}

const fileSink = LOG_TO_FILE
  ? new DailyFileSink({
      logDir: LOG_DIR,
      retentionDays: LOG_RETENTION_DAYS,
    })
  : null;

if (fileSink) {
  await fileSink.init().catch((error) => {
    process.stderr.write(
      `{"level":"error","message":"logger file sink init failed","error":"${truncateString(error?.message || 'unknown', 500)}"}\n`,
    );
  });
}

const pinoOptions = {
  level: LOG_LEVEL,
  timestamp: () => `,"time":"${formatLocalTimestamp()}"`,
  formatters: {
    level: (label) => ({ level: label }),
  },
  base: {
    pid: process.pid,
    hostname: os.hostname(),
    env: appConfig?.env,
    service: 'trust-pay-new-backend',
    processType: process.env.CRON_WORKER === 'true' ? 'cron' : 'app',
    instanceId: process.env.INSTANCE_ID || process.env.NODE_APP_INSTANCE || process.env.pm_id || '0',
  },
  serializers: {
    err: serializeError,
    error: serializeError,
  },
  redact: {
    paths: [
      '*.password',
      '*.token',
      '*.authorization',
      '*.secret',
      '*.apiKey',
      'password',
      'token',
      'authorization',
      'secret',
      'apiKey',
    ],
    censor: '[Redacted]',
  },
};

const stdoutLogger = LOG_TO_STDOUT ? pino(pinoOptions, process.stdout) : null;
const fileLogger = fileSink ? pino(pinoOptions, fileSink) : null;

const normalizeMetaItem = (item, meta, extras) => {
  if (item instanceof Error) {
    meta.err = item;
    return;
  }

  if (isPlainObject(item)) {
    Object.assign(meta, safeToJSON(item));
    return;
  }

  extras.push(item);
};

const normalizeIpValue = (value) => {
  if (!value) return undefined;
  const raw = Array.isArray(value) ? value[0] : value;
  const normalized = String(raw).split(',')[0]?.trim();
  return normalized || undefined;
};

const applyCompatibilityMeta = (meta) => {
  if (!meta || typeof meta !== 'object') return meta;

  const compatIp =
    normalizeIpValue(meta.ip) ||
    normalizeIpValue(meta.userIp) ||
    normalizeIpValue(meta.user_ip) ||
    normalizeIpValue(meta.metadata?.ip) ||
    normalizeIpValue(meta.metadata?.userIp) ||
    normalizeIpValue(meta.metadata?.user_ip) ||
    normalizeIpValue(meta.headers?.['x-forwarded-for']) ||
    normalizeIpValue(meta.request?.ip);

  if (compatIp && !meta.ip) {
    meta.ip = compatIp;
  }

  return meta;
};

const getColoredLevel = (level) => {
  if (level === 'info') return chalk.green(level);
  if (level === 'warn') return chalk.yellow(level);
  if (level === 'error') return chalk.red(level);
  return chalk.gray(level);
};

const writeStdout = (level, message, meta) => {
  if (!stdoutLogger) return;

  // const timestamp = formatLocalTimestamp();
  const coloredLevel = getColoredLevel(level);
  const hasMeta = meta && Object.keys(meta).length > 0;

  let metaString = '';
  if (hasMeta) {
    try {
      metaString = ` ${JSON.stringify(meta)}`;
    } catch {
      metaString = ' [meta-serialize-error]';
    }
  }

  process.stdout.write(`[${coloredLevel}] ${message}${metaString}\n`);
};

const parseSingleArg = (single) => {
  if (single instanceof Error) {
    return {
      message: truncateString(single.message || 'Error', 4000),
      meta: { err: single },
    };
  }

  if (typeof single === 'string' || typeof single === 'number' || typeof single === 'boolean') {
    return {
      message: truncateString(String(single), 8000),
      meta: {},
    };
  }

  return {
    message: 'Log entry',
    meta: isPlainObject(single) ? safeToJSON(single) : { data: safeToJSON(single) },
  };
};

const parseLogArgs = (args) => {
  if (!Array.isArray(args) || args.length === 0) {
    return { message: 'Log entry', meta: {} };
  }

  if (args.length === 1) {
    return parseSingleArg(args[0]);
  }

  let message = 'Log entry';
  const meta = {};
  const extras = [];
  const [first, ...rest] = args;

  if (first instanceof Error) {
    meta.err = first;
    if (typeof rest[0] === 'string') {
      message = rest.shift();
    } else {
      message = first.message || 'Error';
    }
  } else if (typeof first === 'string' || typeof first === 'number' || typeof first === 'boolean') {
    message = String(first);
  } else if (typeof rest[0] === 'string') {
    message = rest.shift();
    extras.push(first);
  } else if (isPlainObject(first)) {
    Object.assign(meta, safeToJSON(first));
  } else {
    extras.push(first);
  }

  for (const item of rest) normalizeMetaItem(item, meta, extras);

  if (extras.length > 0) {
    meta.extra = safeToJSON(extras);
  }

  return {
    message: truncateString(String(message), 8000),
    meta,
  };
};

const writeLog = (level, ...args) => {
  const validLevel = ['error', 'warn', 'info', 'debug'].includes(level) ? level : 'info';
  const { message, meta } = parseLogArgs(args);
  const safeMeta = applyCompatibilityMeta(meta);

  if (safeMeta && Object.keys(safeMeta).length > 0) {
    writeStdout(validLevel, message, safeMeta);

    if (fileLogger) {
      // Defensive clone to avoid any accidental cross-stream object mutation side effects
      fileLogger[validLevel](safeToJSON(safeMeta), message);
    }

    return;
  }

  writeStdout(validLevel, message);

  if (fileLogger) {
    fileLogger[validLevel](message);
  }
};

const isPrimaryWorker = () => {
  const instanceId = Number.parseInt(process.env.INSTANCE_ID || process.env.NODE_APP_INSTANCE || '0', 10);
  return Number.isInteger(instanceId) && instanceId === 0;
};

export const logger = {
  log: (...args) => writeLog('info', ...args),
  info: (...args) => writeLog('info', ...args),
  warn: (...args) => writeLog('warn', ...args),
  error: (...args) => writeLog('error', ...args),
  debug: (...args) => writeLog('debug', ...args),

  infoOnce: (...args) => {
    if (isPrimaryWorker()) writeLog('info', ...args);
  },

  warnOnce: (...args) => {
    if (isPrimaryWorker()) writeLog('warn', ...args);
  },

  close: async () => {
    try {
      if (fileSink) {
        await fileSink.close();
      }
    } catch {
      // never block shutdown on logger flush failures
    }

    // Do not close process.stdout; managed by Node/PM2 runtime.
  },
};

export default logger;
