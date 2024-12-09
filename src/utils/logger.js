import fs from 'fs';
import { createLogger, format, transports } from 'winston';
import DailyRotate from 'winston-daily-rotate-file';
import CloudWatchTransport from 'winston-cloudwatch';
import appConfig from '../config/config.js';

const env = appConfig?.env;
const aws = appConfig?.aws;
const logDir = 'log';

class Logger {
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

    this.infoLogger = createLogger({
      // change level if in dev environment versus production
      level: env === 'stg' ? 'info' : 'debug',
      format: format.combine(
        format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss',
        }),
        format.printf(
          (info) => `${info.timestamp} ${info.level}: ${info.message}`,
        ),
        // this is to log in json format
        // format.json()
      ),
      transports: [
        new transports.Console({
          levels: 'info',
          format: format.combine(
            format.colorize(),
            format.printf(
              (info) => `${info.timestamp} ${info.level}: ${info.message}`,
            ),
          ),
        }),

        new DailyRotate({
          filename: `${logDir}/%DATE%-info-results.log`,
          datePattern: 'YYYY-MM-DD',
        }),
        new CloudWatchTransport(cloudWatchConfig),
      ],
      exitOnError: false,
    });

    this.errorLogger = createLogger({
      // change level if in dev environment versus production
      format: format.combine(
        format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss',
        }),
        format.printf(
          (error) => `${error.timestamp} ${error.level}: ${error.message}`,
        ),
      ),
      transports: [
        new transports.Console({
          levels: 'error',
          format: format.combine(
            format.colorize(),
            format.printf(
              (error) => `${error.timestamp} ${error.level}: ${error.message}`,
            ),
          ),
        }),

        new DailyRotate({
          filename: `${logDir}/%DATE%-errors-results.log`,
          datePattern: 'YYYY-MM-DD',
        }),
        new CloudWatchTransport(cloudWatchConfig),
      ],
      exitOnError: false,
    });

    this.warnLogger = createLogger({
      // change level if in dev environment versus production
      format: format.combine(
        format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss',
        }),
        format.printf(
          (warn) => `${warn.timestamp} ${warn.level}: ${warn.message}`,
        ),
      ),
      transports: [
        new transports.Console({
          levels: 'warn',
          format: format.combine(
            format.colorize(),
            format.printf(
              (warn) => `${warn.timestamp} ${warn.level}: ${warn.message}`,
            ),
          ),
        }),

        new DailyRotate({
          filename: `${logDir}/%DATE%-warnings-results.log`,
          datePattern: 'YYYY-MM-DD',
        }),
      ],
      exitOnError: false,
    });

    this.allLogger = createLogger({
      // change level if in dev environment versus production
      format: format.combine(
        format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss',
        }),
        format.printf(
          (silly) => `${silly.timestamp} ${silly.level}: ${silly.message}`,
        ),
      ),
      transports: [
        new DailyRotate({
          filename: `${logDir}/%DATE%-results.log`,
          datePattern: 'YYYY-MM-DD',
        }),
      ],
      exitOnError: false,
    });
  }

  log(message, severity, data) {
    if (severity === 'info' || severity === 'debug') {
      this.infoLogger.log(severity, message, data);
      this.allLogger.log(severity, message, data);
    } else if (severity === 'error') {
      this.errorLogger.log(severity, message);
      this.allLogger.log(severity, message, data);
    } else if (severity === 'warn') {
      this.warnLogger.log(severity, message, data);
      this.allLogger.log(severity, message, data);
    }
  }
}

export default Logger;
