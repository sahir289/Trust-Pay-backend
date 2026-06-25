import { createPayoutService } from '../../payOut/payOutService.js';
import { PAYOUT_DETAILS_SCHEMA } from '../../../schemas/payoutSchema.js';
import { ValidationError } from '../../../utils/appErrors.js';
import { invalidateCompanyCacheByPrefix } from '../../../utils/controllerCache.js';
import { sendV2Success, sendV2Error } from '../../../utils/responseHandlers.js';
import { STATUS_ERROR_CODES } from '../../../constants/index.js';

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
const createPayoutV2 = async (req, res) => {
  const payload = req.body;
  const fromUI = payload.fromUi || false;
  delete payload.fromUi;

  const joiValidation = PAYOUT_DETAILS_SCHEMA.validate(req.body);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }

  if (!payload.user_id && !payload.user) {
    throw new ValidationError('user_id is required');
  }
  payload.user = payload.user_id ? payload.user_id : payload.user;
  delete payload?.user_id;

  let result = {};
  if (req?.user) {
    const { company_id, role, user_id } = req.user;
    payload.company_id = company_id;
    payload.created_by = user_id;
    payload.updated_by = user_id;
    result = await createPayoutService(req.headers, payload, role, fromUI);
  } else {
    result = await createPayoutService(req.headers, payload, null, fromUI);
  }

  if (result.status === 400 || result.status === 404) {
    return sendV2Error(
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
  return sendV2Success(res, data, 'Payout created successfully', 201);
};

export { createPayoutV2 };
