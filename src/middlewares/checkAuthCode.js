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
  const x_auth_code = req.headers['x-auth-code'];
  const payloads = req.body?.body || [req?.body] || []; 
  const bankIds = [...new Set(payloads.map(item => item.bank_id))];
  if (x_auth_code) {
    const vendorInfo = await getVendorByAuthCodeDao({code: x_auth_code});

    if (!vendorInfo) {
      return sendError(res, 'Invalid x-auth-code code', 400);
    }

    const matchedBanks = vendorInfo.banks.filter(bank =>
      bankIds.includes(bank.id)
    );
    if (matchedBanks.length === 0) {
      return sendError(res, 'No matching banks found for the provided bank_id(s)', 400);
    }
    const updatedVendorInfo = {
      ...vendorInfo,
      banks: matchedBanks
    };
    req.vendor = updatedVendorInfo;
  }
  else {
    return sendError(res, 'x-auth-code header is missing', 401);
  }
  next();
};
