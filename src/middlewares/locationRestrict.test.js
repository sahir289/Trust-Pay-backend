import getUserLocationMiddleware from './locationRestrict.js';
import axios from 'axios';
import { processPayInRestricted } from '../utils/updateRestrictedLocationPayin.js';
import { getPayInwithMerchantDao } from '../apis/payIn/payInDao.js';

jest.mock('axios');
jest.mock('../utils/logger.js', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
  },
}));
jest.mock('../utils/updateRestrictedLocationPayin.js', () => ({
  processPayInRestricted: jest.fn(),
}));
jest.mock('../apis/payIn/payInDao.js', () => ({
  getPayInwithMerchantDao: jest.fn(),
}));

describe('getUserLocationMiddleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {},
      connection: { remoteAddress: '1.2.3.4' },
      params: { merchantOrderId: 'order123' },
      ip: '1.2.3.4',
    };

    res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
      json: jest.fn(),
    };

    next = jest.fn();

    process.env.BLOCK_LAT = '28.7041';
    process.env.BLOCK_LONG = '77.1025';
    process.env.LOCAL_IP = '127.0.0.1';
    process.env.PROXY_CHECK_URL =
      'https://proxycheck.io/v2/$%7BuserIp%7D?vpn=3';

    jest.clearAllMocks();
  });

  const mockGeoResponse = (overrides = {}) => ({
    data: {
      '1.2.3.4': {
        latitude: 40,
        longitude: 40,
        vpn: 'no',
        region: 'Delhi',
        country: 'IN',
        continent: 'Asia',
        continentcode: 'AS',
        timezone: 'IST',
        city: 'Delhi',
        postcode: '110001',
        ...overrides,
      },
    },
  });

  const mockPayIn = (overrides = {}) => ({
    userid: 'user123',
    blocked_users_ip: [],
    blocked_users_id: [],
    unblockedcountries: [
      { country: 'IN', regions: ['Delhi'] },
    ],
    config: {},
    ...overrides,
  });

  test('should block hardcoded fraud IP', async () => {
    req.connection.remoteAddress = '13.41.235.43';

    await getUserLocationMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.send).toHaveBeenCalledWith('403: Access denied');
    expect(next).not.toHaveBeenCalled();
  });

  test('should return 500 if proxy API returns no user data', async () => {
    axios.get.mockResolvedValue({ data: {} });

    await getUserLocationMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Error fetching location data',
    });
  });

  test('should block if IP exists in blocked_users_ip', async () => {
    axios.get.mockResolvedValue(mockGeoResponse());
    getPayInwithMerchantDao.mockResolvedValue(
      mockPayIn({
        blocked_users_ip: [{ user_ip: ['1.2.3.4'] }],
      }),
    );
    processPayInRestricted.mockResolvedValue('redirect-url');

    await getUserLocationMiddleware(req, res, next);

    expect(processPayInRestricted).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        message: 'Access Denied!',
        data: { url: 'redirect-url' },
      },
    });
  });

  test('should block if userId is blocked', async () => {
    axios.get.mockResolvedValue(mockGeoResponse());
    getPayInwithMerchantDao.mockResolvedValue(
      mockPayIn({
        blocked_users_id: [{ userId: ['user123'] }],
      }),
    );
    processPayInRestricted.mockResolvedValue('redirect-url');

    await getUserLocationMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(processPayInRestricted).toHaveBeenCalled();
  });

  test('should block VPN users', async () => {
    axios.get.mockResolvedValue(
      mockGeoResponse({ vpn: 'yes' }),
    );
    getPayInwithMerchantDao.mockResolvedValue(mockPayIn());
    processPayInRestricted.mockResolvedValue('vpn-url');

    await getUserLocationMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        message: 'VPN is Not Allowed!',
        data: { url: 'vpn-url' },
      },
    });
  });

  test('should block country not in unblockedcountries', async () => {
    axios.get.mockResolvedValue(
      mockGeoResponse({ country: 'US' }),
    );
    getPayInwithMerchantDao.mockResolvedValue(mockPayIn());
    processPayInRestricted.mockResolvedValue('country-url');

    await getUserLocationMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(processPayInRestricted).toHaveBeenCalled();
  });

  test('should block region not allowed', async () => {
    axios.get.mockResolvedValue(
      mockGeoResponse({ region: 'Mumbai' }),
    );
    getPayInwithMerchantDao.mockResolvedValue(mockPayIn());
    processPayInRestricted.mockResolvedValue('region-url');

    await getUserLocationMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(processPayInRestricted).toHaveBeenCalled();
  });

  test('should allow valid user and call next()', async () => {
    axios.get.mockResolvedValue(mockGeoResponse());
    getPayInwithMerchantDao.mockResolvedValue(mockPayIn());

    await getUserLocationMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user_location).toBeDefined();
  });

  test('should return 500 on axios error', async () => {
    axios.get.mockRejectedValue(new Error('API down'));

    await getUserLocationMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Error fetching user location',
    });
  });
});
