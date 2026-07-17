import {
  getMerchantsByAuthCodeDao,
  getMerchantsByCodeAndApiKeyDao,
} from '../apis/merchants/merchantDao.js';
import { sendError } from '../utils/responseHandlers.js';
import { V2_ERROR_CODES } from '../constants/index.js';
import config from '../config/config.js';
import { getCachedData, setCachedData } from '../utils/redishashkey.js';
const LOCALHOST_IPS = new Set(['::1', '127.0.0.1', '::ffff:127.0.0.1']);
const MERCHANT_API_CACHE_TTL_SEC =
  config?.controllerCacheTtls?.merchants?.byCode || 60;
// Resolve the real client IP for merchant IP-allowlist checks.
// `trust proxy` is set to 1 in app.js, so Express's `req.ip` is the address of
// the client as seen by the single trusted proxy and CANNOT be spoofed via the
// X-Forwarded-For header. We deliberately avoid reading the raw
// X-Forwarded-For header here because it is attacker-controlled and would
// otherwise let a caller bypass the IP allowlist by forging a whitelisted IP.
const resolveMerchantClientIp = (req) => {
  const ip = req.ip;
  if (LOCALHOST_IPS.has(ip) && process.env.LOCAL_IP) {
    return process.env.LOCAL_IP;
  }
  return ip;
};

const getMerchantAuthCodeCacheKey = (code) =>
  code ? `merchant_auth_code:${code}` : null;
const getMerchantApiCacheKey = (code, apiKey) =>
  code && apiKey ? `merchant_api:${code}:${apiKey}` : null;
const getMerchantFromAuthCodeCacheOrDb = async (code) => {
const cacheKey = getMerchantAuthCodeCacheKey(code);
const cachedMerchant = await getCachedData(
    cacheKey,
    'merchant_auth_code',
  );
  if (cachedMerchant) {
    return cachedMerchant;
  }
const merchant = await getMerchantsByAuthCodeDao(code);
  if (merchant) {
    await setCachedData(
      cacheKey,
      merchant,
      MERCHANT_API_CACHE_TTL_SEC,
      'merchant_auth_code',
    );
  }
  return merchant;
};
const getMerchantFromApiCacheOrDb = async (code, apiKey) => {
const cacheKey = getMerchantApiCacheKey(code, apiKey);
const cachedMerchant = await getCachedData(
    cacheKey,
    'merchant_api',
  );
  if (cachedMerchant) {
    return cachedMerchant;
  }
const merchantArr = await getMerchantsByCodeAndApiKeyDao(
    code,
    apiKey,
  );
const merchant = merchantArr[0] || null;
  if (merchant) {
    await setCachedData(
      cacheKey,
      merchant,
      MERCHANT_API_CACHE_TTL_SEC,
      'merchant_api',
    );
  }
  return merchant;
};
// Normalize a merchant's configured whitelist (string or array, possibly
// comma-separated) into a clean array of IP strings.
const normalizeWhitelist = (whitelistIps) =>
  (Array.isArray(whitelistIps) ? whitelistIps : [whitelistIps])
    .flatMap((ip) => (typeof ip === 'string' ? ip.split(',') : [String(ip)]))
    .map((ip) => ip.trim())
    .filter(Boolean);

export const checkAuthCode = async (req, res, next) => {
  try {
    const x_auth_code = req.headers['x-auth-code'];
    const userIp = resolveMerchantClientIp(req);

    if (x_auth_code) {
      const merchantInfo = await getMerchantFromAuthCodeCacheOrDb(x_auth_code);
      if (!merchantInfo) {
        return sendError(res, 'Invalid merchant code or API key', 400);
      }

      if (merchantInfo?.config?.whitelist_ips) {
        const whitelist = normalizeWhitelist(merchantInfo.config.whitelist_ips);
        if (whitelist.length > 0 && !whitelist.includes(userIp)) {
          // return sendError(res, 'IP not whitelisted', 400);
        }
      }
      req.merchant = merchantInfo;
    } else {
      return sendError(res, 'x-auth-code header is missing', 401);
    }
    next();
  } catch (error) {
    // A DB / connection failure here must produce a proper error response via
    // the global errorHandler, not escape as an unhandled rejection.
    next(error);
  }
};

export const checkApiWallet = async (req, res, next) => {
  try {
    const x_api_key = req.headers['x-api-key'];
    const code = req.headers['code'];
    const userIp = resolveMerchantClientIp(req);

    // Fail closed: the wallet balance endpoint must never be reachable without
    // a merchant API key (previously a missing key skipped all validation).
    if (!x_api_key) {
      return sendError(res, 'x-api-key header is missing', 401);
    }

    const merchant = await getMerchantFromApiCacheOrDb(code, x_api_key);
    // const merchant = merchantArr[0];
    if (!merchant) {
      return sendError(res, 'Invalid merchant code or API key', 400);
    }

    if (merchant?.config?.whitelist_ips) {
      const whitelist = normalizeWhitelist(merchant.config.whitelist_ips);
      if (whitelist.length > 0 && !whitelist.includes(userIp)) {
        return sendError(res, 'IP not whitelisted', 400);
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};
export const checkPayoutApiKey = async (req, res, next) => {
  try {
    const payload = req.body;
    const x_api_key = req.headers['x-api-key'];
    const userIp = resolveMerchantClientIp(req);

    const { code } = payload;

    if (!x_api_key) {
      return sendError(res, 'x-api-key header is missing', 403);
    }

    const merchant = await getMerchantFromApiCacheOrDb(code, x_api_key);
    // const merchant = merchantArr[0];
    if (!merchant) {
      return sendError(res, 'Invalid merchant code or API key', 400);
    }

    if (merchant?.config?.whitelist_ips) {
      const whitelist = normalizeWhitelist(merchant.config.whitelist_ips);
      if (whitelist.length > 0 && !whitelist.includes(userIp)) {
        return sendError(res, 'IP not whitelisted', 400);
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

// Generic, fail-closed merchant API-key guard for endpoints that carry the
// merchant `code` in a header/body/query and the key in the `x-api-key` header.
// Use this on merchant-facing routes that were previously unauthenticated.
export const checkMerchantApiKey = async (req, res, next) => {
  try {
    const x_api_key = req.headers['x-api-key'];
    const code = req.headers['code'] || req.body?.code || req.query?.code;
    const userIp = resolveMerchantClientIp(req);

    if (!x_api_key) {
      return sendError(res, 'x-api-key header is missing', 401);
    }

    const merchant = await getMerchantFromApiCacheOrDb(code, x_api_key);
    // const merchant = merchantArr[0];
    if (!merchant) {
      return sendError(res, 'Invalid merchant code or API key', 400);
    }

    if (merchant?.config?.whitelist_ips) {
      const whitelist = normalizeWhitelist(merchant.config.whitelist_ips);
      if (whitelist.length > 0 && !whitelist.includes(userIp)) {
        return sendError(res, 'IP not whitelisted', 403);
      }
    }

    req.merchant = merchant;
    next();
  } catch (error) {
    next(error);
  }
};

// V2 variant of checkMerchantApiKey: identical fail-closed merchant API-key +
// IP-allowlist validation (and it attaches `req.merchant`, exposing the
// per-merchant signing secret at merchant.config.keys.private for the request
// signature middleware), but it emits the standardized v2 error envelope via
// sendV2Error and forwards unexpected errors to the v2 error handler. The v1
// guards above are intentionally left untouched.
export const checkMerchantApiKeyV2 = async (req, res, next) => {
  try {
    const x_public_key = req.headers['x-public-key'];
    const code =
      req.headers['code'] ||
      req.body?.code ||
      req.query?.code ||
      req.body?.merchantCode ||
      req.query?.merchantCode;
    const userIp = resolveMerchantClientIp(req);

    if (!x_public_key) {
      return sendError(
        res,
        'x-api-key header is missing',
        401,
        V2_ERROR_CODES.API_KEY_MISSING,
      );
    }

    const merchant = await getMerchantFromApiCacheOrDb(code, x_public_key);
    if (!merchant) {
      return sendError(
        res,
        'Invalid merchant code or API key',
        401,
        V2_ERROR_CODES.INVALID_API_KEY,
      );
    }

    if (merchant?.config?.whitelist_ips) {
      const whitelist = normalizeWhitelist(merchant.config.whitelist_ips);
      if (whitelist.length > 0 && !whitelist.includes(userIp)) {
        return sendError(
          res,
          'IP not whitelisted',
          403,
          V2_ERROR_CODES.IP_NOT_WHITELISTED,
        );
      }
    }

    req.merchant = merchant;
    return next();
  } catch (error) {
    return next(error);
  }
};
