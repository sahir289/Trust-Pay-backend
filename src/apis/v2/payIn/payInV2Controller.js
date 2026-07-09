import config from '../../../config/config.js';
import {
  GENERATE_PAYIN_V2_SCHEMA,
  VALIDATE_CHECK_PAY_IN_V2_STATUS,
  VALIDATE_PROCESS_V2_PAYIN,
} from '../../../schemas/payInSchema.js';
import {
  checkPayInStatusV2Service,
  generatePayInUrlV2Service,
} from './payInV2Service.js';
import { BadRequestError, ValidationError } from '../../../utils/appErrors.js';
import { sendError, sendSuccess } from '../../../utils/responseHandlers.js';
import { Status, STATUS_ERROR_CODES, V2_ERROR_CODES } from '../../../constants/index.js';
import { publishPayInProcess } from '../../../rabbitmq/producer.js';

export const checkPayInStatusV2 = async (req, res) => {
  const merchant  = req.merchant;
  const joiValidation = VALIDATE_CHECK_PAY_IN_V2_STATUS.validate(req.body);
  if (joiValidation.error) {
    return sendError(res, joiValidation.error.message, 400, V2_ERROR_CODES.VALIDATION_ERROR, {
      details: joiValidation.error.details,
    });
  }

  const data = await checkPayInStatusV2Service(
    req.body.merchantOrderId,
    merchant,
  );

  if (data.status === 400 || data.status === 404) {
    const code = STATUS_ERROR_CODES[data.status] || V2_ERROR_CODES.ERROR;
    return sendError(res, data.message, data.status, code);
  }

  return sendSuccess(res, data, 'PayIn status fetched successfully');
};

/**
 * -> idempotency. checkMerchantApiKeyV2 authenticates the merchant via the
 * `x-api-key` header (v2 standardizes on header auth — no API keys in query
 * strings) and attaches req.merchant; there is no admin/roleToken backdoor, so
 * `role` is always null on this surface.
 */
export const generatePayInV2 = async (req, res) => {
  const payload = req.body;
  const merchant = req.merchant;
 
  if (payload.merchant_order_id?.includes('/')) {
    throw new BadRequestError("Invalid order ID: '/' is not allowed.");
  }

  const joiValidation = GENERATE_PAYIN_V2_SCHEMA.validate(payload);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }

  // req.merchant is the authenticated merchant (checkMerchantApiKeyV2). The
  // validated x-api-key only seeds the service's routing cache key; the service
  // authorizes by `code`, exactly as in v1.
  const role = null;
  // const code = req.headers['x-auth-code'];

  const result = await generatePayInUrlV2Service(
    { ...payload, merchant },
    role,
  );

  if (result.status === 400 || result.status === 404) {
    const code = STATUS_ERROR_CODES[result.status] || V2_ERROR_CODES.ERROR;
    return sendError(res, result.message, result.status, code);
  }

  const baseRes = {
    payinId: result?.id,
    merchantOrderId: result?.merchant_order_id,
    status: result?.status,
  };

  if (result.merchant?.h2h) {
    return sendSuccess(
      res,
      {
        ...baseRes,
        bank: result?.bank,
        type: result?.type,
        amount: result?.amount,
      },
      'PayIn is generated successfully',
    );
  }

  const data = {
    ...baseRes,
    expirationDate: result?.expiration_date,
    payInUrl: `${config.reactPaymentOrigin}/transaction?order=${result?.merchant_order_id}`,
  };
  return sendSuccess(res, data, 'PayIn is generated & url is sent successfully');
};

export const processPayInH2H = async (req, res) => {
  const payload = {
    ...req.body,
    ...req.params,
  };
  const joiValidation = VALIDATE_PROCESS_V2_PAYIN.validate(payload);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  await publishPayInProcess({
    payload,
    isH2H: true,
  });

  const data = {
    queued: true,
    merchantOrderId: payload.merchantOrderId,
    mode: 'h2h',
    status: Status.PROCESSING,
  };

  sendSuccess(res, data, 'PayIn request queued successfully', 202);
};
