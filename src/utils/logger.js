import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import winston, { createLogger, format } from 'winston';
import DailyRotate from 'winston-daily-rotate-file';
import CloudWatchTransport from 'winston-cloudwatch';
import appConfig from '../config/config.js';
import chalk from 'chalk';
import { stringifyJSON } from './index.js';
import { closeLogPublisher, publishLogEvent } from './rabbitLogPublisher.js';

const env = appConfig?.nodeProductionLogs;
const aws = appConfig?.aws;
const loggingConfig = appConfig?.logging || {};
const logDir = 'log';
const PRIMARY_LOCK_FILE = path.join(logDir, '.primary-logger.lock');
const PRIMARY_LOCK_TTL_MS = 120000; // 2 min stale timeout
const PRIMARY_LOCK_HEARTBEAT_MS = 30000; // refresh every 30s

let isCurrentProcessPrimaryLogger = false;

// CloudWatch modes:
// - all (default): each worker writes to its own stream (recommended; no sequence-token contention)
// - primary: only lock-elected primary worker writes to CloudWatch
const CLOUDWATCH_MODE = (loggingConfig.cloudWatchMode || 'all').toLowerCase();
const ENABLE_CENTRAL_LOG_INGESTOR = loggingConfig.enableCentralLogIngestor === true;
const IS_LOG_INGESTOR_PROCESS = loggingConfig.isLogIngestorProcess === true;

// CloudWatch has a 256KB limit per log event
// Using 240KB safe limit to account for JSON overhead and metadata
const CLOUDWATCH_SAFE_SIZE = 240 * 1024; // 240KB to be safe

// Standard limits for all transports to ensure consistency
const MAX_MESSAGE_LENGTH = 10000; // 10KB for message body
const MAX_STACK_LENGTH = 5000; // 5KB for stack traces
const MAX_METADATA_LENGTH = 5000; // 5KB for metadata per field

/**
 * Safely stringify data, handling circular references and BigInt
 */
const safeStringify = (obj) => {
  const seen = new WeakSet();
  return JSON.stringify(obj, (key, value) => {
    // Handle BigInt
    if (typeof value === 'bigint') {
      return value.toString() + 'n';
    }
    // Handle circular references
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
    }
    // Handle functions
    if (typeof value === 'function') {
      return '[Function]';
    }
    return value;
  });
};

/**
 * Smart truncation - preserves beginning and end of content for context
 */
const smartTruncate = (str, maxLength, label = 'content') => {
  if (!str || typeof str !== 'string') return str;
  
  const length = Buffer.byteLength(str, 'utf8');
  if (length <= maxLength) return str;
  
  // Keep first 60% and last 20%, show middle was truncated
  const keepStart = Math.floor(maxLength * 0.6);
  const keepEnd = Math.floor(maxLength * 0.2);
  const truncatedBytes = length - maxLength;
  
  const start = str.substring(0, keepStart);
  const end = str.substring(str.length - keepEnd);
  
  return `${start}\n\n... [${truncatedBytes} bytes of ${label} truncated] ...\n\n${end}`;
};

/**
 * Truncate log data - used by ALL transports for consistency
 */
const truncateLogData = (data, forCloudWatch = false) => {
  try {
    const cloned = { ...data };
    
    // Truncate message with preview
    if (cloned.message && typeof cloned.message === 'string') {
      cloned.message = smartTruncate(cloned.message, MAX_MESSAGE_LENGTH, 'message');
    } else if (cloned.message && typeof cloned.message === 'object') {
      // Handle object messages
      try {
        const msgStr = safeStringify(cloned.message);
        cloned.message = smartTruncate(msgStr, MAX_MESSAGE_LENGTH, 'message object');
      } catch {
        cloned.message = '[Complex message - could not serialize]';
      }
    }
    
    // Truncate stack traces with preview
    if (cloned.stack && typeof cloned.stack === 'string') {
      cloned.stack = smartTruncate(cloned.stack, MAX_STACK_LENGTH, 'stack trace');
    }
    
    // Truncate metadata fields individually
    if (cloned.metadata && typeof cloned.metadata === 'object') {
      const truncatedMeta = {};
      for (const [key, value] of Object.entries(cloned.metadata)) {
        try {
          if (typeof value === 'string') {
            truncatedMeta[key] = smartTruncate(value, MAX_METADATA_LENGTH, `metadata.${key}`);
          } else if (typeof value === 'object' && value !== null) {
            const serialized = safeStringify(value);
            truncatedMeta[key] = smartTruncate(serialized, MAX_METADATA_LENGTH, `metadata.${key}`);
          } else {
            truncatedMeta[key] = value;
          }
        } catch {
          truncatedMeta[key] = `[Error serializing ${key}]`;
        }
      }
      cloned.metadata = truncatedMeta;
    }
    
    // Final size check for CloudWatch only
    if (forCloudWatch) {
      const finalString = safeStringify(cloned);
      const finalSize = Buffer.byteLength(finalString, 'utf8');
      
      if (finalSize > CLOUDWATCH_SAFE_SIZE) {
        // Extreme case - strip metadata but keep message preview
        return {
          level: cloned.level,
          message: smartTruncate(cloned.message || 'Large log', 8000, 'message'),
          timestamp: cloned.timestamp,
          _warning: 'Metadata stripped - exceeded CloudWatch 240KB limit',
          _originalSize: `${(finalSize / 1024).toFixed(2)}KB`,
        };
      }
    }
    
    return cloned;
  } catch (error) {
    // fallback here - never lose the log completely
    return {
      level: data.level || 'error',
      message: data.message?.toString().substring(0, 500) || 'Log processing error',
      timestamp: data.timestamp || new Date().toISOString(),
      _error: `Truncation failed: ${error.message}`,
    };
  }
};

const readLockPayload = () => {
  try {
    const raw = fs.readFileSync(PRIMARY_LOCK_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const isPidAlive = (pid) => {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const isLockStale = () => {
  try {
    const stat = fs.statSync(PRIMARY_LOCK_FILE);
    return Date.now() - stat.mtimeMs > PRIMARY_LOCK_TTL_MS;
  } catch {
    return true;
  }
};

const tryAcquirePrimaryLoggerLock = () => {
  const { hostname } = getRuntimeIdentity();
  const payload = {
    pid: process.pid,
    startedAt: new Date().toISOString(),
    hostname,
  };

  const data = JSON.stringify(payload);

  // First attempt: create lock atomically
  try {
    fs.writeFileSync(PRIMARY_LOCK_FILE, data, { flag: 'wx' });
    return true;
  } catch {
    // Lock exists - check whether stale/dead
  }

  try {
    const existing = readLockPayload();
    const ownerAlive = isPidAlive(existing?.pid);
    const stale = isLockStale();

    if (!ownerAlive || stale) {
      fs.unlinkSync(PRIMARY_LOCK_FILE);
      fs.writeFileSync(PRIMARY_LOCK_FILE, data, { flag: 'wx' });
      return true;
    }
  } catch {
    // Another worker may race and win lock; that's fine.
  }

  return false;
};

const refreshPrimaryLoggerLock = () => {
  try {
    const current = readLockPayload();
    if (current?.pid !== process.pid) {
      return false;
    }
    fs.utimesSync(PRIMARY_LOCK_FILE, new Date(), new Date());
    return true;
  } catch {
    return false;
  }
};

const releasePrimaryLoggerLock = () => {
  try {
    const current = readLockPayload();
    if (current?.pid === process.pid) {
      fs.unlinkSync(PRIMARY_LOCK_FILE);
    }
  } catch {
    // ignore best-effort cleanup failures
  }
};

const getRuntimeIdentity = () => {
  const instanceId =
    loggingConfig.instanceId ||
    loggingConfig.nodeAppInstance ||
    loggingConfig.pmId ||
    '0';
  const workerId = loggingConfig.pmId || process.pid;
  const hostname = loggingConfig.hostName || os.hostname();

  return { instanceId, workerId, hostname };
};

const buildDedupeKey = (level, message, meta = {}) => {
  if (meta?.dedupeKey) return meta.dedupeKey;
  if (meta?.eventKey) return String(meta.eventKey);

  const bucket = new Date().toISOString().slice(0, 16); // minute bucket
  const seed = `${level}|${String(message)}|${bucket}`;
  return crypto.createHash('sha256').update(seed).digest('hex');
};

const buildCentralLogPayload = (level, message, meta = {}) => {
  const { instanceId, workerId, hostname } = getRuntimeIdentity();

  return {
    level,
    message: typeof message === 'string' ? message : safeStringify(message),
    metadata: meta && typeof meta === 'object' ? meta : {},
    timestamp: new Date().toISOString(),
    pid: process.pid,
    worker_id: workerId,
    instance_id: instanceId,
    hostname,
    dedupeKey: buildDedupeKey(level, message, meta),
  };
};

class Logger {
  #logger;
  #isPrimaryWriter;
  #lockHeartbeat;
  #isClosing;
  constructor() {
    this.#isClosing = false;
    try {
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
    } catch (error) {
      console.error(`Failed to create log directory: ${error.message}`);
    }

    const transports = [];
    
    // Determine environment
    const isProduction = appConfig?.env === 'production';
    const hasAwsConfig = aws?.cloudWatchLogGroup && aws?.region && aws?.accessKeyId && aws?.secretAccessKey;
    
    // Get worker identification metadata
    const { instanceId, workerId, hostname } = getRuntimeIdentity();
    const cloudWatchPrimaryOnly = CLOUDWATCH_MODE === 'primary';

    // Use lock-based leader election so primary logger survives PM2 worker-id reshuffles
    this.#isPrimaryWriter = tryAcquirePrimaryLoggerLock();
    isCurrentProcessPrimaryLogger = this.#isPrimaryWriter;

    if (this.#isPrimaryWriter) {
      this.#lockHeartbeat = setInterval(() => {
        const ok = refreshPrimaryLoggerLock();
        if (!ok) {
          // Lost lock unexpectedly; stop heartbeat.
          clearInterval(this.#lockHeartbeat);
          this.#lockHeartbeat = null;
          this.#isPrimaryWriter = false;
          isCurrentProcessPrimaryLogger = false;
        }
      }, PRIMARY_LOCK_HEARTBEAT_MS);
      this.#lockHeartbeat.unref?.();
    }
    
    if (isProduction && hasAwsConfig && !ENABLE_CENTRAL_LOG_INGESTOR) {
      // CloudWatch for production
      try {
        // In primary mode, only elected primary logger sends to CloudWatch.
        if (cloudWatchPrimaryOnly && !this.#isPrimaryWriter) {
          console.log(`[CloudWatch] primary mode enabled - skipping transport on worker ${workerId}`);
        } else {
          const datePart = new Date().toISOString().split('T')[0];
          // all mode => per-worker stream; primary mode => single stream
          const streamName = cloudWatchPrimaryOnly
            ? `${env}-${datePart}`
            : `${env}-${datePart}-w${workerId}`;
        
          const cloudWatchConfig = {
            logGroupName: aws.cloudWatchLogGroup,
            logStreamName: streamName,
            awsRegion: aws.region,
            awsAccessKeyId: aws.accessKeyId,
            awsSecretAccessKey: aws.secretAccessKey,
            retentionInDays: 30,
            jsonMessage: true,
            createLogGroup: true,
            createLogStream: true,
            uploadRate: 3000,
            errorHandler: (error) => {
              if (!error.message?.includes('retrying') && 
                  !error.message?.includes('throttl') && 
                  !error.message?.includes('sequence')) {
                console.error('[CloudWatch] Upload error:', error.message);
              }
            },
            messageFormatter: (logObject) => {
              // Worker identification in EVERY log message
              return {
                ...logObject,
                worker_id: workerId,
                instance_id: instanceId,
                hostname: hostname,
                primary_writer: this.#isPrimaryWriter,
              };
            },
          };

          const cwTransport = new CloudWatchTransport(cloudWatchConfig);
          
          // Handle CloudWatch-specific errors gracefully
          cwTransport.on('error', (error) => {
            // Sequence token errors are expected mostly in shared-stream mode - library handles them
            if (!error.message?.includes('sequence')) {
              console.error('[CloudWatch] Transport error:', error.message);
            }
          });

          transports.push(cwTransport);
          console.log(`CloudWatch enabled: ${streamName} (worker ${workerId}, mode=${CLOUDWATCH_MODE})`);
        }
      } catch (error) {
        console.error('CloudWatch init failed:', error.message);
        console.warn('Falling back to minimal local logging');
        
        // Fallback: Critical errors only to local file
        if (this.#isPrimaryWriter) {
          transports.push(
            new DailyRotate({
              filename: `${logDir}/%DATE%-application.log`,
              datePattern: 'YYYY-MM-DD',
              level: 'error',
              maxFiles: '14d',
              zippedArchive: false,
            })
          );
        }
      }
    } else if (isProduction && hasAwsConfig && ENABLE_CENTRAL_LOG_INGESTOR && !IS_LOG_INGESTOR_PROCESS) {
      console.log('[Logger] Central ingestor mode enabled - skipping direct CloudWatch transport in app workers');
    } else {
      // DEVELOPMENT/STAGING: Use local file rotation (faster, no AWS costs)
      if (!isProduction) {
        console.log('Development mode - Using local file logging only');
      } else {
        console.warn('Production mode but CloudWatch config missing. Using file logs only.');
      }
      
      // Local file transport (single writer + single file per day)
      if (this.#isPrimaryWriter) {
        transports.push(
          new DailyRotate({
            filename: `${logDir}/%DATE%-application.log`,
            datePattern: 'YYYY-MM-DD',
            level: 'debug',
            maxFiles: '7d',
            zippedArchive: false,
            // Intentionally NO maxSize: keep one file per day
          })
        );
      }
    }

    // custom format to add IP address to metadata
    const addIpFormat = format((info) => {
      if (info.metadata && info.metadata.ip) {
        info.ip = info.metadata.ip;
      }
      return info;
    });

    this.#logger = createLogger({
      level: isProduction ? 'info' : 'debug', // More verbose in development
      format: format.combine(
        addIpFormat(),
        format.errors({ stack: true }),
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        // Apply smart truncation to ALL logs (file + CloudWatch)
        format((info) => {
          const forCloudWatch = isProduction && hasAwsConfig;
          return truncateLogData(info, forCloudWatch);
        })(),
        format.metadata({
          fillExcept: ['message', 'level', 'timestamp', 'stack'],
        }),
        format.json(),
      ),
      transports,
      exitOnError: false,
      silent: false,
    });

    // Add console transport for all environments
    // Production: Simple JSON format for PM2 logs
    // Development: Colorized with detailed timestamps
    const consoleFormat = isProduction
      ? format.combine(
          format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          format.printf(({ timestamp, level, message, ...meta }) => {
            let metaStr = '';
            if (Object.keys(meta).length) {
              try {
                metaStr = safeStringify(meta);
              } catch {
                metaStr = '[Error serializing metadata]';
              }
            }
            return `${timestamp}: [${level}] ${message} ${metaStr}`;
          })
        )
      : format.combine(
          format.colorize(),
          format.timestamp({
            format: () => {
              const options = {
                weekday: 'short',
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
                timeZone: 'Asia/Kolkata',
              };
              return new Date()
                .toLocaleString('en-US', options)
                .replace(',', '');
            },
          }),
          format.metadata({
            fillExcept: ['message', 'level', 'timestamp', 'stack'],
          }),
            format.printf(({ timestamp, level, message, metadata }) => {
              const typeChalk =
                level === 'error'
                  ? chalk.red(level)
                  : level === 'warn'
                    ? chalk.yellowBright(level)
                    : chalk.cyanBright(level);

              // it will only include metaString if metadata has meaningful data
              const metaString = (() => {
                if (!metadata || Object.keys(metadata).length === 0) {
                  return '';
                }
                // check if metadata only contains an empty metadata object
                if (
                  Object.keys(metadata).length === 1 &&
                  metadata.metadata &&
                  Object.keys(metadata.metadata).length === 0
                ) {
                  return '';
                }
                return stringifyJSON(metadata);
              })();

              return `[${typeChalk}] [${timestamp}] ${message} ${metaString}`.trim();
            })
          );

    this.#logger.add(
      new winston.transports.Console({
        format: consoleFormat,
      })
    );

    // Handle uncaught transport errors gracefully
    this.#logger.on('error', (error) => {
      console.error('[Logger] Transport error:', error.message);
    });
  }

  log(level, message, meta) {
    if (this.#isClosing) {
      return;
    }

    // Handle cases where message is an object and no meta is provided
    if (typeof message === 'object' && !meta) {
      meta = message;
      message = 'Log entry';
    }
    
    // Validate level
    const validLevels = ['error', 'warn', 'info', 'debug'];
    if (!validLevels.includes(level)) {
      level = 'info';
    }

    // Only pass meta to winston if it has meaningful data
    if (meta && Object.keys(meta).length > 0) {
      this.#logger.log(level, message, meta);
    } else {
      this.#logger.log(level, message);
    }

    // Fire-and-forget centralized publishing (optional)
    if (ENABLE_CENTRAL_LOG_INGESTOR && !IS_LOG_INGESTOR_PROCESS) {
      const payload = buildCentralLogPayload(level, message, meta);
      publishLogEvent(payload).catch(() => {
        // Do not recurse into logger from logger internals
      });
    }
  }

  // Graceful shutdown - flush all transports
  async close() {
    return new Promise((resolve) => {
      this.#isClosing = true;
      if (this.#lockHeartbeat) {
        clearInterval(this.#lockHeartbeat);
        this.#lockHeartbeat = null;
      }
      if (this.#isPrimaryWriter) {
        releasePrimaryLoggerLock();
        this.#isPrimaryWriter = false;
        isCurrentProcessPrimaryLogger = false;
      }
      if (ENABLE_CENTRAL_LOG_INGESTOR && !IS_LOG_INGESTOR_PROCESS) {
        closeLogPublisher().catch(() => {
          // best-effort shutdown
        });
      }
      this.#logger.on('finish', () => resolve());
      this.#logger.end();
    });
  }
}

export default Logger;
const winstonLogger = new Logger();

const buildEventMeta = (eventName, meta = {}, dedupeKey) => {
  const safeMeta = meta && typeof meta === 'object' ? meta : {};
  const finalDedupeKey = dedupeKey || safeMeta.dedupeKey || safeMeta.eventKey || eventName;

  return {
    ...safeMeta,
    eventName,
    eventKey: finalDedupeKey,
    dedupeKey: finalDedupeKey,
  };
};

// Helper to check if current worker should log shared events
const isPrimaryWorker = () => {
  return isCurrentProcessPrimaryLogger;
};

export const logger = {
  log: (message, meta) => winstonLogger.log('info', message, meta),
  info: (message, meta) => winstonLogger.log('info', message, meta),
  warn: (message, meta) => winstonLogger.log('warn', message, meta),
  error: (message, meta) => winstonLogger.log('error', message, meta),
  debug: (message, meta) => winstonLogger.log('debug', message, meta),

  // Standardized event logging helpers for centralized dedupe
  infoEvent: (eventName, message, meta = {}, dedupeKey) =>
    winstonLogger.log('info', message || eventName, buildEventMeta(eventName, meta, dedupeKey)),
  warnEvent: (eventName, message, meta = {}, dedupeKey) =>
    winstonLogger.log('warn', message || eventName, buildEventMeta(eventName, meta, dedupeKey)),
  errorEvent: (eventName, message, meta = {}, dedupeKey) =>
    winstonLogger.log('error', message || eventName, buildEventMeta(eventName, meta, dedupeKey)),
  debugEvent: (eventName, message, meta = {}, dedupeKey) =>
    winstonLogger.log('debug', message || eventName, buildEventMeta(eventName, meta, dedupeKey)),
  
  // Only log once from lock-elected primary logger to avoid duplicates for shared events.
  infoOnce: (message, meta) => {
    if (isPrimaryWorker()) {
      winstonLogger.log('info', message, meta);
    }
  },
  warnOnce: (message, meta) => {
    if (isPrimaryWorker()) {
      winstonLogger.log('warn', message, meta);
    }
  },
  
  close: () => winstonLogger.close(), // Export close for graceful shutdown
};
