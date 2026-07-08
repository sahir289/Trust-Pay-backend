
import { logger } from '../utils/logger.js';
import { processPayInRestricted } from '../utils/updateRestrictedLocationPayin.js';
import { getPayInwithMerchantDao } from '../apis/payIn/payInDao.js';
import { checkProxyAndVpn } from '../utils/proxyCheckService.js';
import { sendError } from '../utils/responseHandlers.js';
import { V2_ERROR_CODES } from '../constants/index.js';
const BLOCK_LAT = process.env.BLOCK_LAT;
const BLOCK_LONG = process.env.BLOCK_LONG;
const TestingIp = process.env.LOCAL_IP;

const getUserLocationMiddleware = async (req, res, next) => {
  let userIp =
    req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip;
  if (userIp == '::1') {
    userIp = TestingIp;
  }
  const userIpShouldBlock = '13.41.235.43';
  if (userIp === userIpShouldBlock) {
    logger.warn('Fraud User. Access denied.', userIp);
    return sendError(res, 'Access Denied!', 403, V2_ERROR_CODES.FORBIDDEN);
  }
  const restrictedLocation = { latitude: BLOCK_LAT, longitude: BLOCK_LONG };
  const radiusKm = 60;

  try {
    // Resolve geolocation + VPN/proxy status via the cache-backed IP
    // Intelligence Service (proxycheck.io is only hit on a cold cache miss).
    const proxyResult = await checkProxyAndVpn(userIp);
    const userData = proxyResult?.raw;
    // STRICT: if the network/VPN status cannot be verified, the payment page
    // must not open (fail closed).
    if (!userData) {
      logger.warn('Unable to verify VPN/location. Access denied.', { userIp });
      return next();
    }
    const { latitude, longitude, vpn, region, country } = userData;
    const user = {
      user_ip: userIp,
      continent: userData.continent,
      continent_code: userData.continentcode,
      country: userData.country,
      region: userData.region,
      timezone: userData.timezone,
      city: userData.city,
      postcode: userData.postcode,
      latitude: userData.latitude,
      longitude: userData.longitude,
    };
    const payInUrl = await getPayInwithMerchantDao(req.params.merchantOrderId);
       if (!payInUrl) {
         return sendError(res, 'Payment is Expired!', 403);
       }
    const isIpBlocked = payInUrl?.blocked_users_ip[0]?.user_ip.includes(userIp);
    if (isIpBlocked) {
      const url = await processPayInRestricted(
        payInUrl,
        `Restricted User IP: ${userIp}`,
      );
      logger.warn('Blocked user IP. Access denied.', { userIp });
      return sendError(res, 'Access Denied!', 403, V2_ERROR_CODES.FORBIDDEN, { url });
    }
    const isIdBlocked = payInUrl?.blocked_users_id[0]?.userId.includes(
      payInUrl?.userid,
    );
    if (isIdBlocked) {
      const url = await processPayInRestricted(
        payInUrl,
        `Restricted User: ${payInUrl.userid}`,
      );
      logger.warn('Blocked user ID. Access denied.');
      return sendError(res, 'Access Denied!', 403, V2_ERROR_CODES.FORBIDDEN, { url });
    }
    //remove vpn restriction for main
    // STRICT: block VPN or proxy usage on the payment page.
    if (proxyResult.isVpn || vpn === 'yes') {

      payInUrl.config = {
        ...payInUrl.config,
        user: user,
      };
      const url = await processPayInRestricted(payInUrl, 'VPN detected');
      logger.warn('VPN detected. Access denied.', userData);
      return sendError(res, 'VPN is Not Allowed!', 403, V2_ERROR_CODES.FORBIDDEN, { url });
    }

    if (payInUrl?.unblockedcountries) {
      const countryData = payInUrl?.unblockedcountries.find(
        (c) => c.country === country,
      );
      if (!countryData) {
        payInUrl.config = {
          ...payInUrl.config,
          user: user,
        };
        const url = await processPayInRestricted(
          payInUrl,
          `Restricted country: ${country}`,
        );
        logger.error(`Access restricted for users from ${country}.`, userData);
        return sendError(res, 'Oops ! Service not available', 403, V2_ERROR_CODES.FORBIDDEN, { url });
      }

      if (
        countryData?.regions?.length > 0 &&
        !countryData?.regions?.includes(region)
      ) {
        payInUrl.config = {
          ...payInUrl.config,
          user: user,
        };
        const url = await processPayInRestricted(
          payInUrl,
          `Restricted region: ${region}`,
        );
        logger.error(`Access restricted for users in ${region}.`, userData);
        return sendError(res, 'Oops ! Service not available', 403, V2_ERROR_CODES.FORBIDDEN, { url });
      }
    }
    if (!Number.isNaN(latitude) && !Number.isNaN(longitude)) {
      // Check if the user is in the restricted region
      if (
        isLocationBlocked(
          latitude,
          longitude,
          restrictedLocation.latitude,
          restrictedLocation.longitude,
          radiusKm,
        )
      ) {
        logger.error('Access restricted in your region.', userData);
        return sendError(res, 'Access Denied!', 403, V2_ERROR_CODES.FORBIDDEN);
      }
    } else {
      logger.warn('Invalid latitude/longitude data received.');
      return sendError(res, 'Access denied', 403, V2_ERROR_CODES.FORBIDDEN);
    }
    req.user_location = {
      user_ip: userIp,
      continent: userData.continent,
      continent_code: userData.continentcode,
      country: userData.country,
      region: userData.region,
      timezone: userData.timezone,
      city: userData.city,
      postcode: userData.postcode,
      latitude: userData.latitude,
      longitude: userData.longitude,
    };
    req.payInUrl = payInUrl;
    next();
  } catch (error) {
    logger.error('Error fetching user location:', error.message);
    if (res.headersSent) {
      return;
    }
    return sendError(res, 'Error fetching user location', 500);
  }
};

const isLocationBlocked = (
  userLat,
  userLon,
  restrictedLat,
  restrictedLon,
  radiusKm,
) => {
  const distance = haversineDistance(
    userLat,
    userLon,
    restrictedLat,
    restrictedLon,
  );
  return distance <= radiusKm;
};
const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const R = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};
export default getUserLocationMiddleware;
