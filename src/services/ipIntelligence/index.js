// Internal IP Intelligence Service (IPIS)
// ---------------------------------------
// This module answers ONE question for the rest of the app: "what do we know
// about this IP address?" (Is it a VPN/proxy? Which country/region is it in?
// How risky is it?)
//
// Why it exists:
//   We used to call the paid provider (proxycheck.io) on EVERY request, which
//   is slow and costs money. This service checks fast local caches first and
//   only calls the paid provider when nothing else can answer. Every caller
//   (login guard, payment guard, ...) must go through getIntelligence() and
//   must NEVER call the provider directly.
//
// Where it looks for the answer, fastest to slowest — it stops at the first hit:
//   1. Redis            in-memory cache, answers in well under a millisecond.
//   2. Postgres         our own saved copy from a previous lookup.
//   3. "Negative" cache  remembers IPs we recently failed to resolve, so we
//                        don't keep retrying a dead/unknown IP.
//   4. Local feed lists  offline lists of known VPN / TOR / datacenter ranges.
//   5. Provider call     the paid API — last resort only (the "cold" path).
//
// Nothing in here ever throws. If one layer breaks we quietly fall through to
// the next, so an IP-lookup hiccup can never take down login or payments.

import { logger } from '../../utils/logger.js';
import * as cache from './cache.js';
import * as dao from './ipIntelligenceDao.js';
import * as gateway from './providers/providerGateway.js';
import { normalizeIp, isLoopback, toIpKey } from './ipUtils.js';

const nowIso = () => new Date().toISOString();
const expiryIso = (seconds) => new Date(Date.now() + seconds * 1000).toISOString();

// A stopwatch for debugging speed. When it's on, every step below (Redis,
// Postgres, provider, ...) logs how many milliseconds it took, so we can see
// exactly which hop is slow. It's ON automatically during local development and
// OFF in production (unless you set IP_INTEL_TIMING=1), because logging on every
// single request would be far too noisy in live traffic.
const TIMING_ENABLED =
  process.env.IP_INTEL_TIMING === '1' || process.env.NODE_ENV !== 'production';

const timed = async (step, ipKey, fn) => {
  if (!TIMING_ENABLED) return fn();
  const startedAt = Date.now();
  try {
    return await fn();
  } finally {
    logger.info('ip-intel timing', { step, ipKey, ms: Date.now() - startedAt });
  }
};

// Saves a freshly-resolved IP record to Postgres in the BACKGROUND. We don't wait for this write to finish: Redis has already been updated just above, so the caller gets its answer immediately instead of waiting on a (possibly
// far-away) database. Postgres here is only the long-term backup copy — Redis 
// is what actually serves traffic — so if this write fails we just log it and move on.
const persistAsync = (intel, ipKey) => {
  const startedAt = TIMING_ENABLED ? Date.now() : 0;
  dao
    .upsertIntel(intel)
    .then(() => {
      if (TIMING_ENABLED) {
        logger.info('ip-intel timing', {
          step: 'db.upsertIntel(async)',
          ipKey,
          ms: Date.now() - startedAt,
        });
      }
    })
    .catch((err) =>
      logger.warn('ip-intel upsert (async) failed', { ipKey, err: err?.message }),
    );
};

// A blank "we know nothing yet" record with every field set to a safe default
// (not a VPN, no country, zero risk). Other layers start from this and fill in
// what they find; it's also the answer we return for local/loopback IPs.
const defaultIntel = (ip, ipKey) => ({
  ip,
  ipKey,
  asn: null,
  isp: null,
  org: null,
  country: null,
  region: null,
  city: null,
  isVpn: false,
  isProxy: false,
  isHosting: false,
  isTor: false,
  riskScore: 0,
  confidence: 0,
  providerName: null,
  policyVersion: null,
  metadata: {},
  lastCheckedAt: nowIso(),
  expiresAt: nowIso(),
  source: 'default',
});

// Converts a matched local-feed row (e.g. "this IP range is a known VPN / TOR /
// datacenter") into our standard record. We mark it high-risk and
// high-confidence because these lists are curated and trusted.
const feedToIntel = (ip, ipKey, feed) => ({
  ...defaultIntel(ip, ipKey),
  asn: feed.asn ?? null,
  isVpn: feed.feed_type === 'vpn_asn',
  isTor: feed.feed_type === 'tor',
  isHosting: feed.feed_type === 'datacenter',
  riskScore: 90,
  confidence: 0.95,
  providerName: feed.source || 'local-feed',
  source: 'local-db',
});

// The slow "nothing was cached" path: actually go figure out this IP from
// scratch. Before doing any real work we grab a short-lived Redis lock so that
// if many requests for the SAME new IP arrive at once, only one of them does
// the expensive lookup while the others simply wait for its result. Without
// this we could fire dozens of paid provider calls for a single IP.
const coldLookup = async (ip, ipKey, budgetMs) => {
  const gotLock = await timed('cache.acquireLock', ipKey, () =>
    cache.acquireLock(ipKey),
  );
  if (!gotLock) {
    // Someone else already holds the lock and is resolving this IP right now.
    // Wait briefly for them to publish the result instead of doing it again.
    const waited = await timed('cache.waitForValue', ipKey, () =>
      cache.waitForValue(ipKey, budgetMs),
    );
    return waited ? { ...waited, source: 'cache' } : null;
  }

  try {
    // Check our own offline lists first — they're free, instant, and trusted.
    // Only if nothing matches do we spend a paid provider call further down.
    const feed = await timed('db.lookupFeed', ipKey, () => dao.lookupFeed(ip));
    if (feed) {
      const intel = feedToIntel(ip, ipKey, feed);
      intel.expiresAt = expiryIso(cache.ttlForIntel(intel));
      await timed('cache.setIntel', ipKey, () => cache.setIntel(ipKey, intel));
      persistAsync(intel, ipKey);
      return intel;
    }

    // Last resort: ask the paid provider (proxycheck.io).
    const provided = await timed('provider.lookup', ipKey, () =>
      gateway.lookup(ip, budgetMs),
    );
    if (!provided) {
      // Couldn't resolve it — remember that for a while (negative cache) so we don't keep retrying the same dead IP on every request.
      await cache.setNegative(ipKey);
      return null;
    }

    const intel = {
      ...defaultIntel(ip, ipKey),
      ...provided,
      ip,
      ipKey,
      lastCheckedAt: nowIso(),
    };
    intel.expiresAt = expiryIso(cache.ttlForIntel(intel));
    await timed('cache.setIntel', ipKey, () => cache.setIntel(ipKey, intel));
    persistAsync(intel, ipKey);
    return intel;
  } finally {
    await cache.releaseLock(ipKey);
  }
};

/**
 * The single function the rest of the app calls. Hand it an IP and it returns
 * what we know about that IP (VPN/proxy flags, country, region, risk, ...). It
 * walks the cache tiers described at the top of this file and returns the first
 * answer it finds.
 *
 * - `budgetMs` is a soft time limit for the slow provider call on a cold miss.
 * - For local/loopback IPs it returns the blank "we know nothing" record.
 * - It returns null only when the IP is real but no layer could resolve it.
 * - It never throws.
 */
export const getIntelligence = async (ip, budgetMs = 1500) => {
  const value = normalizeIp(ip);
  if (!value || isLoopback(value)) {
    return defaultIntel(value, null);
  }

  const ipKey = toIpKey(value);
  const startedAt = TIMING_ENABLED ? Date.now() : 0;

  try {
    // 1) Fastest check: is the answer already sitting in the Redis cache?
    const cached = await timed('cache.getIntel', ipKey, () => cache.getIntel(ipKey));
    if (cached) {
      if (cache.isStale(cached)) {
        // The cached answer is a little old but still usable, so we serve it now
        // and (in a future Phase 2) will refresh it quietly in the background.
        logger.info('ip-intel served stale (refresh pending Phase 2)', { ipKey });
      }
      return { ...cached, source: 'cache' };
    }

    // 2) Not in Redis — do we have a saved copy in Postgres? If so, use it and warm Redis with it so the next request is fast.
    const stored = await timed('db.lookupByIpKey', ipKey, () =>
      dao.lookupByIpKey(ipKey),
    );
    if (stored && !cache.isStale(stored)) {
      await cache.setIntel(ipKey, stored);
      return stored;
    }

    // 3) Did we already try and fail on this IP recently? If so, don't retry it.
    const negative = await cache.getNegative(ipKey);
    if (negative) {
      return { ...defaultIntel(value, ipKey), source: 'cache' };
    }

    // 4) Nothing cached anywhere — do the real (slow) lookup.
    return await coldLookup(value, ipKey, budgetMs);
  } finally {
    if (TIMING_ENABLED) {
      logger.info('ip-intel timing', {
        step: 'total',
        ipKey,
        ms: Date.now() - startedAt,
      });
    }
  }
};
