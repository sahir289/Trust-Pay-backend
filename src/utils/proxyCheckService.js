import axios from 'axios';
import config from '../config/config.js';
import { logger } from './logger.js';

const PROXY_CHECK_TIMEOUT = 8000;

export const checkProxyAndVpn = async (ip) => {
  if (!ip || ip === '::1' || ip === '127.0.0.1') return null;

  const url = config.proxyCheck.proxyCheckUrl.replace('$%7BuserIp%7D', encodeURIComponent(ip));

  try {
    const { data } = await axios.get(url, {
      timeout: PROXY_CHECK_TIMEOUT
    });

    const info = data[ip] || data;
    if (!info) return null;

    //NEED TO CHECK TOMORROW WHAT ACTUAL IT IS RETURNING TO PROXYINFO OBJECT
    return {
      isVpn: info.vpn === 'yes' || info.proxy === 'yes',
      country: info.country || info.country_name || null,
      region: info.region || info.region_name || info.city || null,
      provider: info.provider || info.organisation || null,
      raw: info,
    };
  } catch (error) {
    logger.warn('Proxy check failed', {
      ip,
      error: error.code || error.message,
    });
    return null;
  }
};