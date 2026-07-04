import { createPayoutService } from '../../payOut/payOutService.js';
import { PAYOUT_DETAILS_V2_SCHEMA, VALIDATE_CHECK_PAY_OUT_V2_STATUS } from '../../../schemas/payoutSchema.js';
import { BadRequestError, ValidationError } from '../../../utils/appErrors.js';
import { invalidateCompanyCacheByPrefix } from '../../../utils/controllerCache.js';
import { sendError, sendSuccess } from '../../../utils/responseHandlers.js';
import { STATUS_ERROR_CODES } from '../../../constants/index.js';
import { checkPayOutStatusV2Service, getWalletBalanceService } from './payOutV2Service.js';

/**
 * POST /v2/payOut/create-payout
 *
 * v2 twin of the v1 `createPayout`. Reuses the SAME `createPayoutService`
 * (identical financial behavior) and the same validation + cache invalidation;
 * only the response envelope is the standardized v2 shape. The service returns
 * a non-throwing { status, message } object for expected 400/404 outcomes,
 * which is mapped to sendV2Error; unexpected errors throw and are shaped by the
 * v2 error handler.
 *
 * Route guards (see ./index.js): checkMerchantApiKeyV2 -> verifyRequestSignature
 * -> idempotency({ required: true }). All replay/signature protection is
 * default-OFF and activates only when its feature flag is enabled.
 */
export const createPayoutV2 = async (req, res) => {
  const code = req.headers['x-auth-code'];
  const payload = req.body;

  const joiValidation = PAYOUT_DETAILS_V2_SCHEMA.validate(req.body);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }

  const result = await createPayoutService(req.headers, {...payload, code});

  if (result.status === 400 || result.status === 404) {
    return sendError(
      res,
      result.message,
      result.status,
      STATUS_ERROR_CODES[result.status],
    );
  }

  await invalidateCompanyCacheByPrefix(
    req.user?.company_id || payload.company_id,
    'payout:read:',
    'PayOut cache',
  );

  const data = {
    merchantOrderId: result.merchant_order_id,
    payoutId: result.id,
    amount: result.amount,
  };
  return sendSuccess(res, data, 'Payout created successfully', 201);
};

export const checkPayOutV2Status = async (req, res) => {
  const joiValidation = VALIDATE_CHECK_PAY_OUT_V2_STATUS.validate(req.body);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  const code = req.headers['x-auth-code'];
  const data = await checkPayOutStatusV2Service(
    code,
    req.body.merchantOrderId,
  );
  // sendSuccess(res, data);
  if (data.status === 400 || data.status === 404) {
    return sendError(res, data.message, data.status);
  } else {
    return sendSuccess(res, data, 'PayOut status fetched successfully');
  }
};

export const getWalletBalanceV2 = async (req, res) => {
  const code = req.headers['x-auth-code'];
  if (!code) throw new BadRequestError('x-auth-code is required');

  const data = await getWalletBalanceService(code);
  return sendSuccess(res, data, 'Wallet balance fetched successfully');
};

