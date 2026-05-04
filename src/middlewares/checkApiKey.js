import { getMerchantsByCodeDao } from '../apis/merchants/merchantDao.js';

export const checkApiKey = async (req, res, next) => {
  const payload = req.query;
  const x_api_key = req.headers['x-api-key'];

  let userIp =
    req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip;
  const TestingIp = process.env.LOCAL_IP;
  // Handle localhost IP for testing
  userIp = userIp === '::1' ? TestingIp : userIp;
  const { code, roleToken = null } = payload;

  if (!x_api_key && roleToken) {
    const merchantArr = await getMerchantsByCodeDao(code);
    const merchant = merchantArr[0];
    if (!merchant) {
      return {
        status: 400,
        message: 'Invalid merchant code or API key',
      };
    }

    if (merchant?.config?.whitelist_ips) {
      // normalize whitelist to a clean array of strings
      const whitelist = []
        .concat(merchant.config.whitelist_ips) // handles string or array
        .flatMap((ip) =>
          typeof ip === 'string' ? ip.split(',') : [String(ip)],
        )
        .map((ip) => ip.trim())
        .filter(Boolean);

      // If whitelist ip's exists and user IP is not allowed
      if (whitelist.length > 0 && !whitelist.includes(userIp)) {
        return {
          status: 400,
          message: 'IP not whitelisted',
        };
      }
    }
  }

//   if (!x_api_key) {
//     return res.status(403).json({
//       success: false,
//       message: 'x-api-key header is missing',
//     });
//   }

  // if (!x_api_key && Role.ADMIN === "ADMIN") {
  //     return
  // }

  //       const VALID_API_KEY = 'my-secret-key';

  //   if (x_api_key !== VALID_API_KEY) {
  //     return res.status(403).json({
  //       success: false,
  //       message: 'Invalid API key',
  //     });
  //   }

  next();
};
