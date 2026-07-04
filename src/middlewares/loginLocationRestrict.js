import { BadRequestError, InternalServerError } from '../utils/appErrors.js';
import { logger } from '../utils/logger.js';
import config from '../config/config.js';
import { getRoleByUserNameDao } from '../apis/auth/authDao.js';
import { setTimeout as delay } from 'node:timers/promises';
import { checkProxyAndVpn } from '../utils/proxyCheckService.js';
import { reverseGeocode } from '../utils/reverseGeoCodeService.js';

// Helper - Promise with hard timeout (cancels after X ms)
const withTimeout = async (promise, ms, name = 'operation') => {
  let timer;
  const timeout = delay(ms).then(() => {
    throw new Error(`${name} timed out after ${ms}ms`);
  });

  try {
    return await Promise.race([promise, timeout]);
  } catch (error) {
    // If timed out, log and return null (fail-soft)
    if (error.message.includes('timed out')) {
      logger.warn(`${name} timed out`, { timeout: ms });
      return null;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
};

export const getClientIp = (req) => {
  const ip = (
    req.headers['x-forwarded-for']?.split(',')[0] ||
    req.headers['x-real-ip'] ||
    req.headers['cf-connecting-ip'] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.ip
  )?.trim();

  return ip === '::1' || ip === '127.0.0.1'
    ? config.app.testingIp || '1.1.1.1'
    : ip;
};

const createGeoGuard = (options = {}) => {
  const {
    // maxAccuracy = 100,
    // restrictVpnForRoles = ['VENDOR'],
    blockedCountries = [],
    roleRegionRules = {},
    defaultLocation = { latitude: 0, longitude: 0, accuracy: 1000 }, // Default fallback location
  } = { ...config.geoGuard, ...options };

  // const vpnRolesSet = new Set(restrictVpnForRoles.map((r) => r.toUpperCase()));
  const blockedCountrySet = new Set(
    blockedCountries.map((c) => c.toLowerCase()),
  );

  return async (req, res, next) => {
    try {
      const clientIp = getClientIp(req);
      // Device/tracing fingerprint captured for every login attempt.
      const device = {
        userAgent: req.headers['user-agent'] || null,
        platform: req.headers['sec-ch-ua-platform'] || null,
        mobile: req.headers['sec-ch-ua-mobile'] || null,
        language: req.headers['accept-language'] || null,
      };
      let location = req.body?.user_location;
      let prefetchedProxyInfo = null;
      
      if ((!location) || typeof location !== 'object') {
        logger.warn('Location not provided, attempting to fetch from Proxy/VPN service', { ip: clientIp });
        prefetchedProxyInfo = await withTimeout(
          checkProxyAndVpn(clientIp),
          3000,
          'Proxy/VPN check',
        );
        if (prefetchedProxyInfo?.raw?.latitude && prefetchedProxyInfo?.raw?.longitude) {
          location = {
            latitude: prefetchedProxyInfo.raw.latitude,
            longitude: prefetchedProxyInfo.raw.longitude,
            accuracy: prefetchedProxyInfo.accuracy || null,
          };
        } else {
          logger.error('Failed to fetch location from Proxy/VPN service', { ip: clientIp });
          location = defaultLocation;
        }
      }
      const { latitude, longitude, accuracy } = location;

      if (!latitude || !longitude) {
        return next( new BadRequestError(
          'Invalid location data. Latitude, longitude, and accuracy are required.',
        ));
      }

      const proxyInfoPromise = prefetchedProxyInfo
        ? Promise.resolve(prefetchedProxyInfo)
        : withTimeout(checkProxyAndVpn(clientIp), 3000, 'Proxy/VPN check');

      const [proxyInfo, address] = await Promise.allSettled([
        proxyInfoPromise,
        withTimeout(
          reverseGeocode(latitude, longitude),
          3000,
          'Reverse geocoding',
        ),
      ]).then((results) =>
        results.map((r) => (r.status === 'fulfilled' ? r.value : null)),
      );

      let userRole;
      if (req.body?.username) {
        try {
          const roleDoc = await getRoleByUserNameDao(req.body.username);
          userRole = roleDoc?.role?.toUpperCase() || userRole;
        } catch (err) {
          logger.warn('Failed to fetch user role during geo check', {
            error: err.code || err.message,
            username: req.body.username,
          });
        }
      }

      // Trace every login attempt (including ones about to be blocked) so the
      // user can be traced by IP, geo and device.
      logger.info('Login attempt trace', {
        ip: clientIp,
        username: req.body?.username,
        role: userRole,
        latitude,
        longitude,
        accuracy,
        country: proxyInfo?.country || null,
        region: proxyInfo?.region || null,
        isVpn: proxyInfo?.isVpn ?? null,
        device,
      });

      const origin = (req.headers.origin || req.headers.referer || '')
            .toLowerCase()
            .trim();
          let blockedOrigins = config?.LOGIN_BLOCK_ORIGIN;

          if (typeof blockedOrigins === 'string') {
            try {
              const cleaned = blockedOrigins.replace(/[“”]/g, '"'); // fix smart quotes
              blockedOrigins = JSON.parse(cleaned);
            } catch (err) {
              logger.error('Invalid LOGIN_BLOCK_ORIGIN JSON', {
                value: blockedOrigins,
                error: err.message,
              });
              blockedOrigins = [];
            }
          }
          if (!Array.isArray(blockedOrigins)) {
            blockedOrigins = [];
          }
          const isBlockedOrigin = blockedOrigins.some((blocked) => {
            if (typeof blocked !== 'string') return false;
            return origin.includes(blocked.toLowerCase().trim());
          });
          const isIndia =
            proxyInfo?.country?.toLowerCase() === 'in' ||
            proxyInfo?.country?.toLowerCase() === 'india';
          if (isBlockedOrigin && isIndia) {
            logger.warn('Login blocked: Blocked origin from India', {
              origin,
              country: proxyInfo?.country,
              ip: clientIp,
              username: req.body?.username,
              role: userRole,
            });
            return next(
              new BadRequestError('Access denied from your current location.'),
            );
          }
      // STRICT: every login must be positively cleared of VPN/proxy. If the
      // network status cannot be determined, deny the login (fail closed).
      if (!proxyInfo) {
        logger.warn('Login blocked: unable to verify VPN/proxy status', {
          ip: clientIp,
          username: req.body?.username,
          role: userRole,
        });
        return next(new BadRequestError(
          'Unable to verify your network. Please disable any VPN/proxy and try again.',
        ));
      }

      const { isVpn, country, region } = proxyInfo;

      if (isVpn) {
        logger.warn('VPN/Proxy blocked', {
          ip: clientIp,
          username: req.body.username,
          role: userRole,
        });
        return next( new BadRequestError(
          'VPN or proxy usage is not allowed. Please disable VPN/proxy and try again.',
        ));
      }

      if (country && blockedCountrySet.has(country.toLowerCase())) {
        return next( new BadRequestError('Access from your country is restricted.'));
      }

      const rule = roleRegionRules[userRole];
      const ruleCountries = rule?.countries?.map((c) => c.toLowerCase()) || [];
      if (rule && ruleCountries.includes(country?.toLowerCase())) {
        const blocked = rule.blockedRegions.map((r) => r.toLowerCase());
        if (region && blocked.includes(region.toLowerCase())) {
          logger.warn('Region blocked', {
            region,
            country,
            role: userRole,
            username: req.body.username,
          });
          return next(new BadRequestError(
            'Access denied from your current state/region.',
          ));
        }
      }

      req.geo = {
        ip: clientIp,
        latitude,
        longitude,
        accuracy,
        address: address || null,
        proxy: proxyInfo || null,
        device,
        role: userRole,
      };

      req.user_location = req.geo;

      next();
    } catch (error) {
      logger.error('Unexpected error in geoLocationGuard', {
        error: error.stack,
        ip: req.ip,
        bodyKeys: Object.keys(req.body || {}),
      });
      return next(new InternalServerError('Service temporarily unavailable', 502));
    }
  };
};

export const geoLocationGuard = createGeoGuard();