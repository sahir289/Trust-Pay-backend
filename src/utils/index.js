import multer from 'multer';
import multerS3 from 'multer-s3';
import { s3 } from '../helpers/Aws.js';
import config from '../config/config.js';
import {
  getPayInForExpireDao,
  updatePayInUrlDao,
} from '../apis/payIn/payInDao.js';
import { Status } from '../constants/index.js';
import { BadRequestError } from './appErrors.js';
import { logger } from './logger.js';
import safeStringify from 'fast-safe-stringify';

let _multerUploadInstance = null;

const getMulterUpload = () => {
  if (!_multerUploadInstance) {
    if (!config.bucketName) {
      logger.warn('BUCKET_NAME is not set — S3 file upload will not work.');
    }
    _multerUploadInstance = multer({
      storage: multerS3({
        s3: s3,
        bucket: config.bucketName || 'default-bucket',
        acl: 'public-read',
        key: function (req, file, cb) {
          cb(null, `uploads/${Date.now()}-${file.originalname}`);
        },
      }),
      limits: { fileSize: 50 * 1024 * 1024 },
    });
  }
  return _multerUploadInstance;
};

export const multerUpload = new Proxy(
  {},
  {
    get(_, prop) {
      return getMulterUpload()[prop];
    },
  },
);

export const parseJSON = (data) => {
  try {
    return JSON.parse(data);
  } catch (err) {
    logger.error(err);
    return {};
  }
};

export const stringifyJSON = (data) => {
  try {
    return safeStringify(data);
  } catch (err) {
    logger.error(err);
    return '{}';
  }
};

const scheduledJobs = new Map();
export async function expirePayInIfNeeded(payInId) {
  if (scheduledJobs.has(payInId)) {
    logger.error(`PayIn ${payInId} task is already scheduled.`);
    return;
  }

  const timeout = setTimeout(
    async () => {
      try {
        const payIn = await getPayInForExpireDao({ id: payInId });
        if (!payIn) {
          throw new BadRequestError('Payin not found!', payInId);
        }
        if (![Status.INITIATED, Status.ASSIGNED].includes(payIn.status)) {
          logger.log('Status is not initiated or assigned', payIn.status);
          return;
        }

        await updatePayInUrlDao(payInId, { status: Status.DROPPED });
      } catch (error) {
        logger.error(`Error executing PayIn ${payInId} task:`, error);
      } finally {
        scheduledJobs.delete(payInId);
      }
    },
    10 * 60 * 1000,
  );

  // set in scheduledJobs
  scheduledJobs.set(payInId, timeout);
}
