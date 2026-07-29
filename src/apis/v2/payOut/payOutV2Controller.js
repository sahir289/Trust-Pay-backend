import { PAYOUT_DETAILS_V2_SCHEMA, VALIDATE_CHECK_PAY_OUT_V2_STATUS } from '../../../schemas/payoutSchema.js';
import { BadRequestError, ValidationError } from '../../../utils/appErrors.js';
import { generateCacheKey, setCachedDataIfNotExists } from '../../../utils/redishashkey.js';
import { sendError, sendSuccess } from '../../../utils/responseHandlers.js';
import { checkPayOutStatusV2Service, createPayoutV2Service, getWalletBalanceService } from './payOutV2Service.js';
import config from '../../../config/config.js';



// idempotency({ required: true }). All replay/signature protection is default-OFF and activates only when its feature flag is enabled.

const PAYOUT_CREATE_INFLIGHT_TTL_SEC =
  config?.controllerCacheTtls?.payout?.createInflight || 5;
export const createPayoutV2 = async (req, res) => {
  const code = req.headers['x-auth-code'];
  let payload = req.body;

  const joiValidation = PAYOUT_DETAILS_V2_SCHEMA.validate(req.body);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }

  const cacheKey = generateCacheKey(
    {
      user: payload.user ?? null,
      amount: payload.amount ?? null,
      accountNumber: payload.accountNumber ?? null,
      accountHolderName: payload.accountHolderName ?? null,
      merchantOrderId: payload.merchantOrderId ?? null,
      ifscCode: payload.ifscCode ?? null,
      bankName: payload.bankName ?? null,
      notifyUrl: payload.notifyUrl ?? null,
    },
    'createPayout',
  );
  const lockAcquired = await setCachedDataIfNotExists(
    cacheKey,
    '1',
    PAYOUT_CREATE_INFLIGHT_TTL_SEC,
    'createPayout_inflight',
  );
  if (!lockAcquired) {
    return sendError(res, 'Duplicate payout request is already being processed', 429);
  }
  let result = {};

    payload._merchantData = req.merchant || null;
    result = await createPayoutV2Service(
      req.headers,
      {...payload, code}
    );

  const data = {
    merchantOrderId: result.merchant_order_id,
    payoutId: result.id,
    amount: result.amount,
    accountNumber: result.acc_no,
    ifscCode: result.ifsc_code,
    bankName: result.bank_name,
    accountHolderName: result.acc_holder_name,
  };

  // Send a success response to the client
  if (result.status === 400 || result.status === 404) {
    return sendError(res, result.message, result.status);
  } else {
    return sendSuccess(res, data, 'Payout created successfully', 201);
  }
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
  return sendSuccess(res, data, 'PayOut status fetched successfully');
};

export const getWalletBalanceV2 = async (req, res) => {
  const code = req.headers['x-auth-code'];
  if (!code) throw new BadRequestError('x-auth-code is required');

  const data = await getWalletBalanceService(code);
  return sendSuccess(res, data, 'Wallet balance fetched successfully');
};

