import axios from 'axios';
import FormData from 'form-data';
import { Status } from '../constants/index.js';
import { BadRequestError } from '../utils/appErrors.js';
import { logger } from '../utils/logger.js';
import { sendSuccess } from '../utils/responseHandlers.js';
import { customAlphabet } from 'nanoid';
import { getPayoutByTxnId } from '../apis/payOut/payOutDao.js';
import { getCompanyByIDDao, updateCompanyDao } from '../apis/company/companyDao.js';

//  Nanoid (alphanumeric, max 16 chars for OrderId) 
// "TXN" prefix (3 chars) + 10-digit timestamp (13 chars) = 16 chars total
const nanoid = customAlphabet(
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  3,
);

const BASE_URL = 'https://api.payinfintech.com';

/**
 * Abstraction for authentication headers.
 * To switch to secret key, change the implementation here.
 * @param {string} tokenOrKey
 * @returns {object}
 */
const getAuthHeaders = (tokenOrKey) => ({
  Authorization: `Bearer ${tokenOrKey}`, // Switch to e.g. 'X-Secret-Key': tokenOrKey later
});

//  Status code maps 
const PAYOUT_STATUS_MAP = {
  106: Status.APPROVED,
  107: Status.PENDING,
  108: Status.PENDING,
  109: Status.PENDING,
  110: Status.REJECTED,
  111: Status.REJECTED,
};

const CHECK_STATUS_MAP = {
  101: Status.APPROVED,
  102: Status.PENDING,
  105: Status.PENDING,
  103: Status.REJECTED,
  104: Status.REJECTED,
};

// Error messages for initiation codes 
const INITIATION_ERROR_MESSAGES = {
  101: 'PayInFintech: Validation error',
  102: 'PayInFintech: Authentication failed',
  103: 'PayInFintech: Insufficient balance',
  104: 'PayInFintech: Withdraw limit exceeded',
  105: 'PayInFintech: Service inactive',
};

//  Generate a unique OrderId (max 16 chars)
/**
 * Generate a unique transaction / order ID for PayInFintech.
 * Format: "PI" + last-10-digits-of-epoch-ms + 4-char random suffix = 16 chars.
 * Checks the DB for duplicates and regenerates on collision.
 * @returns {Promise<string>}
 */
export const generatePayInFintechOrderId = async () => {
  const ts = Date.now().toString().slice(-10); // 10 digits
  let orderId = `PI${ts}${nanoid(4)}`;         // Total length: 16 chars

  // Check for existing payout with the same OrderId (txnid)

  const existing = await getPayoutByTxnId(orderId);
  if (existing) {
    const ts2 = Date.now().toString().slice(-10);
    orderId = `PI${ts2}${nanoid(4)}`;
    logger.info('PayInFintech: duplicate orderId, regenerated', { orderId });
  }

  return orderId;
};

// Step 1: Authenticate 
/**
 * Obtain a bearer token from PayInFintech.
 * @param {{ Email: string, Password: string }} credentials
 * @returns {Promise<{ token: string, expiresAt: string }>} 
 */
const authenticate = async (credentials = {}) => {
  // Try to get credentials from: 1. Passed object, 2. Prefixed env vars, 3. Raw env vars
  const Email = credentials.Email || process.env.PAYINFINTECH_EMAIL || process.env.Email;
  const Password = credentials.Password || process.env.PAYINFINTECH_PASSWORD || process.env.Password;

  // DEBUG LOG: Sanitize values but show presence and source
  logger.info('PayInFintech: attempting authentication', {
    hasEmail: !!Email,
    hasPassword: !!Password,
    source: credentials.Email ? 'database-config' : (process.env.PAYINFINTECH_EMAIL ? 'process-env-prefixed' : 'process-env-raw'),
    emailValue: Email ? `${Email.substring(0, 3)}...` : 'missing'
  });

  if (!Email || !Password) {
    throw new BadRequestError('PayInFintech: Email and Password are required for authentication');
  }

  try {
    const loginPayload = {
      email: Email,
      password: Password
    };

    const response = await axios.post(
      `${BASE_URL}/api-login-merchant`,
      loginPayload,
      { headers: { 'Content-Type': 'application/json' } },
    );

    const data = response.data?.data || response.data;
    const token = data.access_token || data.token;
    const expiresAt = data.expire_date_time;

    if (!token) {
      throw new BadRequestError(
        'PayInFintech: Authentication succeeded but no token returned',
      );
    }

    logger.info('PayInFintech: authenticated successfully', {
      source: credentials.Email ? 'database-config' : 'process-env'
    });
    return { token, expiresAt };
  } catch (error) {
    if (error.response?.status === 400) {
      throw new BadRequestError(
        `PayInFintech: Authentication failed (400) – ${error.response?.data?.message || 'Bad request'}`,
      );
    }
    if (error.response?.status === 500) {
      throw new Error(
        `PayInFintech: Authentication failed (500) – ${error.response?.data?.message || 'Server error'}`,
      );
    }
    throw error;
  }
};

/**
 * Internal helper to ensure we have a valid bearer token for PayInFintech.
 * Checks DB config first, then re-authenticates if expired/missing.
 * @param {string} companyId
 * @returns {Promise<string>}
 */
const getValidToken = async (companyId) => {
  const [company] = await getCompanyByIDDao({ id: companyId });
  if (!company?.config?.PAYINFINTECH) {
    throw new BadRequestError('PayInFintech: configuration not found for company');
  }

  const config = company.config.PAYINFINTECH;
  const { access_token, expire_date_time } = config;

  // Check if token exists and is not expired (with 5 min buffer)
  if (access_token && expire_date_time) {
    const expiryDate = new Date(expire_date_time);
    const now = new Date();
    if (expiryDate > new Date(now.getTime() + 5 * 60 * 1000)) {
      return access_token;
    }
  }

  // Missing or expired, get a new one
  const { token, expiresAt } = await authenticate(config);

  // Store back to DB alongside existing Email, Password, and defaultBankId
  const updatedPAYINFINTECH = {
    ...config,
    access_token: token,
    expire_date_time: expiresAt,
  };

  const updatedConfig = {
    ...company.config,
    PAYINFINTECH: updatedPAYINFINTECH,
  };

  await updateCompanyDao({ id: companyId }, { config: updatedConfig });

  return token;
};

//  Initiate Payout 
/**
 * Authenticate and initiate a single payout via PayInFintech.
 * @param {object} payoutData   - Mapped payout fields
 * @param {string} companyId    - Company ID for token retrieval
 * @returns {Promise<{ status: string, orderId: string, rawResponse: object }>}
 */
export const initiatePayInFintechPayout = async (payoutData, companyId) => {
  logger.info('PayInFintech: initiating payout', {
    orderId: payoutData.OrderId,
    amount: payoutData.Amount,
  });

  // Step 1 — Get valid token
  const token = await getValidToken(companyId);

  // Step 2 — Initiate payout
  const body = {
    Amount: Number(payoutData.Amount),
    AccountNumber: Number(payoutData.AccountNumber),
    Bank: payoutData.Bank,
    IFSC: payoutData.IFSC,
    Mode: payoutData.Mode || 'IMPS',
    OrderId: payoutData.OrderId,
    Mobile: Number(payoutData.Mobile),
  };

  try {
    const response = await axios.post(
      `${BASE_URL}/partner/payout`,
      body,
      {
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(token),
        },
      },
    );

    const raw = response.data;
    const code = raw?.status ?? raw?.code ?? raw?.statusCode;

    logger.info('PayInFintech: payout API response', { code, raw });

    // Error codes — throw immediately
    if (INITIATION_ERROR_MESSAGES[code]) {
      throw new BadRequestError(INITIATION_ERROR_MESSAGES[code]);
    }

    const internalStatus = PAYOUT_STATUS_MAP[code];
    if (!internalStatus) {
      logger.warn('PayInFintech: unknown status code from payout API', { code });
    }

    return {
      status: internalStatus || Status.PENDING,
      orderId: payoutData.OrderId,
      rawResponse: raw,
    };
  } catch (error) {
    if (error instanceof BadRequestError) throw error;
    logger.error('PayInFintech: payout initiation failed', {
      message: error.message,
      data: error.response?.data,
    });
    throw error;
  }
};

//  Create Payout (called from payOutService) 
/**
 * Orchestrate a PayInFintech payout within the standard approval flow.
 * Mirrors createRupeeFlowPayout / createRunsafePayPayout pattern.
 *
 * @param {object} payload         - The internal payout payload (mutated and returned)
 * @param {object} ids             - { id, company_id }
 * @param {object} singleWithdrawData - Full payout record from DB
 * @param {string} bankId          - Bank account ID to assign
 * @returns {Promise<object>}      - Updated payload
 */
export const createPayInFintechPayout = async (
  payload,
  ids,
  singleWithdrawData,
  bankId,
) => {
  let apiResult;

  try {
    if (!payload?.config?.method) {
      throw new Error('Payout method missing in payload');
    }

    // We use companyId to get the token, which handles credentials internally
    if (!ids.company_id) {
      throw new BadRequestError('PayInFintech: company_id is missing');
    }

    // Generate unique OrderId (max 16 chars)
    const orderId = await generatePayInFintechOrderId();

    // Map fields from the internal payout record
    const payoutData = {
      Amount: singleWithdrawData.amount,
      AccountNumber: singleWithdrawData.user_bank_details?.account_no ||
        singleWithdrawData.acc_no,
      Bank: singleWithdrawData.user_bank_details?.bank_name ||
        singleWithdrawData.bank_name,
      IFSC: singleWithdrawData.user_bank_details?.ifsc_code ||
        singleWithdrawData.ifsc_code,
      Mode: payload?.config?.payout_mode || 'IMPS',
      OrderId: orderId,
      Mobile: singleWithdrawData.phone ||
        singleWithdrawData.user?.phone ||
        singleWithdrawData.mobile ||
        '9999999999',
    };

    apiResult = await initiatePayInFintechPayout(payoutData, ids.company_id);

    payload.bank_acc_id = bankId;
    payload.config.txnid = orderId;

    // Clean up the internal credentials from the stored config
    delete payload.config._payinfintechCredentials;

    if (apiResult.status === Status.APPROVED) {
      payload.status = Status.APPROVED;
      payload.utr_id = payload.utr_id || '';
      payload.approved_at = new Date().toISOString();
    } else if (apiResult.status === Status.REJECTED) {
      payload.status = Status.REJECTED;
      payload.rejected_reason =
        apiResult.rawResponse?.message || 'Transaction rejected by PayInFintech';
      payload.rejected_at = new Date().toISOString();
    } else {
      payload.status = Status.PENDING;
    }

    logger.info('PayInFintech: payout processed', {
      orderId,
      status: payload.status,
    });

    return payload;
  } catch (error) {
    payload.status = Status.PENDING;
    payload.bank_acc_id = bankId;
    payload.utr_id = apiResult?._id || '';
    payload.rejected_reason =
      error?.response?.data?.message || error.message || 'API call failed';
    payload.rejected_at = new Date().toISOString();

    // Clean credentials from config even on error
    if (payload?.config?._payinfintechCredentials) {
      delete payload.config._payinfintechCredentials;
    }

    logger.error('PayInFintech: payout error', error.message);
    logger.warn('PayInFintech: payout error response', payload);
    return payload;
  }
};

// ─── Check Payout Status ─────────────────────────────────────────────────────
/**
 * Authenticate and check the status of an existing payout.
 * @param {string} orderId      - The OrderId used when initiating
 * @param {string} companyId    - Company ID for token retrieval
 * @returns {Promise<{ status: string, rawResponse: object }>}
 */
export const checkPayInFintechPayoutStatus = async (orderId, companyId) => {
  logger.info('PayInFintech: checking payout status', { orderId });

  // Step 1 — Get valid token
  const token = await getValidToken(companyId);

  // Step 2 — Check status via multipart/form-data
  try {
    const form = new FormData();
    form.append('orderId', orderId);

    const response = await axios.post(
      `${BASE_URL}/webhook/payout/checkstatus`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          ...getAuthHeaders(token),
        },
      },
    );

    const raw = response.data;
    const code = raw?.status ?? raw?.code ?? raw?.statusCode;

    logger.info('PayInFintech: status check response', { code, raw });

    // Error codes
    if (code === 106) {
      throw new BadRequestError('PayInFintech: OrderId does not exist');
    }
    if (code === 107) {
      throw new BadRequestError('PayInFintech: Validation error on status check');
    }

    const internalStatus = CHECK_STATUS_MAP[code];
    if (!internalStatus) {
      logger.warn('PayInFintech: unknown status code from checkstatus API', {
        code,
      });
    }

    return {
      status: internalStatus || Status.PENDING,
      rawResponse: raw,
    };
  } catch (error) {
    if (error instanceof BadRequestError) throw error;
    logger.error('PayInFintech: status check failed', {
      message: error.message,
      data: error.response?.data,
    });
    throw error;
  }
};

// ─── Wallet Balance ──────────────────────────────────────────────────────────
/**
 * Fetch the PayInFintech wallet balance.
 * When called as an Express route handler (req, res), reads company_id from
 * req.user and looks up PAYINFINTECH credentials from the company config —
 * mirroring the getTataPayWalletBalance pattern.
 * Can also be called internally with { company_id } as the first argument
 * (res omitted) and will return the data object directly.
 * @param {object} reqOrParams - Express req, or { company_id }
 * @param {object|undefined} res - Express res (present when called as route handler)
 * @returns {Promise<object|null>}
 */
export const getPayInFintechWalletBalance = async (reqOrParams, res) => {
  try {
    const isExpress = !!res; // true when invoked by Express as a route handler
    const company_id = isExpress
      ? reqOrParams.user?.company_id
      : reqOrParams.company_id;

    if (!company_id) {
      throw new BadRequestError('PayInFintech: company_id is missing');
    }

    const token = await getValidToken(company_id);

    const response = await axios.post(`${BASE_URL}/partner/wallet-balance-v1`, {
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(token),
      },
    });

    logger.info('PayInFintech: wallet balance response', response.data);

    const raw = response.data;
    const data = {
      walletBalance: parseFloat(
        raw?.Payout_wallet_amount ?? raw?.balance ?? raw?.availableBalance ?? 0,
      ),
      rawResponse: raw,
    };

    const successMsg = 'PayInFintech wallet balance fetched successfully';
    if (isExpress) {
      return sendSuccess(res, data, successMsg);
    }
    return { success: true, message: successMsg, data };
  } catch (error) {
    logger.error('PayInFintech: error fetching wallet balance', {
      message: error.message,
      data: error.response?.data,
    });
    // If the endpoint doesn't exist (404) return null gracefully
    if (error.response?.status === 404) {
      logger.warn('PayInFintech: balance endpoint not available, returning null');
      return null;
    }
    throw error;
  }
};
