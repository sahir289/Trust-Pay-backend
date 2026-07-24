
import { BadRequestError, ValidationError } from '../../../utils/appErrors.js';
import { sendSuccess } from '../../../utils/responseHandlers.js';
import { Role } from '../../../constants/index.js';
import { CREATE_BANK_RESPONSE_V2_SCHEMA } from '../../../schemas/bankResponseSchema.js';
import { publishBankResponse, publishBankResponseBotBulk } from '../../../rabbitmq/producer.js';
import { markStatementUploadedDao } from '../../bankAccounts/bankaccountDao.js';
import { notifyStatementUploadCleared } from '../../../utils/sockets.js';
import logger from '../../../utils/logger.js';
import { BULK_PUBLISH_CONCURRENCY, BULK_PUBLISH_MAX_ITEMS } from '../../bankResponse/bankResponseController.js';

export const createBankBotV2Response = async (req, res) => {
  
  const company_id = req.vendor?.company_id;
  const payload = req.body;
  const { error } = CREATE_BANK_RESPONSE_V2_SCHEMA.validate(req.body);
  if (error) {
    throw new ValidationError(error);
  }

  const bankResponseObject = {
    payload,
    company_id,
    role:Role.BOT,
  };
  const result = await publishBankResponse(bankResponseObject);
  // const result = await createBankResponseService(
  //   payload,
  //   company_id,
  //   Role.BOT,
  //   null,
  // );
  // await newTableEntry(tableName.BANK_RESPONSE);
  sendSuccess(res, result, 'Created Bank Bot Response successfully');
};

export const createBankBotV2ResponseBulk = async (req, res) => {
  const x_auth_token = req.vendor?.company_id;
  const payloads = req.body?.body; // Expecting an array

  if (!Array.isArray(payloads)) {
    throw new BadRequestError('body must be an array of payloads');
  }

  if (payloads.length > BULK_PUBLISH_MAX_ITEMS) {
    throw new BadRequestError(
      `Bulk payload too large. Max allowed is ${BULK_PUBLISH_MAX_ITEMS}`,
    );
  }

  // Validate all payloads and collect errors/indexes
  const invalidIndexes = [];
  const invalidPayloads = [];
  const validationErrors = [];

  const validMessages = [];

  payloads.forEach((payload, idx) => {
    const { error } = CREATE_BANK_RESPONSE_V2_SCHEMA.validate(payload);
    if (error) {
      invalidIndexes.push(idx);
      invalidPayloads.push({ index: idx, payload, error: error.message });
      validationErrors.push(error.message);
    } else {
      validMessages.push({
        payload,
        x_auth_token,
        role: Role.BOT,
        name: 'PDF Response',
      });
    }
  });

  let publishedCount = 0;
  let publishFailed = 0;

  for (let i = 0; i < validMessages.length; i += BULK_PUBLISH_CONCURRENCY) {
    const chunk = validMessages.slice(i, i + BULK_PUBLISH_CONCURRENCY);
    const results = await Promise.allSettled(
      chunk.map((message) => publishBankResponseBotBulk(message)),
    );

    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value) {
        publishedCount += 1;
      } else {
        publishFailed += 1;
      }
    });
  }

  // Mark statement_upload as uploaded for each unique bank
  if (publishedCount > 0) {
    const uniqueBankIds = [
      ...new Set(
        validMessages.map((m) => String(m.payload).split(' ')[3]).filter(Boolean),
      ),
    ];

    await Promise.allSettled(
      uniqueBankIds.map(async (bankId) => {
        try {
          const result = await markStatementUploadedDao({
            id: bankId,
            company_id: x_auth_token,
          });
          if (result) {
            await notifyStatementUploadCleared({
              bankId,
              nickName: result.nick_name,
              userId: result.user_id,
              message: `Statement uploaded for "${result.nick_name}".`,
              timestamp: new Date().toISOString(),
            });
          }
        } catch (err) {
          logger.error('[BulkBotResponse] Failed to mark statement uploaded', {
            bankId,
            error: err.message,
          });
        }
      }),
    );
  }

  const status =
    invalidIndexes.length === 0 && publishFailed === 0
      ? 'All messages published successfully'
      : publishedCount === 0
      ? 'No messages published'
      : `Published: ${publishedCount}, Invalid: ${invalidIndexes.length}, Failed: ${publishFailed}`;

  sendSuccess(
    res,
    {
      published: publishedCount,
      publishFailed,
      invalid: invalidIndexes.length,
      invalidIndexes,
      invalidPayloads,
      validationErrors,
      status: 202,
    },
    status
  );
};
