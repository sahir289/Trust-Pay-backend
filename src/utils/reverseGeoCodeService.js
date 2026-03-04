import axios from 'axios';
import config from '../config/config.js'
import { logger } from './logger.js';

// const OSM_TIMEOUT = 6000;

export const reverseGeocode = async (latitude, longitude) => {
  try {
    const url = `${config.openStreetApi.openStreetMapUrl}?lat=${latitude}&lon=${longitude}${config.openStreetApi.openStreetMapExtraParams}`;

    const { data } = await axios.get(url, {
    headers: {
      "User-Agent": "TrustPay/2.0 (support@trustpays.com)"
    }
  });

    return data?.address || null;
  } catch (error) {
    logger.warn('Reverse geocoding failed', {
      lat: latitude,
      lon: longitude,
      error: error.message,
    });
    return null;
  }
};