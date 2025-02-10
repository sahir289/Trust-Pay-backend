import fs from 'fs';
import { createLogger, format } from 'winston';
import DailyRotate from 'winston-daily-rotate-file';
import CloudWatchTransport from 'winston-cloudwatch';
import appConfig from '../config/config.js';
import chalk from 'chalk';

const env = appConfig?.env;
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
        format.errors({stack: true}),
        format.timestamp({ format: 'YYYY-MM-DD hh:mm:ss' }),
        format.printf(info => `${info.timestamp} ${info.level}: ${info.message} ${info.splat || ""} ${info.stack || ""}`)
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
    const typeStr = ` ${level.toUpperCase()} `;
    const typeChalk = level === "error" ? chalk.bgRed(typeStr) : level === "warning" ? chalk.bgYellow(typeStr) : chalk.bgCyan(typeStr);
    const timestamp = new Date().toLocaleDateString();
    originalLog(`${typeChalk} ${timestamp}`, ...args);
    this.#logger.log(level, args.shift(), args);
  }
}

export default Logger;
const logger = new Logger();

console.log = (...args) => logger.log('info', ...args);

console.warn = (...args) => logger.log('warn', ...args);

console.error = (...args) => logger.log('error', ...args);
