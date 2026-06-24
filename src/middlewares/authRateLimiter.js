
// Dedicated, stricter rate limiting + brute-force lockout for authentication
// endpoints (login, 2FA verification, password reset, OTP verification).
//
// This is intentionally SEPARATE from the global limiter in rateLimiter.js:
//   - A general per-IP limiter caps the raw request volume to /auth/* routes.
//   - A two-tier brute-force guard locks out credential stuffing / OTP guessing
//     on a per (username + IP) basis AND a per-IP daily basis, independent of
//     the volume limiter, so an attacker cannot keep guessing by staying just
//     under the volume threshold.
//
// Pattern follows the official `rate-limiter-flexible` brute-force recipe:
// consume a point only on FAILURE, reset on SUCCESS.

import { RateLimiterRedis, RateLimiterMemory } from 'rate-limiter-flexible';
import jwt from 'jsonwebtoken';
import redisClient from '../utils/redisClient.js';
import { logger } from '../utils/logger.js';
import { getClientIp } from './loginLocationRestrict.js';
import { sendError } from '../utils/responseHandlers.js';

const parseInt10 = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const buildLimiter = (opts) => {
  try {
    return new RateLimiterRedis({ storeClient: redisClient, ...opts });
  } catch (err) {
    logger.error(
      `Redis unavailable for auth limiter "${opts.keyPrefix}", using in-memory fallback`,
      err,
    );
    return new RateLimiterMemory(opts);
  }
};

// General per-IP volume limiter for ALL /auth/* routes.
const AUTH_API_POINTS = parseInt10(process.env.AUTH_API_RL_POINTS, 30);
const AUTH_API_DURATION = parseInt10(process.env.AUTH_API_RL_DURATION, 60);
const AUTH_API_BLOCK = parseInt10(process.env.AUTH_API_RL_BLOCK, 60);

const authApiLimiter = buildLimiter({
  keyPrefix: 'rl_auth_api',
  points: AUTH_API_POINTS,
  duration: AUTH_API_DURATION,
  blockDuration: AUTH_API_BLOCK,
});

// Brute-force lockout limiters (consume on failure only).
// Per username+IP: small number of consecutive failures, then a hard block.
const MAX_CONSECUTIVE_FAILS = parseInt10(process.env.AUTH_MAX_FAILS, 5);
const CONSECUTIVE_FAIL_BLOCK = parseInt10(
  process.env.AUTH_FAIL_BLOCK_SECONDS,
  60 * 15, // 15 minutes
);
const limiterConsecutiveFails = buildLimiter({
  keyPrefix: 'login_fail_user_ip',
  points: MAX_CONSECUTIVE_FAILS,
  duration: 60 * 60 * 3, // remember failures for 3h
  blockDuration: CONSECUTIVE_FAIL_BLOCK,
});

// Per IP across all usernames: stops distributed account spraying from one host.
const MAX_FAILS_BY_IP = parseInt10(process.env.AUTH_MAX_FAILS_BY_IP, 100);
const limiterSlowBruteByIp = buildLimiter({
  keyPrefix: 'login_fail_ip_daily',
  points: MAX_FAILS_BY_IP,
  duration: 60 * 60 * 24, // per day
  blockDuration: 60 * 60, // block for 1h once exceeded
});

const ipKeyOf = (req) => String(getClientIp(req) || 'unknown');

const usernameIpKeyOf = (identity, ipKey) =>
  identity ? `${String(identity).toLowerCase()}::${ipKey}` : null;


// General middleware: apply to the whole /auth router.
export const authApiRateLimiter = async (req, res, next) => {
  const key = ipKeyOf(req);
  try {
    await authApiLimiter.consume(key);
    return next();
  } catch (error_) {
    const retryAfter = Math.max(1, Math.ceil((error_?.msBeforeNext || 0) / 1000));
    res.setHeader('Retry-After', String(retryAfter));
    logger.warn(`Auth API rate limit exceeded for ${key}`, {
      path: req.path,
      retryAfter,
    });
    return sendError(res, 'Too many requests to authentication service. Please try again later.', 429);
  }
};

// Brute-force guard factory. `getIdentity(req)` returns the account identifier (username) used to scope the lockout. Attaches keys to req for the record/reset helpers to use after the credential check runs.
export const createAuthBruteGuard = (getIdentity) => async (req, res, next) => {
  try {
    const ipKey = ipKeyOf(req);
    const identity = (() => {
      try {
        return getIdentity(req);
      } catch {
        return '';
      }
    })();
    const userIpKey = usernameIpKeyOf(identity, ipKey);

    const [resByIp, resByUserIp] = await Promise.all([
      limiterSlowBruteByIp.get(ipKey),
      userIpKey ? limiterConsecutiveFails.get(userIpKey) : Promise.resolve(null),
    ]);

    let retrySecs = 0;
    if (
      resByIp &&
      resByIp.consumedPoints >= MAX_FAILS_BY_IP &&
      resByIp.msBeforeNext > 0
    ) {
      retrySecs = Math.ceil(resByIp.msBeforeNext / 1000);
    } else if (
      resByUserIp &&
      resByUserIp.consumedPoints >= MAX_CONSECUTIVE_FAILS &&
      resByUserIp.msBeforeNext > 0
    ) {
      retrySecs = Math.ceil(resByUserIp.msBeforeNext / 1000);
    }

    if (retrySecs > 0) {
      res.setHeader('Retry-After', String(retrySecs));
      logger.warn('Auth brute-force lockout active', {
        ip: ipKey,
        identity: identity ? String(identity).slice(0, 40) : undefined,
        retrySecs,
        path: req.path,
      });
      return sendError(res, `Account temporarily locked due to too many failed attempts. Try again in ${retrySecs} seconds.`, 429);
    }

    req.authBruteKeys = { ipKey, userIpKey };
    return next();
  } catch (err) {
    // Fail-open on limiter infrastructure errors so auth stays available,
    // but log loudly so the incident is visible.
    logger.error('Auth brute-force guard error (failing open):', err);
    req.authBruteKeys = { ipKey: ipKeyOf(req), userIpKey: null };
    return next();
  }
};

// Middleware for the two public auth endpoints.
export const loginBruteGuard = createAuthBruteGuard(
  (req) => req.body?.username || req.body?.userName || '',
);

export const verify2faBruteGuard = createAuthBruteGuard((req) => {
  const token = req.body?.preAuthToken;
  if (!token) return '';
  // decode (not verify) — only used to scope the rate-limit key.
  const decoded = jwt.decode(token);
  // Namespace separately from password failures so a correct-password login
  // does not reset the OTP-guessing lockout.
  return decoded?.user_name ? `2fa:${decoded.user_name}` : '';
});

// Record a failed authentication attempt (call AFTER credentials are rejected).
export const recordAuthFailure = async (req) => {
  const { ipKey, userIpKey } = req.authBruteKeys || {};
  const tasks = [];
  if (ipKey) tasks.push(limiterSlowBruteByIp.consume(ipKey));
  if (userIpKey) tasks.push(limiterConsecutiveFails.consume(userIpKey));
  // Swallow limiter rejections — these throw when the limit is hit, which is
  // expected; the next request will be blocked by the guard.
  await Promise.allSettled(tasks);
};

// Clear the per-account failure counter on a successful authentication.
export const resetAuthFailures = async (req) => {
  const { userIpKey } = req.authBruteKeys || {};
  if (!userIpKey) return;
  try {
    await limiterConsecutiveFails.delete(userIpKey);
  } catch (err) {
    logger.warn('Failed to reset auth failure counter', err);
  }
};
