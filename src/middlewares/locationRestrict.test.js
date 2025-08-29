// // __tests__/getUserLocationMiddleware.test.js
// import axios from 'axios';
// import getUserLocationMiddleware from '../middlewares/locationRestrict.js';
// import { logger } from '../utils/logger.js';
// import { processPayInRestricted } from '../utils/updateRestrictedLocationPayin.js';
// import { getPayInwithMerchantDao } from '../apis/payIn/payInDao.js';

// jest.mock('axios');
// jest.mock('../utils/logger.js', () => ({
//   logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
// }));
// jest.mock('../utils/updateRestrictedLocationPayin.js', () => ({
//   processPayInRestricted: jest.fn(),
// }));
// jest.mock('../apis/payIn/payInDao.js', () => ({
//   getPayInwithMerchantDao: jest.fn(),
// }));

// const mockRes = () => {
//   const res = {};
//   res.status = jest.fn().mockReturnThis();
//   res.send = jest.fn().mockReturnThis();
//   res.json = jest.fn().mockReturnThis();
//   return res;
// };

// describe('getUserLocationMiddleware', () => {
//   let req, res, next;

//   beforeEach(() => {
//     req = {
//       headers: {},
//       connection: { remoteAddress: '1.2.3.4' },
//       ip: '1.2.3.4',
//       params: { merchantOrderId: 'm1' },
//       user_location: {},
//     };
//     res = mockRes();
//     next = jest.fn();

//     // Ensure environment variables are set
//     process.env.BLOCK_LAT = '28.6';
//     process.env.BLOCK_LONG = '77.2';
//     process.env.PROXY_CHECK_URL = 'http://proxycheck.io/v2/$%7BuserIp%7D';
//     process.env.LOCAL_IP = '127.0.0.1';

//     jest.clearAllMocks();
//   });

//   it('should block hardcoded fraud IP', async () => {
//     req.headers['x-forwarded-for'] = '13.41.235.43';

//     await getUserLocationMiddleware(req, res, next);

//     expect(logger.warn).toHaveBeenCalledWith('Fraud User. Access denied.', '13.41.235.43');
//     expect(res.status).toHaveBeenCalledWith(403);
//     expect(res.send).toHaveBeenCalledWith('403: Access denied');
//     expect(next).not.toHaveBeenCalled();
//   });

//   it('should return 500 if no userData from axios', async () => {
//     axios.get.mockResolvedValueOnce({ data: { '1.2.3.4': undefined } });

//     await getUserLocationMiddleware(req, res, next);

//     expect(res.status).toHaveBeenCalledWith(500);
//     expect(res.json).toHaveBeenCalledWith({
//       message: 'Error fetching location data',
//     });
//     expect(next).not.toHaveBeenCalled();
//   });

//   it('should block if user IP is in blocked_users_ip', async () => {
//     axios.get.mockResolvedValueOnce({
//       data: { '1.2.3.4': { latitude: 10, longitude: 10, vpn: 'no', country: 'IN', region: 'DL' } },
//     });
//     getPayInwithMerchantDao.mockResolvedValueOnce({
//       blocked_users_ip: ['1.2.3.4'], // Match middleware's expectation
//       blocked_users_id: [],
//       userid: 'u1',
//     });
//     processPayInRestricted.mockResolvedValueOnce('restricted-url');

//     req.headers['x-forwarded-for'] = '1.2.3.4';

//     await getUserLocationMiddleware(req, res, next);

//     expect(logger.warn).toHaveBeenCalledWith(
//       'Blocked user IP. Access denied.',
//       { userIp: '1.2.3.4' }
//     );
//     expect(res.status).toHaveBeenCalledWith(403);
//     expect(res.json).toHaveBeenCalledWith({
//       error: { message: 'Access Denied!', data: { url: 'restricted-url' } },
//     });
//     expect(next).not.toHaveBeenCalled();
//   });

//   it('should block if user ID is restricted', async () => {
//     axios.get.mockResolvedValueOnce({
//       data: { '1.2.3.4': { latitude: 10, longitude: 10, vpn: 'no', country: 'IN', region: 'DL' } },
//     });
//     getPayInwithMerchantDao.mockResolvedValueOnce({
//       blocked_users_ip: [],
//       blocked_users_id: ['u1'], // Match middleware's expectation
//       userid: 'u1',
//     });
//     processPayInRestricted.mockResolvedValueOnce('restricted-url');

//     await getUserLocationMiddleware(req, res, next);

//     expect(logger.warn).toHaveBeenCalledWith('Blocked user ID. Access denied.');
//     expect(res.status).toHaveBeenCalledWith(403);
//     expect(res.json).toHaveBeenCalledWith({
//       error: { message: 'Access Denied!', data: { url: 'restricted-url' } },
//     });
//     expect(next).not.toHaveBeenCalled();
//   });

//   it('should block if vpn detected', async () => {
//     axios.get.mockResolvedValueOnce({
//       data: { '1.2.3.4': { latitude: 10, longitude: 10, vpn: 'yes', country: 'IN', region: 'DL' } },
//     });
//     getPayInwithMerchantDao.mockResolvedValueOnce({
//       blocked_users_ip: [],
//       blocked_users_id: [],
//       userid: 'u1',
//     });
//     processPayInRestricted.mockResolvedValueOnce('vpn-url');

//     await getUserLocationMiddleware(req, res, next);

//     expect(logger.warn).toHaveBeenCalledWith(
//       'VPN detected. Access denied.',
//       { latitude: 10, longitude: 10, vpn: 'yes', country: 'IN', region: 'DL' }
//     );
//     expect(res.status).toHaveBeenCalledWith(403);
//     expect(res.json).toHaveBeenCalledWith({
//       error: { message: 'VPN is Not Allowed!', data: { url: 'vpn-url' } },
//     });
//     expect(next).not.toHaveBeenCalled();
//   });

//   it('should block if country not in unblocked list', async () => {
//     axios.get.mockResolvedValueOnce({
//       data: { '1.2.3.4': { latitude: 10, longitude: 10, vpn: 'no', country: 'FR', region: 'Paris' } },
//     });
//     getPayInwithMerchantDao.mockResolvedValueOnce({
//       blocked_users_ip: [],
//       blocked_users_id: [],
//       userid: 'u1',
//       unblockedcountries: [{ country: 'IN', regions: [] }],
//     });
//     processPayInRestricted.mockResolvedValueOnce('country-url');

//     await getUserLocationMiddleware(req, res, next);

//     expect(logger.error).toHaveBeenCalledWith(
//       'Access restricted for users from FR.',
//       { latitude: 10, longitude: 10, vpn: 'no', country: 'FR', region: 'Paris' }
//     );
//     expect(res.status).toHaveBeenCalledWith(403);
//     expect(res.json).toHaveBeenCalledWith({
//       error: { message: 'Oops ! Service not available', data: { url: 'country-url' } },
//     });
//     expect(next).not.toHaveBeenCalled();
//   });

//   it('should block if region restricted', async () => {
//     axios.get.mockResolvedValueOnce({
//       data: { '1.2.3.4': { latitude: 10, longitude: 10, vpn: 'no', country: 'IN', region: 'KA' } },
//     });
//     getPayInwithMerchantDao.mockResolvedValueOnce({
//       blocked_users_ip: [],
//       blocked_users_id: [],
//       userid: 'u1',
//       unblockedcountries: [{ country: 'IN', regions: ['DL'] }],
//     });
//     processPayInRestricted.mockResolvedValueOnce('region-url');

//     await getUserLocationMiddleware(req, res, next);

//     expect(logger.error).toHaveBeenCalledWith(
//       'Access restricted for users in KA.',
//       { latitude: 10, longitude: 10, vpn: 'no', country: 'IN', region: 'KA' }
//     );
//     expect(res.status).toHaveBeenCalledWith(403);
//     expect(res.json).toHaveBeenCalledWith({
//       error: { message: 'Oops ! Service not available', data: { url: 'region-url' } },
//     });
//     expect(next).not.toHaveBeenCalled();
//   });

//   it('should block if inside restricted lat/long radius', async () => {
//     axios.get.mockResolvedValueOnce({
//       data: { '1.2.3.4': { latitude: 28.61, longitude: 77.21, vpn: 'no', country: 'IN', region: 'DL' } },
//     });
//     getPayInwithMerchantDao.mockResolvedValueOnce({
//       blocked_users_ip: [],
//       blocked_users_id: [],
//       userid: 'u1',
//       unblockedcountries: [{ country: 'IN', regions: ['DL'] }],
//     });
//     processPayInRestricted.mockResolvedValueOnce('region-url');

//     await getUserLocationMiddleware(req, res, next);

//     expect(logger.error).toHaveBeenCalledWith(
//       'Access restricted in your region.',
//       { latitude: 28.61, longitude: 77.21, vpn: 'no', country: 'IN', region: 'DL' }
//     );
//     expect(res.status).toHaveBeenCalledWith(403);
//     expect(res.send).toHaveBeenCalledWith('Access Denied!');
//     expect(next).not.toHaveBeenCalled();
//   });

//   it('should handle invalid latitude/longitude', async () => {
//     axios.get.mockResolvedValueOnce({
//       data: { '1.2.3.4': { latitude: 'NaN', longitude: 'NaN', vpn: 'no', country: 'IN', region: 'DL' } },
//     });
//     getPayInwithMerchantDao.mockResolvedValueOnce({
//       blocked_users_ip: [],
//       blocked_users_id: [],
//       userid: 'u1',
//     });

//     await getUserLocationMiddleware(req, res, next);

//     expect(logger.warn).toHaveBeenCalledWith('Invalid latitude/longitude data received.');
//     expect(res.status).toHaveBeenCalledWith(500);
//     expect(res.send).toHaveBeenCalledWith('500: Access denied');
//     expect(next).not.toHaveBeenCalled();
//   });

//   it('should set req.user_location and call next() when all checks pass', async () => {
//     axios.get.mockResolvedValueOnce({
//       data: {
//         '1.2.3.4': {
//           latitude: 20,
//           longitude: 80,
//           vpn: 'no',
//           country: 'IN',
//           region: 'DL',
//           continent: 'Asia',
//           continentcode: 'AS',
//           timezone: 'IST',
//           city: 'Delhi',
//           postcode: '110001',
//         },
//       },
//     });
//     getPayInwithMerchantDao.mockResolvedValueOnce({
//       blocked_users_ip: [],
//       blocked_users_id: [],
//       userid: 'u1',
//       unblockedcountries: [{ country: 'IN', regions: ['DL'] }],
//     });

//     process.env.BLOCK_LAT = '0';
//     process.env.BLOCK_LONG = '0';

//     await getUserLocationMiddleware(req, res, next);

//     expect(req.user_location).toMatchObject({
//       user_ip: '1.2.3.4',
//       latitude: 20,
//       longitude: 80,
//       vpn: 'no',
//       country: 'IN',
//       region: 'DL',
//       continent: 'Asia',
//       continent_code: 'AS',
//       timezone: 'IST',
//       city: 'Delhi',
//       postcode: '110001',
//     });
//     expect(next).toHaveBeenCalled();
//   });

//   it('should handle axios/network error gracefully', async () => {
//     axios.get.mockRejectedValueOnce(new Error('Network error'));

//     await getUserLocationMiddleware(req, res, next);

//     expect(logger.error).toHaveBeenCalledWith(
//       'Error fetching user location:',
//       expect.any(Error)
//     );
//     expect(res.status).toHaveBeenCalledWith(500);
//     expect(res.json).toHaveBeenCalledWith({
//       message: 'Error fetching user location',
//     });
//     expect(next).not.toHaveBeenCalled();
//   });
// });