// Redis cache for the IP Intelligence Service — the fast, first place we look.
//
// It reuses the project's existing Redis helpers so logging and serialization
// match the rest of the app, and adds a few things specific to IP lookups:
//   * Tidy, versioned names for the three kinds of entries we store:
//       - the actual answer for an IP ("intel"),
//       - a short "we couldn't resolve this IP" marker ("negative"),
//       - a temporary lock used to avoid duplicate provider calls.
//   * How long each answer is kept (its TTL), with a little randomness so lots
//     of IPs cached together don't all expire at the exact same moment.
//   * A short lock so a brand-new, busy IP triggers exactly ONE provider call
//     instead of one per concurrent request.

import config from '../../config/config.js';
import redisClient from '../../utils/redisClient.js';
import {
  getCachedData,
  setCachedData,
  deleteCachedData,
} from '../../utils/redishashkey.js';
import { logger } from '../../utils/logger.js';

const ver = () => config.ipIntelligence?.cacheKeyVersion || 'v1';

// The three kinds of Redis keys we use. The version prefix lets us throw away
// every old entry at once, just by bumping cacheKeyVersion in config.
const intelKey = (ipKey) => `ip:intel:${ver()}:${ipKey}`; // the answer for an IP
const negKey = (ipKey) => `ip:neg:${ver()}:${ipKey}`; // "couldn't resolve" marker
const lockKey = (ipKey) => `ip:lock:${ver()}:${ipKey}`; // one-lookup-at-a-time lock

// Nudge each TTL randomly by up to ±10%, so a batch of IPs cached at the same time 
// don't all expire on the same tick and rush the provider in one big spike.
const withJitter = (seconds) =>
  Math.max(1, Math.round(seconds * (0.9 + Math.random() * 0.2)));

// Decides how long we trust an answer before treating it as old. Known-bad IPs
// (VPN/proxy/TOR/hosting) are kept longest, ordinary clean IPs a medium time,
// and shaky low-confidence answers only briefly so we re-check them sooner.
export const ttlForIntel = (intel) => {
  const ttls = config.ipIntelligence?.ttls || {};
  if (intel.isVpn || intel.isProxy || intel.isTor || intel.isHosting) {
    return ttls.blockSec ?? 86400;
  }
  if ((intel.confidence ?? 0) < 0.5) {
    return ttls.lowConfidenceSec ?? 1800;
  }
  return ttls.cleanSec ?? 21600;
};

// Read / write the cached answer for a single IP.
export const getIntel = async (ipKey) => {
  if (!ipKey) return null;
  return getCachedData(intelKey(ipKey), 'ip-intel');
};

export const setIntel = async (ipKey, intel) => {
  if (!ipKey || !intel) return;
  await setCachedData(intelKey(ipKey), intel, withJitter(ttlForIntel(intel)), 'ip-intel');
};

// Negative cache: when even the provider has no data on an IP, we remember that
// for a short while so we don't re-run the whole expensive lookup for the same unknown IP on every single request.
export const getNegative = async (ipKey) => {
  if (!ipKey) return null;
  return getCachedData(negKey(ipKey), 'ip-intel-neg');
};

export const setNegative = async (ipKey) => {
  if (!ipKey) return;
  const ttl = config.ipIntelligence?.ttls?.negativeSec ?? 180;
  await setCachedData(negKey(ipKey), { unknown: true }, ttl, 'ip-intel-neg');
};

// Forget everything we've cached for an IP (both the answer and the "couldn't resolve" marker). 
// Useful when we know a record is wrong or want a fresh lookup.
export const invalidate = async (ipKey) => {
  if (!ipKey) return;
  await deleteCachedData(intelKey(ipKey), 'ip-intel');
  await deleteCachedData(negKey(ipKey), 'ip-intel-neg');
};

// Is this cached answer past its expiry time? We may still return it to the caller, 
// but it signals that a background refresh would be a good idea.
export const isStale = (intel) => {
  if (!intel?.expiresAt) return false;
  return Date.now() > new Date(intel.expiresAt).getTime();
};

// Tries to grab the short per-IP lock. Only ONE caller can win it at a time
// (Redis "NX" means "set only if it doesn't already exist"). The winner does the real lookup; 
// everyone else waits for its result. Returns true only for the winner.
export const acquireLock = async (ipKey, ms = 800) => {
  try {
    const result = await redisClient.set(lockKey(ipKey), '1', 'PX', ms, 'NX');
    return result === 'OK';
  } catch (err) {
    // If Redis itself is having a moment, pretend someone else already holds the lock. That's the safe choice: better to wait than to let every request rush the provider at once.
    logger.warn('ip-intel lock acquire failed', { err: err.message });
    return false;
  }
};

export const releaseLock = async (ipKey) => {
  try {
    await redisClient.del(lockKey(ipKey));
  } catch {
    // Not a problem if this fails — the lock expires on its own via PX.
  }
};

// Used by the callers that DIDN'T win the lock: wait a short, capped amount of time (checking every 25ms) for the winner to publish the answer.
//  Give up and return null if it never shows up.
export const waitForValue = async (ipKey, budgetMs = 300) => {
  const deadline = Date.now() + Math.min(budgetMs, 1000);
  while (Date.now() < deadline) {
    const value = await getIntel(ipKey);
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return null;
};
