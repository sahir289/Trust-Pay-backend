import { getMerchantsByAuthCodeDao } from '../apis/merchants/merchantDao.js';
import { getVendorByAuthCodeDao } from '../apis/vendors/vendorDao.js';
import { sendError } from '../utils/responseHandlers.js';
import config from '../config/config.js';
import { getCachedData, setCachedData } from '../utils/redishashkey.js';
const MERCHANT_API_CACHE_TTL_SEC =
  config?.controllerCacheTtls?.merchants?.byCode || 60;

const getMerchantAuthCodeCacheKey = (code) =>
  code ? `merchant_auth_code:${code}` : null;
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
const getVendorAuthCodeCacheKey = (code) =>
  code ? `vendor_auth_code:${code}` : null;

const getVendorFromAuthCodeCacheOrDb = async (code) => {
  const cacheKey = getVendorAuthCodeCacheKey(code);
  const cachedVendor = await getCachedData(
      cacheKey,
      'vendor_auth_code',
    );
    if (cachedVendor) {
      return cachedVendor;
    }
  const vendor = await getVendorByAuthCodeDao({code});
    if (vendor) {
      await setCachedData(
        cacheKey,
        vendor,
        MERCHANT_API_CACHE_TTL_SEC,
        'vendor_auth_code',
      );
    }
    return vendor;
  };
// Normalize a merchant's configured whitelist (string or array, possibly
// comma-separated) into a clean array of IP strings.

export const checkAuthCode = async (req, res, next) => {
  try {
    const x_auth_code = req.headers['x-auth-code'];

    if (x_auth_code) {
      const merchantInfo = await getMerchantFromAuthCodeCacheOrDb(x_auth_code);
      if (!merchantInfo) {
        return sendError(res, 'Invalid merchant code or API key', 400);
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

export const checkAuthVendorCode = async (req, res, next) => {
  try {
    const x_auth_code = req.headers['x-auth-code'];

    if (!x_auth_code) {
      return sendError(res, 'x-auth-code header is missing', 401);
    }

    // body can be { body: [...] } or a single object
    const payloads = Array.isArray(req.body?.body)
      ? req.body.body
      : Array.isArray(req.body)
        ? req.body
        : req.body
          ? [req.body]
          : [];

    const bankIds = [
      ...new Set(
        payloads
          .map((item) => item?.bank_id)
          .filter(Boolean),
      ),
    ];

    if (bankIds.length === 0) {
      return sendError(res, 'bank_id is required in request body', 400);
    }

    const vendorInfo = await getVendorFromAuthCodeCacheOrDb(x_auth_code);

    if (!vendorInfo) {
      return sendError(res, 'Invalid x-auth-code code', 400);
    }

    // ★ Fix: banks missing / undefined handle karo
    const vendorBanks = Array.isArray(vendorInfo.banks)
      ? vendorInfo.banks
      : [];

    if (vendorBanks.length === 0) {
      return sendError(
        res,
        'No banks mapped to this vendor (x-auth-code)',
        400,
      );
    }

    const matchedBanks = vendorBanks.filter((bank) =>
      bankIds.includes(bank.id),
    );
    if (matchedBanks.length === 0) {
      return sendError(res, 'No matching banks found for the provided bank_id(s)', 400);
    }

    req.vendor = {
      ...vendorInfo,
      banks: matchedBanks,
    };

    return next();
  } catch (error) {
    console.error('checkAuthVendorCode error:', error);
    return sendError(res, 'Authentication check failed', 500);
  }
};
