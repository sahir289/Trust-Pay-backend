// The "gateway" sits between our service and the outside IP-lookup vendors.
//
// It gives us a few things for free:
//   * One clean way to call a vendor, no matter which vendor it is.
//   * A fallback list: try vendor A, and if it's down, try B, then C...
//   * A "circuit breaker": if a vendor keeps failing, stop calling it for a
//     while so we don't waste time on something that's clearly broken.
//   * A time budget, so one slow vendor can't hold up the whole request.

// Today there's just one vendor (proxycheck.io). To add more later, drop them into the `providers` list below — the fallback order, breaker, and timeout all apply to them automatically.

import config from '../../../config/config.js';
import { logger } from '../../../utils/logger.js';
import * as proxyCheck from './proxyCheckProvider.js';

// The vendors to try, in order. The first one is the primary.
const providers = [proxyCheck];

// Circuit-breaker state, one entry per vendor, kept in memory. Each server process learns on its own that a vendor is unhealthy and backs off — that's
// fine here, we don't need to share this across processes.
const breaker = new Map(); // name -> { fails, openUntil }

// "Open" = the breaker has tripped, so we're currently skipping this vendor.
const isOpen = (providerName) => {
  const state = breaker.get(providerName);
  return Boolean(state && state.openUntil > Date.now());
};

// A good call clears the vendor's failure count.
const recordSuccess = (providerName) => {
  breaker.set(providerName, { fails: 0, openUntil: 0 });
};

// A failed call bumps the count; once there are too many, we "open" the breaker
// (stop calling this vendor) until the cooldown period passes.
const recordFailure = (providerName) => {
  const cfg = config.ipIntelligence?.provider || {};
  const state = breaker.get(providerName) || { fails: 0, openUntil: 0 };
  state.fails += 1;
  if (state.fails >= (cfg.breakerFailureThreshold ?? 5)) {
    state.openUntil = Date.now() + (cfg.breakerCooldownMs ?? 30000);
    state.fails = 0;
    logger.warn('ip-intel provider breaker opened', { provider: providerName });
  }
  breaker.set(providerName, state);
};

export const breakerState = (providerName) =>
  isOpen(providerName) ? 'open' : 'closed';

/**
 * Ask the vendors about an IP, trying them in order until one answers, all
 * within the given time budget. Returns a normalized result (tagged with which
 * vendor answered) or null if nobody had data or every vendor was unavailable.
 */
export const lookup = async (ip, budgetMs) => {
  // Use the smaller of the configured vendor timeout and the caller's budget, so
  // a single vendor call can never outlast the time we were given.
  const configured = config.ipIntelligence?.provider?.timeoutMs ?? 3000;
  const timeout = Math.min(configured, budgetMs || configured);

  for (const provider of providers) {
    if (!provider.isConfigured?.() || isOpen(provider.name)) continue;

    try {
      const raw = await provider.lookup(ip, timeout);
      if (!raw) {
        // The vendor answered but simply has no info on this IP. That's not a failure, so don't trip the breaker — just try the next vendor.
        continue;
      }
      recordSuccess(provider.name);
      return {
        ...provider.normalize(raw),
        providerName: provider.name,
        source: 'provider',
      };
    } catch (err) {
      recordFailure(provider.name);
      logger.warn('ip-intel provider lookup failed', {
        provider: provider.name,
        err: err.code || err.message,
        status: err.response?.status,
        // vendor error body, e.g. proxycheck "denied"/quota message
        body: err.response?.data,
      });
    }
  }

  return null;
};
