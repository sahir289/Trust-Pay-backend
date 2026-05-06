import axios from 'axios';
import FormData from 'form-data';
import { Status } from '../constants/index.js';
import { BadRequestError } from '../utils/appErrors.js';
import { logger } from '../utils/logger.js';
import { sendSuccess } from '../utils/responseHandlers.js';
import { customAlphabet } from 'nanoid';
import { getPayoutByTxnId } from '../apis/payOut/payOutDao.js';

//  Nanoid (alphanumeric, max 16 chars for OrderId) 
// "TXN" prefix (3 chars) + 10-digit timestamp (13 chars) = 16 chars total
const nanoid = customAlphabet(
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  3,
);

const BASE_URL = 'https://api.payinfintech.com';

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
 * Re-authenticates on every call (no shared token cache per the spec).
 * @param {{ Email: string, Password: string }} credentials
 * @returns {Promise<string>} Bearer token
 */
const authenticate = async (credentials) => {
  const { Email, Password } = credentials;

  try {
    const response = await axios.post(
      `${BASE_URL}/api-login-merchant`,
      { Email, Password },
      { headers: { 'Content-Type': 'application/json' } },
    );

    const token =
      response.data?.token ||
      response.data?.data?.token ||
      response.data?.access_token;

    if (!token) {
      throw new BadRequestError(
        'PayInFintech: Authentication succeeded but no token returned',
      );
    }

    logger.info('PayInFintech: authenticated successfully');
    return token;
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

//  Initiate Payout 
/**
 * Authenticate and initiate a single payout via PayInFintech.
 * @param {object} payoutData   - Mapped payout fields
 * @param {object} credentials  - { Email, Password }
 * @returns {Promise<{ status: string, orderId: string, rawResponse: object }>}
 */
export const initiatePayInFintechPayout = async (payoutData, credentials) => {
  logger.info('PayInFintech: initiating payout', {
    orderId: payoutData.OrderId,
    amount: payoutData.Amount,
  });

  // Step 1 — Authenticate
  const token = await authenticate(credentials);

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
          Authorization: `Bearer ${token}`,
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

    // Pull credentials from company config (set by the caller via company.config.PAYINFINTECH)
    const credentials = payload?.config?._payinfintechCredentials;
    if (!credentials?.Email || !credentials?.Password) {
      throw new BadRequestError(
        'PayInFintech: credentials (Email / Password) not found in config',
      );
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

    apiResult = await initiatePayInFintechPayout(payoutData, credentials);

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
 * @param {object} credentials  - { Email, Password }
 * @returns {Promise<{ status: string, rawResponse: object }>}
 */
export const checkPayInFintechPayoutStatus = async (orderId, credentials) => {
  logger.info('PayInFintech: checking payout status', { orderId });

  // Step 1 — Authenticate
  const token = await authenticate(credentials);

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
          Authorization: `Bearer ${token}`,
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
 * Attempt to fetch the PayInFintech wallet balance.
 * The provider may not expose a balance endpoint; if none exists this returns null.
 * @param {object} credentials     - { Email, Password }
 * @param {object|undefined} res   - Express res (optional, for direct route use)
 * @returns {Promise<object|null>}
 */
export const getPayInFintechWalletBalance = async (credentials, res) => {
  try {
    const token = await authenticate(credentials);

    const response = await axios.get(`${BASE_URL}/partner/balance`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    logger.info('PayInFintech: wallet balance response', response.data);

    const raw = response.data?.data || response.data;
    const data = {
      walletBalance: parseFloat(raw?.balance ?? raw?.availableBalance ?? 0),
      rawResponse: raw,
    };

    const successMsg = 'PayInFintech wallet balance fetched successfully';
    if (res) {
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
