import axios from 'axios';
import { logger } from '../utils/logger.js';
import { getRoleByUserNameDao } from '../apis/auth/authDao.js';
import { BadRequestError } from '../utils/appErrors.js';
const PROXY_CHECK_URL = process.env.PROXY_CHECK_URL;
const TestingIp = process.env.LOCAL_IP;

const loginMiddleware = async (req, res, next) => {
  try {
    // Get user's IP address
    let userIp =
      req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip;
    if (userIp === '::1') {
      userIp = TestingIp;
    }
    const role = await getRoleByUserNameDao(req.body.username);
    // Fetch geolocation data from proxycheck.io
    const url = PROXY_CHECK_URL.replace('$%7BuserIp%7D', userIp);
    const response = await axios.get(url);
    const userData = response.data[userIp];
    if (!userData) {
      logger.error('Error fetching location data for IP:', userIp);
      return res.status(500).json({ message: 'Error fetching location data' });
    }
    const { vpn, region, country } = userData;
    if (vpn === 'yes' && role.role == 'VENDOR') {
      // const id = req.params.merchantOrderId;
      logger.warn('VPN detected. Access denied.', userData);
      throw new BadRequestError('VPN usage is not allowed');
    }
    // Check if the user is from India
    if (
      country.toLowerCase() === 'india' &&
      region.toLowerCase() === 'gujarat' &&
      role.role == 'VENDOR'
    ) {
      logger.warn('Access denied for users from India.', {
        userIp,
        region,
        country,
      });
      throw new BadRequestError('Access denied from your location');
    }
    // Store user location data in request object
    req.user_location = {
      user_ip: userIp,
      country: userData.country,
      region: userData.region,
      city: userData.city,
      latitude: userData.latitude,
      longitude: userData.longitude,
    };
    next();
  } catch (error) {
    logger.error('Error in login middleware:', error);
    return res
      .status(500)
      .json({ message: 'Access denied from your location' });
  }
};

export default loginMiddleware;
