import fs from 'fs';
import { createLogger, format } from 'winston';
import DailyRotate from 'winston-daily-rotate-file';
import CloudWatchTransport from 'winston-cloudwatch';
import appConfig from '../config/config.js';
import chalk from 'chalk';

const env = appConfig?.nodeProductionLogs;
const aws = appConfig?.aws;
const logDir = 'log';

const originalLog = console.log;

class Logger {
  #logger;
  constructor() {
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir);
    }

    // AWS CloudWatch Transport Configuration
    const cloudWatchConfig = {
      logGroupName: aws.cloudWatchLogGroup, // Log group name in CloudWatch
      logStreamName: `${env}-logs`, // Stream name (e.g., environment-specific)
      awsRegion: aws.region, // AWS region (e.g., 'us-east-1')
      awsAccessKeyId: aws.accessKeyId, // From appConfig or environment variables
      awsSecretAccessKey: aws.secretAccessKey, // From appConfig or environment variables
      retentionInDays: 7, // Optional: Retain logs for 7 days
    };

    this.#logger = createLogger({
      format: format.combine(
        format.errors({ stack: true }),
        format.timestamp({ format: 'YYYY-MM-DD hh:mm:ss' }),
        format.printf(
          (info) =>
            `${info.timestamp} ${info.level}: ${info.message} ${info.splat || ''} ${info.stack || ''}`,
        ),
      ),
      transports: [
        new DailyRotate({
          filename: `${logDir}/%DATE%-error-results.log`,
          datePattern: 'YYYY-MM-DD',
          level: 'error',
        }),
        new DailyRotate({
          filename: `${logDir}/%DATE%-info-results.log`,
          datePattern: 'YYYY-MM-DD',
          level: 'info',
        }),
        new DailyRotate({
          filename: `${logDir}/%DATE%-warning-results.log`,
          datePattern: 'YYYY-MM-DD',
          level: 'warning',
        }),
        new CloudWatchTransport(cloudWatchConfig),
      ],
      exitOnError: false,
    });
  }

  log(level, ...args) {
    const typeChalk =
      level === 'error'
        ? chalk.red(level)
        : level === 'warning'
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
    originalLog(`${typeChalk} : ${timestamp} ::`, ...args);
    this.#logger.log(level, args.shift(), args);
  }
}

export default Logger;
const winstonLogger = new Logger();

export const logger = {
  log: (...args) => winstonLogger.log('info', ...args),
  info: (...args) => winstonLogger.log('info', ...args),
  warn: (...args) => winstonLogger.log('warn', ...args),
  error: (...args) => winstonLogger.log('error', ...args),
}