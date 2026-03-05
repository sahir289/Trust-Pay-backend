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
    restrictVpnForRoles = ['VENDOR'],
    blockedCountries = [],
    roleRegionRules = {},
    defaultLocation = { latitude: 0, longitude: 0, accuracy: 1000 }, // Default fallback location
  } = { ...config.geoGuard, ...options };

  const vpnRolesSet = new Set(restrictVpnForRoles.map((r) => r.toUpperCase()));
  const blockedCountrySet = new Set(
    blockedCountries.map((c) => c.toLowerCase()),
  );

  return async (req, res, next) => {
    try {
      const clientIp = getClientIp(req);
      let location = req.body?.user_location;

      if (!location || typeof location !== 'object') {
        logger.warn('Location not provided, attempting to fetch from Proxy/VPN service', { ip: clientIp });
        const proxyInfo = await withTimeout(checkProxyAndVpn(clientIp), 3000, 'Proxy/VPN check');
        if (proxyInfo && proxyInfo.raw.latitude && proxyInfo.raw.longitude) {
          location = {
            latitude: proxyInfo.raw.latitude,
            longitude: proxyInfo.raw.longitude,
            accuracy: proxyInfo.accuracy || null,
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

      // if (accuracy > maxAccuracy) {
      //   console.log(accuracy, "accuracy", maxAccuracy, "max accuracy ++++");
      //   return next( new BadRequestError(
      //     `Location accuracy too low (${accuracy}m). Maximum allowed: ${maxAccuracy}m.`,
      //   ));
      // }

      const [proxyInfo, address] = await Promise.allSettled([
        withTimeout(checkProxyAndVpn(clientIp), 3000, 'Proxy/VPN check'),
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

      if (proxyInfo) {
        const { isVpn, country, region } = proxyInfo;

        if (isVpn && vpnRolesSet.has(userRole)) {
          logger.warn('VPN/Proxy blocked', {
            ip: clientIp,
            username: req.body.username,
            role: userRole,
          });
          return next( new BadRequestError(
            'VPN or proxy usage is not allowed for your account type.',
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
      }

      req.geo = {
        ip: clientIp,
        latitude,
        longitude,
        accuracy,
        address: address || null,
        proxy: proxyInfo || null,
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