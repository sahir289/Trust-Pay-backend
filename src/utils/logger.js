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
// const CLOUDWATCH_MAX_SIZE = 256 * 1024; // 256KB in bytes
const CLOUDWATCH_SAFE_SIZE = 240 * 1024; // 240KB to be safe

/**
 * Truncate log data to fit within CloudWatch limits
 * CloudWatch max event size is 256KB
 */
const truncateForCloudWatch = (data) => {
  const jsonString = JSON.stringify(data);
  const sizeInBytes = Buffer.byteLength(jsonString, 'utf8');

  if (sizeInBytes <= CLOUDWATCH_SAFE_SIZE) {
    return data;
  }

  // If message itself is too large, truncate it
  if (data.message && Buffer.byteLength(data.message, 'utf8') > 100000) {
    data.message = data.message.substring(0, 100000) + '... [TRUNCATED - Message too large]';
  }

  // Truncate stack traces
  if (data.stack && Buffer.byteLength(data.stack, 'utf8') > 50000) {
    data.stack = data.stack.substring(0, 50000) + '... [TRUNCATED - Stack too large]';
  }

  // Truncate metadata
  if (data.metadata) {
    const metaString = JSON.stringify(data.metadata);
    if (Buffer.byteLength(metaString, 'utf8') > 50000) {
      // Try to keep important fields
      const truncatedMeta = {
        ...data.metadata,
        _truncated: true,
        _originalSize: Buffer.byteLength(metaString, 'utf8'),
      };

      // Remove large fields one by one
      for (const key in truncatedMeta) {
        const fieldString = JSON.stringify(truncatedMeta[key]);
        if (Buffer.byteLength(fieldString, 'utf8') > 10000) {
          truncatedMeta[key] = '[TRUNCATED - Field too large]';
        }
      }

      data.metadata = truncatedMeta;
    }
  }

  // Final check - if still too large, strip metadata completely
  const finalString = JSON.stringify(data);
  if (Buffer.byteLength(finalString, 'utf8') > CLOUDWATCH_SAFE_SIZE) {
    return {
      level: data.level,
      message: data.message?.substring(0, 100000) || 'Log too large',
      timestamp: data.timestamp,
      _warning: 'Metadata removed - log exceeded CloudWatch size limit',
      _originalSize: sizeInBytes,
    };
  }

  return data;
};

class Logger {
  #logger;
  constructor() {
    // Ensure log directory exists with proper error handling
    try {
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
    } catch (error) {
      console.error(`Failed to create log directory: ${error.message}`);
      // Fallback to current directory if log dir creation fails
    }

    const transports = [
      new DailyRotate({
        filename: `${logDir}/%DATE%-error-results.log`,
        datePattern: 'YYYY-MM-DD',
        level: 'error',
        maxFiles: '30d', // Keep logs for 30 days
        maxSize: '20m', // Rotate when file reaches 20MB
        zippedArchive: true, // Compress old logs
      }),
      new DailyRotate({
        filename: `${logDir}/%DATE%-info-results.log`,
        datePattern: 'YYYY-MM-DD',
        level: 'info',
        maxFiles: '14d', // Keep info logs for 14 days
        maxSize: '20m',
        zippedArchive: true,
      }),
      new DailyRotate({
        filename: `${logDir}/%DATE%-warning-results.log`,
        datePattern: 'YYYY-MM-DD',
        level: 'warn',
        maxFiles: '30d',
        maxSize: '20m',
        zippedArchive: true,
      }),
    ];

    // Only add CloudWatch transport on primary worker (worker 0) to avoid race conditions
    // PM2 sets INSTANCE_ID env var, fallback to checking if we're the first worker
    const instanceId = parseInt(process.env.INSTANCE_ID || '0', 10);
    const isPrimaryWorker = instanceId === 0;

    // Only enable CloudWatch in production with valid AWS credentials
    const isProduction = appConfig?.env === 'production' || process.env.NODE_ENV === 'production';
    const hasAwsConfig = aws?.cloudWatchLogGroup && aws?.region && aws?.accessKeyId && aws?.secretAccessKey;

    if (isPrimaryWorker && isProduction && hasAwsConfig) {
      try {
        // AWS CloudWatch Transport Configuration - Only on primary worker
        const cloudWatchConfig = {
          logGroupName: aws.cloudWatchLogGroup,
          logStreamName: `${env}-logs-${new Date().toISOString().split('T')[0]}`, // Include date in stream
          awsRegion: aws.region,
          awsAccessKeyId: aws.accessKeyId,
          awsSecretAccessKey: aws.secretAccessKey,
          retentionInDays: 30,
          jsonMessage: true,
          createLogGroup: true,
          createLogStream: true,
          uploadRate: 5000, // Upload every 5 seconds (reduces AWS API calls in high-traffic scenarios)
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
        console.log('[Logger] CloudWatch transport enabled for worker 0');
      } catch (error) {
        console.error('[Logger] Failed to initialize CloudWatch transport:', error.message);
        console.warn('[Logger] Continuing with file-based logging only');
      }
    } else {
      if (!isProduction) {
        console.log('[Logger] CloudWatch disabled in non-production environment');
      } else if (!isPrimaryWorker) {
        console.log(`[Logger] CloudWatch disabled for worker ${instanceId} (only worker 0 uses CloudWatch)`);
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
        // Truncate logs before they go to any transport (including CloudWatch)
        format((info) => {
          // Only truncate for CloudWatch (when in production and primary worker)
          if (isPrimaryWorker && isProduction && hasAwsConfig) {
            return truncateForCloudWatch(info);
          }
          return info;
        })(),
        format.metadata({
          fillExcept: ['message', 'level', 'timestamp', 'stack'],
        }), // it will flatten metadata
        format.json(),
      ),
      transports,
      exitOnError: false,
      // Silence internal winston errors in production
      silent: false,
    });

    // Add console transport ONLY in non-production environments
    if (!isProduction) {
      this.#logger.add(
        new winston.transports.Console({
          format: format.combine(
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
            }),
          ),
        }),
      );
    }

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

export const logger = {
  log: (message, meta) => winstonLogger.log('info', message, meta),
  info: (message, meta) => winstonLogger.log('info', message, meta),
  warn: (message, meta) => winstonLogger.log('warn', message, meta),
  error: (message, meta) => winstonLogger.log('error', message, meta),
  debug: (message, meta) => winstonLogger.log('debug', message, meta),
  close: () => winstonLogger.close(), // Export close for graceful shutdown
};
