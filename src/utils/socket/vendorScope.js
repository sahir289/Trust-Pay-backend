import { getCachedData, setCachedData } from '../redishashkey.js';
import { logger } from '../logger.js';

const VENDOR_CODES_CACHE_TTL_SEC = 300;
const VENDOR_DESIGNATIONS = new Set([
  'VENDOR',
  'SUB_VENDOR',
  'VENDOR_ADMIN',
  'VENDOR_OPERATIONS',
]);
const MERCHANT_DESIGNATIONS = new Set([
  'MERCHANT',
  'SUB_MERCHANT',
  'MERCHANT_ADMIN',
  'MERCHANT_OPERATIONS',
]);

const buildVendorCodesCacheKey = (userId) => `socket:vendorcodes:${userId}`;

// A vendor-side socket must never join the company room; it only receives its
// own vendor-code rooms. Classify by the JWT role/designation.
const isVendorSideUser = (authed) => {
  const role = String(authed?.role || '').toUpperCase();
  const designation = String(authed?.designation || '').toUpperCase();
  return role === 'VENDOR' || VENDOR_DESIGNATIONS.has(designation);
};

// A merchant-side socket must never join the company room either; it only
// receives its own (user-scoped) events. Classify by the JWT role/designation.
const isMerchantSideUser = (authed) => {
  const role = String(authed?.role || '').toUpperCase();
  const designation = String(authed?.designation || '').toUpperCase();
  return role === 'MERCHANT' || MERCHANT_DESIGNATIONS.has(designation);
};

const extractVendorCodes = (rows) => {
  const codes = new Set();
  for (const row of rows || []) {
    if (row?.label) {
      codes.add(String(row.label));
    }
    const subVendors = row?.subVendors || row?.subvendors || [];
    for (const sub of subVendors) {
      if (sub?.label) {
        codes.add(String(sub.label));
      }
    }
  }
  return [...codes];
};

// Resolves the vendor codes a user is allowed to see (own + sub-vendors),
// server-side from the authenticated identity. Cached briefly to absorb the
// dashboard's aggressive socket reconnection behaviour.
const resolveVendorCodes = async (authed) => {
  const userId = authed?.user_id ? String(authed.user_id) : null;
  const companyId = authed?.company_id ? String(authed.company_id) : null;
  if (!userId || !companyId) {
    return [];
  }

  const cacheKey = buildVendorCodesCacheKey(userId);
  const cached = await getCachedData(cacheKey, 'Socket vendor codes cache');
  if (Array.isArray(cached)) {
    return cached;
  }

  // Dynamic import breaks the static cycle: vendorService -> utils/sockets -> socket/*.
  const { getVendorsCodeService } = await import(
    '../../apis/vendors/vendorService.js'
  );

  const rows = await getVendorsCodeService(
    { company_id: companyId },
    authed.role,
    authed.designation,
    userId,
    'true',
  );

  const codes = extractVendorCodes(rows);
  await setCachedData(
    cacheKey,
    codes,
    VENDOR_CODES_CACHE_TTL_SEC,
    'Socket vendor codes cache',
  );
  logger.info(
    `[SOCKET] Resolved ${codes.length} vendor code(s) for user ${userId}`,
  );
  return codes;
};

export { isMerchantSideUser, isVendorSideUser, resolveVendorCodes };
