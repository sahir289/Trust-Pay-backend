import { getMerchantsByCodeAndApiKeyDao } from '../apis/merchants/merchantDao.js';
import { sendError } from '../utils/responseHandlers.js';
import { logger } from '../utils/logger.js';

const LOCALHOST_IPS = new Set(['::1', '127.0.0.1', '::ffff:127.0.0.1']);

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

// Normalize a merchant's configured whitelist (string or array, possibly
// comma-separated) into a clean array of IP strings.
const normalizeWhitelist = (whitelistIps) =>
  (Array.isArray(whitelistIps) ? whitelistIps : [whitelistIps])
    .flatMap((ip) => (typeof ip === 'string' ? ip.split(',') : [String(ip)]))
    .map((ip) => ip.trim())
    .filter(Boolean);

export const checkApiKey = async (req, res, next) => {
  try {
  const payload = req.query;
  const x_api_key = req.headers['x-api-key'];
  const userIp = resolveMerchantClientIp(req);
  const { code } = payload;

  if (x_api_key) {
    const merchantArr = await getMerchantsByCodeAndApiKeyDao(code, x_api_key);
    const merchant = merchantArr[0];
    if (!merchant) {
      return sendError(res, 'Invalid merchant code or API key', 400);
    }

    if (merchant?.config?.whitelist_ips) {
      const whitelist = normalizeWhitelist(merchant.config.whitelist_ips);
      if (whitelist.length > 0 && !whitelist.includes(userIp)) {
        return sendError(res, 'IP not whitelisted', 400);
      }
    }
  }

  next();
  } catch (error) {
    logger.error('checkApiKey middleware error:', error.message);
    return sendError(res, 'Service temporarily unavailable', 503);
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

  const merchantArr = await getMerchantsByCodeAndApiKeyDao(code, x_api_key);
  const merchant = merchantArr[0];
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
    logger.error('checkApiWallet middleware error:', error.message);
    return sendError(res, 'Service temporarily unavailable', 503);
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

  const merchantArr = await getMerchantsByCodeAndApiKeyDao(code, x_api_key);
  const merchant = merchantArr[0];
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
    logger.error('checkPayoutApiKey middleware error:', error.message);
    return sendError(res, 'Service temporarily unavailable', 503);
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

  const merchantArr = await getMerchantsByCodeAndApiKeyDao(code, x_api_key);
  const merchant = merchantArr[0];
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
    logger.error('checkMerchantApiKey middleware error:', error.message);
    return sendError(res, 'Service temporarily unavailable', 503);
  }
};
