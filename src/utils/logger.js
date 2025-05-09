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
        format.printf(({ message, statusCode, data }) => {
          return JSON.stringify({
            message,
            statusCode: statusCode || 200, // Default statusCode if not provided
            data: data || {},
          });
        }),
      ),
      transports,
      exitOnError: false,
    });
  }

  log(level, message, statusCode, data) {
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

    // Handle arguments
    let finalMessage = message || 'Log event';
    let finalStatusCode = statusCode || 200;
    let finalData = data || {};

    // If message is an object and statusCode/data are not provided, treat message as data
    if (typeof message === 'object' && !Array.isArray(message) && !statusCode && !data) {
      finalData = message;
      finalMessage = 'Log event';
      finalStatusCode = 200;
    }

    // Format args for console output
    const consoleArgs = [
      finalMessage,
      ...(typeof finalStatusCode === 'number' ? [finalStatusCode] : []),
      ...(Object.keys(finalData).length > 0 ? [JSON.stringify(finalData, null, 2).slice(0, 1000)] : []),
    ];
    originalLog(`${typeChalk} : ${timestamp} ::`, ...consoleArgs);

    // Log to Winston
    this.#logger.log({
      level,
      message: finalMessage,
      statusCode: finalStatusCode,
      data: finalData,
    });
  }
}

export default Logger;
const winstonLogger = new Logger();

export const logger = {
  log: (message, statusCode, data) => winstonLogger.log('info', message, statusCode, data),
  info: (message, statusCode, data) => winstonLogger.log('info', message, statusCode, data),
  warn: (message, statusCode, data) => winstonLogger.log('warn', message, statusCode, data),
  error: (message, statusCode, data) => winstonLogger.log('error', message, statusCode, data),
};