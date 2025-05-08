import fs from 'fs';
import { createLogger, format } from 'winston';
import DailyRotate from 'winston-daily-rotate-file';
import CloudWatchTransport from 'winston-cloudwatch';
import appConfig from '../config/config.js';
import chalk from 'chalk';

const env = appConfig?.env || 'development';
const aws = appConfig?.aws || {};
const logDir = 'log';

const originalLog = console.log;

// Validate AWS configuration
const { cloudWatchLogGroup, region, accessKeyId, secretAccessKey } = aws;
const hasCloudWatchConfig = cloudWatchLogGroup && region && accessKeyId && secretAccessKey;

class Logger {
  #logger;
  constructor() {
    // Create log directory if it doesn't exist
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir);
    }

    // Define transports
    const transports = [
      new DailyRotate({
        filename: `${logDir}/%DATE%-error-results.log`,
        datePattern: 'YYYY-MM-DD',
        level: 'error',
        maxFiles: '14d',
        maxSize: '20m',
      }),
      new DailyRotate({
        filename: `${logDir}/%DATE%-info-results.log`,
        datePattern: 'YYYY-MM-DD',
        level: 'info',
        maxFiles: '14d',
        maxSize: '20m',
      }),
      new DailyRotate({
        filename: `${logDir}/%DATE%-warn-results.log`,
        datePattern: 'YYYY-MM-DD',
        level: 'warn',
        maxFiles: '14d',
        maxSize: '20m',
      }),
    ];

    // Add CloudWatch transport if configuration is complete
    if (hasCloudWatchConfig) {
      const cloudWatchConfig = {
        logGroupName: cloudWatchLogGroup,
        logStreamName: `${env}-logs`,
        awsRegion: region,
        awsAccessKeyId: accessKeyId,
        awsSecretAccessKey: secretAccessKey,
        retentionInDays: 7,
        onError: (err) => originalLog(chalk.red('CloudWatch logging error:'), err),
      };
      transports.push(new CloudWatchTransport(cloudWatchConfig));
    } else {
      originalLog(
        chalk.yellow(
          'Warning: CloudWatch transport skipped due to missing AWS configuration (cloudWatchLogGroup, region, accessKeyId, or secretAccessKey)',
        ),
      );
    }

    // Initialize Winston logger
    this.#logger = createLogger({
      format: format.combine(
        format.errors({ stack: true }),
        format.timestamp({
          format: () => new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }),
        }),
        format.metadata(),
        format.json(),
      ),
      transports,
      exitOnError: false,
    });
  }

  log(level, ...args) {
    const typeChalk =
      level === 'error'
        ? chalk.red(level)
        : level === 'warn'
          ? chalk.yellowBright(level)
          : chalk.cyanBright(level);
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
    const timestamp = new Date()
      .toLocaleString('en-US', options)
      .replace(',', '');

    // Handle args: If only one arg and it's an object, treat it as metadata
    let message = '';
    let metadata = {};
    if (args.length === 1 && typeof args[0] === 'object' && !Array.isArray(args[0])) {
      metadata = args[0];
      message = 'Log event'; // Default message
    } else {
      message = args[0] || '';
      metadata = args.length > 1 && typeof args[1] === 'object' ? args[1] : {};
    }

    // Format args for console output
    const formattedArgs = args.map((arg) =>
      typeof arg === 'object' ? JSON.stringify(arg, null, 2).slice(0, 1000) : arg,
    );
    originalLog(`${typeChalk} : ${timestamp} ::`, ...formattedArgs);

    // Log to Winston
    this.#logger.log(level, message, metadata);
  }
}

export default Logger;
const winstonLogger = new Logger();

export const logger = {
  log: (...args) => winstonLogger.log('info', ...args),
  info: (...args) => winstonLogger.log('info', ...args),
  warn: (...args) => winstonLogger.log('warn', ...args),
  error: (...args) => winstonLogger.log('error', ...args),
};