import config from '../../../config/config.js';
import {
  GENERATE_PAYIN_V2_SCHEMA,
  VALIDATE_CHECK_PAY_IN_V2_STATUS,
} from '../../../schemas/payInSchema.js';
import {
  checkPayInStatusV2Service,
  generatePayInUrlV2Service,
} from './payInV2Service.js';
import { BadRequestError, ValidationError } from '../../../utils/appErrors.js';
import { sendV2Success, sendV2Error } from '../../../utils/responseHandlers.js';
import { STATUS_ERROR_CODES, V2_ERROR_CODES } from '../../../constants/index.js';

/**
 * POST /v2/payIn/check-payin-status — v2 twin of the v1 status-check endpoint.
 *
 * Reuses the EXACT same `checkPayInStatusService` as v1 (no business-logic
 * duplication); only the response envelope differs (standardized v2 contract via
 * sendV2Success / sendV2Error). The v1 controller/route is left untouched.
 *
 * Validation and expected service errors are returned as v2 envelopes here
 * rather than thrown, so a v2 client always receives the v2 shape.
 */
export const checkPayInStatusV2 = async (req, res) => {
  const joiValidation = VALIDATE_CHECK_PAY_IN_V2_STATUS.validate(req.body);
  if (joiValidation.error) {
    return sendV2Error(res, joiValidation.error.message, 400, V2_ERROR_CODES.VALIDATION_ERROR, {
      details: joiValidation.error.details,
    });
  }

  const code = req.headers['x-auth-code'];
  const data = await checkPayInStatusV2Service(
    req.body.merchantOrderId,
    code
  );

  if (data.status === 400 || data.status === 404) {
    const code = STATUS_ERROR_CODES[data.status] || V2_ERROR_CODES.ERROR;
    return sendV2Error(res, data.message, data.status, code);
  }

  return sendV2Success(res, data, 'PayIn status fetched successfully');
};

/**
 * GET /v2/payIn/generate-payin — v2 twin of the v1 generate-payin endpoint.
 *
 * Reuses the EXACT same `generatePayInUrlService` as v1 (no business-logic
 * duplication); only the response envelope differs (standardized v2 contract).
 * The service returns a non-throwing { status, message } object for expected
 * 400/404 outcomes, which is mapped to sendV2Error; validation/order-id errors
 * are thrown and shaped by the v2 error handler. The v1 controller/route is
 * left untouched.
 *
 * Route guards (see ./index.js): checkMerchantApiKeyV2 -> verifyRequestSignature
 * -> idempotency. checkMerchantApiKeyV2 authenticates the merchant via the
 * `x-api-key` header (v2 standardizes on header auth — no API keys in query
 * strings) and attaches req.merchant; there is no admin/roleToken backdoor, so
 * `role` is always null on this surface.
 */
export const generatePayInV2 = async (req, res) => {
  const payload = req.body;

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
  const code = req.headers['x-auth-code'];

  const result = await generatePayInUrlV2Service(
    { ...payload, code },
    role,
  );

  if (result.status === 400 || result.status === 404) {
    const code = STATUS_ERROR_CODES[result.status] || V2_ERROR_CODES.ERROR;
    return sendV2Error(res, result.message, result.status, code);
  }

  const baseRes = {
    payinId: result?.id,
    merchantOrderId: result?.merchant_order_id,
    status: result?.status,
  };

  if (result.merchant?.h2h) {
    return sendV2Success(
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
  return sendV2Success(res, data, 'PayIn is generated & url is sent successfully');
};
