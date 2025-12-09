import axios from 'axios';
import { logger } from './logger.js';

const GEOLOCATION_API_URL = 'https://ipapi.co'; // Example API (replace with your preferred service)
const API_KEY = process.env.GEOLOCATION_API_KEY; // Add your API key if required

export const getCoordinatesFromIp = async (ip) => {
  try {
    const url = `${GEOLOCATION_API_URL}/${ip}/json/`;
    const response = await axios.get(url, {
      params: { key: API_KEY },
    });

    if (response.data && response.data.latitude && response.data.longitude) {
      return {
        latitude: response.data.latitude,
        longitude: response.data.longitude,
        accuracy: response.data.accuracy || null, // Optional, depends on the API
      };
    }

    logger.warn('Unable to fetch coordinates from IP', { ip });
    return null;
  } catch (error) {
    logger.error('Error fetching coordinates from IP', { ip, error: error.message });
    return null;
  }
};
