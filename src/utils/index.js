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

// Only document/image/spreadsheet types are ever uploaded (bank statements,
// payout sheets, payment proof screenshots). Reject everything else up front.
const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
]);

// Strip any path components / unsafe characters from a user-supplied filename
// so it cannot influence the S3 key structure (path confusion / traversal).
const sanitizeUploadFilename = (name = 'file') => {
  const base = String(name).split(/[\\/]/).pop() || 'file';
  return base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'file';
};

export const multerUpload = multer({
  storage: multerS3({
    s3: s3,
    bucket: config.bucketName,
    acl: 'public-read', // Set the access control list (ACL) policy for the file
    key: function (req, file, cb) {
      cb(null, `uploads/${Date.now()}-${sanitizeUploadFilename(file.originalname)}`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_UPLOAD_MIME_TYPES.has(file.mimetype)) {
      return cb(null, true);
    }
    return cb(new BadRequestError(`Unsupported file type: ${file.mimetype}`));
  },
});

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
