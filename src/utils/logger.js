import fs from 'fs';
import { createLogger, format } from 'winston';
import DailyRotate from 'winston-daily-rotate-file';
import { CloudWatchLogsClient, PutLogEventsCommand, CreateLogStreamCommand } from '@aws-sdk/client-cloudwatch-logs';
import appConfig from '../config/config.js';
import chalk from 'chalk';

const env = appConfig?.env || 'development';
const aws = appConfig?.aws || {};
const logDir = 'log';

const originalLog = console.log;

// Validate AWS configuration
const { cloudWatchLogGroup, region, accessKeyId, secretAccessKey } = aws;
const hasCloudWatchConfig = cloudWatchLogGroup && region && accessKeyId && secretAccessKey;

class CloudWatchTransport {
  constructor(config) {
    this.logGroupName = config.logGroupName;
    this.logStreamName = config.logStreamName;
    this.client = new CloudWatchLogsClient({
      region: config.awsRegion,
      credentials: {
        accessKeyId: config.awsAccessKeyId,
        secretAccessKey: config.awsSecretAccessKey,
      },
    });
    this.sequenceToken = null;
    this.initializeLogStream();
  }

  async initializeLogStream() {
    try {
      await this.client.send(
        new CreateLogStreamCommand({
          logGroupName: this.logGroupName,
          logStreamName: this.logStreamName,
        })
      );
      originalLog(chalk.green(`CloudWatch log stream ${this.logStreamName} initialized`));
    } catch (err) {
      if (err.name !== 'ResourceAlreadyExistsException') {
        originalLog(chalk.red(`Failed to create CloudWatch log stream: ${err.message}`));
      }
    }
  }

  async log(info, callback) {
    try {
      const logEvent = {
        message: JSON.stringify({
          level: info.level,
          message: info.message,
          statusCode: info.statusCode,
          data: info.data,
          timestamp: new Date().toISOString(),
        }),
        timestamp: Date.now(),
      };

      const params = {
        logGroupName: this.logGroupName,
        logStreamName: this.logStreamName,
        logEvents: [logEvent],
        sequenceToken: this.sequenceToken,
      };

      const response = await this.client.send(new PutLogEventsCommand(params));
      this.sequenceToken = response.nextSequenceToken;
      callback();
    } catch (err) {
      originalLog(chalk.red(`CloudWatch log error: ${err.message}`));
      callback(err);
    }
  }
}

class Logger {
  #logger;
  constructor() {
    // Create log directory if it doesn't exist
    try {
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir);
        originalLog(chalk.green(`Created log directory: ${logDir}`));
      }
    } catch (err) {
      originalLog(chalk.red(`Failed to create log directory: ${err.message}`));
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
        logStreamName: `${env}-logs-${Date.now()}`,
        awsRegion: region,
        awsAccessKeyId: accessKeyId,
        awsSecretAccessKey: secretAccessKey,
      };
      try {
        transports.push(new CloudWatchTransport(cloudWatchConfig));
        originalLog(chalk.green('CloudWatch transport initialized'));
      } catch (err) {
        originalLog(chalk.red(`Failed to initialize CloudWatch transport: ${err.message}`));
      }
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
            message: message || 'Log event',
            statusCode: statusCode || 200,
            data: data || {},
          });
        }),
      ),
      transports,
      exitOnError: false,
    });
  }

  log(level, message, data) {
    // Debug: Log arguments to diagnose issues
    originalLog(
      chalk.gray(
        `DEBUG: level=${level}, message=${JSON.stringify(message)}, statusCode=${JSON.stringify(data?.status)}, data=${JSON.stringify(data?.data)}`,
      ),
    );

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
    let finalStatusCode = data?.status || 200;
    let finalData = data || {};

    // Backward compatibility: Handle old usage patterns
    if (arguments.length === 2 && typeof message === 'string' && typeof data === 'object') {
      // Case: logger.info('message', { data })
      finalData = data?.data || data;
      finalStatusCode = data?.status || 200;
    } else if (arguments.length === 1 && typeof message === 'object' && !Array.isArray(message)) {
      // Case: logger.info({ data })
      finalData = message;
      finalMessage = 'Log event';
      finalStatusCode = 200;
    } else if (arguments.length === 2 && typeof message === 'object' && !Array.isArray(message)) {
      // Case: logger.info({ data }, statusCode)
      finalData = message;
      finalStatusCode = data?.status || 200;
      finalMessage = 'Log event';
    }

    // Format args for console output
    const consoleArgs = [
      finalMessage,
      ...(Object.keys(finalData).length > 0 ? [JSON.stringify(finalData, null, 2).slice(0, 1000)] : []),
    ];
    originalLog(`${typeChalk} : ${timestamp} ::`, ...consoleArgs);

    // Log to Winston
    try {
      this.#logger.log({
        level,
        message: finalMessage,
        statusCode: finalStatusCode,
        data: finalData,
      });
    } catch (err) {
      originalLog(chalk.red(`Winston logging error: ${err.message}`));
    }
  }
}

export default Logger;
const winstonLogger = new Logger();

export const logger = {
  log: (message, data) => winstonLogger.log('info', message, data),
  info: (message, data) => winstonLogger.log('info', message, data),
  warn: (message, data) => winstonLogger.log('warn', message, data),
  error: (message, data) => winstonLogger.log('error', message, data),
};