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
      connection: {},
      params: { merchantOrderId: 'order123' },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
      json: jest.fn(),
    };
    next = jest.fn();

    process.env.BLOCK_LAT = '28.7041';
    process.env.BLOCK_LONG = '77.1025';
    process.env.PROXY_CHECK_URL = "https://proxycheck.io/v2/$%7BuserIp%7D?key=358et2-10077m-8r2xb0-7i5a08&vpn=3&asn=1";
    process.env.LOCAL_IP = '127.0.0.1';

    jest.clearAllMocks();
  });

  it('should block fraud IP immediately', async () => {
    req.ip = '13.41.235.43';
    await getUserLocationMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.send).toHaveBeenCalledWith('403: Access denied');
    expect(next).not.toHaveBeenCalled();
  });

  it('should block if user IP is in blocked_users_ip', async () => {
    req.ip = '1.2.3.4';
    axios.get.mockResolvedValue({
      data: {
        '1.2.3.4': { latitude: 20, longitude: 20, vpn: 'no', region: 'Delhi', country: 'IN' },
      },
    });
    getPayInwithMerchantDao.mockResolvedValue({
      blocked_users_ip: [{ user_ip: ['1.2.3.4'] }],
      blocked_users_id: [{ userId: ['abc'] }],
      unblockedcountries: [{ country: 'IN', regions: ['Delhi'] }],
      userid: 'user123',   
    });
    processPayInRestricted.mockResolvedValue('restricted-url');
  
    await getUserLocationMiddleware(req, res, next);
  
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: { message: 'Access Denied!', data: { url: 'restricted-url' } },
    });
    expect(next).not.toHaveBeenCalled();
  });
  

  it('should block if VPN detected', async () => {
    req.ip = '5.6.7.8';
    axios.get.mockResolvedValue({
      data: {
        '5.6.7.8': { latitude: 20, longitude: 20, vpn: 'yes', region: 'Delhi', country: 'IN' },
      },
    });
    getPayInwithMerchantDao.mockResolvedValue({
      blocked_users_ip: [{ user_ip: [] }],
      blocked_users_id: [{ userId: [] }],
      unblockedcountries: [{ country: 'IN', regions: ['Delhi'] }],
      userid: 'user123',
    });
    processPayInRestricted.mockResolvedValue('vpn-blocked-url');

    await getUserLocationMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: { message: 'VPN is Not Allowed!', data: { url: 'vpn-blocked-url' } },
    });
  });

  it('should allow if user is valid and call next()', async () => {
    req.ip = '9.9.9.9';
    axios.get.mockResolvedValue({
      data: {
        '9.9.9.9': {
          latitude: 28.7,
          longitude: 77.1,
          vpn: 'no',
          region: 'Delhi',
          country: 'IN',
          continent: 'Asia',
          continentcode: 'AS',
          timezone: 'IST',
          city: 'Delhi',
          postcode: '110001',
        },
      },
    });
    getPayInwithMerchantDao.mockResolvedValue({
      blocked_users_ip: [{ user_ip: [] }],
      blocked_users_id: [{ userId: [] }],
      unblockedcountries: [{ country: 'IN', regions: ['Delhi'] }],
      userid: 'user123',
    });

    await getUserLocationMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user_location).toEqual(
      expect.objectContaining({
        user_ip: '9.9.9.9',
        country: 'IN',
        region: 'Delhi',
      }),
    );
  });

  it('should handle axios error gracefully', async () => {
    req.ip = '11.11.11.11';
    axios.get.mockRejectedValue(new Error('Network Error'));

    await getUserLocationMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Error fetching user location' });
  });
});
