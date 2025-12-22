import fs from 'fs';
import winston, { createLogger, format } from 'winston';
import DailyRotate from 'winston-daily-rotate-file';
import CloudWatchTransport from 'winston-cloudwatch';
import appConfig from '../config/config.js';
import chalk from 'chalk';
import { stringifyJSON } from './index.js';

const env = appConfig?.nodeProductionLogs;
const aws = appConfig?.aws;
const logDir = 'log';

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

class Logger {
  #logger;
  constructor() {
    try {
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
    } catch (error) {
      console.error(`Failed to create log directory: ${error.message}`);
    }

    const transports = [
      // Combined log - everything goes here for easy debugging
      new DailyRotate({
        filename: `${logDir}/%DATE%-combined.log`,
        datePattern: 'YYYY-MM-DD',
        level: 'debug', // Capture everything
        maxFiles: '7d', // Keep for 7 days
        maxSize: '50m',
        zippedArchive: true,
      }),
      // Errors - critical for investigation
      new DailyRotate({
        filename: `${logDir}/%DATE%-error-results.log`,
        datePattern: 'YYYY-MM-DD',
        level: 'error',
        maxFiles: '30d', // Keep errors longer
        maxSize: '20m',
        zippedArchive: true,
      }),
      // Info - general application flow
      new DailyRotate({
        filename: `${logDir}/%DATE%-info-results.log`,
        datePattern: 'YYYY-MM-DD',
        level: 'info',
        maxFiles: '14d',
        maxSize: '20m',
        zippedArchive: true,
      }),
      // Warnings - potential issues
      new DailyRotate({
        filename: `${logDir}/%DATE%-warning-results.log`,
        datePattern: 'YYYY-MM-DD',
        level: 'warn',
        maxFiles: '30d',
        maxSize: '20m',
        zippedArchive: true,
      }),
    ];

    // Only add CloudWatch transport on primary worker (worker 0) to avoid duplicate logs
    // Each worker should log to CloudWatch with its own log stream
    const instanceId = parseInt(process.env.INSTANCE_ID || '0', 10);

    // Enable CloudWatch in production with valid AWS credentials
    const isProduction = appConfig?.env === 'production';
    const hasAwsConfig = aws?.cloudWatchLogGroup && aws?.region && aws?.accessKeyId && aws?.secretAccessKey;

    if (isProduction && hasAwsConfig) {
      try {
        // AWS CloudWatch Transport Configuration - Each worker gets its own stream
        const cloudWatchConfig = {
          logGroupName: aws.cloudWatchLogGroup,
          logStreamName: `${env}-worker-${instanceId}-${new Date().toISOString().split('T')[0]}`, // Unique per worker
          awsRegion: aws.region,
          awsAccessKeyId: aws.accessKeyId,
          awsSecretAccessKey: aws.secretAccessKey,
          retentionInDays: 30,
          jsonMessage: true,
          createLogGroup: true,
          createLogStream: true,
          uploadRate: 5000, // Upload every 5 seconds
          errorHandler: (error) => {
            // Only log critical CloudWatch errors, not every upload retry
            if (!error.message?.includes('retrying')) {
              console.error('[CloudWatch] Upload error:', error.message);
            }
          },
        };

        const cwTransport = new CloudWatchTransport(cloudWatchConfig);
        
        // Handle CloudWatch-specific errors
        cwTransport.on('error', (error) => {
          console.error('[CloudWatch] Transport error:', error.message);
        });

        transports.push(cwTransport);
        console.log(`[Logger] CloudWatch transport enabled for worker ${instanceId}`);
      } catch (error) {
        console.error('[Logger] Failed to initialize CloudWatch transport:', error.message);
        console.warn('[Logger] Continuing with file-based logging only');
      }
    } else {
      if (!isProduction) {
        console.log('[Logger] CloudWatch disabled in non-production environment');
      } else if (!hasAwsConfig) {
        console.warn('[Logger] CloudWatch disabled - missing AWS configuration');
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
          const forCloudWatch = isPrimaryWorker && isProduction && hasAwsConfig;
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
      // Handle unhandled exceptions and rejections
      exceptionHandlers: [
        new DailyRotate({
          filename: `${logDir}/%DATE%-exceptions.log`,
          datePattern: 'YYYY-MM-DD',
          maxFiles: '30d',
          maxSize: '20m',
          zippedArchive: true,
        }),
      ],
      rejectionHandlers: [
        new DailyRotate({
          filename: `${logDir}/%DATE%-rejections.log`,
          datePattern: 'YYYY-MM-DD',
          maxFiles: '30d',
          maxSize: '20m',
          zippedArchive: true,
        }),
      ],
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
  }

  // Graceful shutdown - flush all transports
  async close() {
    return new Promise((resolve) => {
      this.#logger.on('finish', () => resolve());
      this.#logger.end();
    });
  }
}

export default Logger;
const winstonLogger = new Logger();

// Helper to check if current worker should log shared events
const isPrimaryWorker = () => {
  const instanceId = parseInt(process.env.INSTANCE_ID || '0', 10);
  return instanceId === 0;
};

export const logger = {
  log: (message, meta) => winstonLogger.log('info', message, meta),
  info: (message, meta) => winstonLogger.log('info', message, meta),
  warn: (message, meta) => winstonLogger.log('warn', message, meta),
  error: (message, meta) => winstonLogger.log('error', message, meta),
  debug: (message, meta) => winstonLogger.log('debug', message, meta),
  
  // Only log from worker 0 to avoid duplicates for shared events (startup, config, etc.)
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
