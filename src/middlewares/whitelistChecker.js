  import { sendError } from '../utils/responseHandlers.js';
  import ipaddr from 'ipaddr.js';

  const LOCALHOST_IPS = new Set(['::1', '127.0.0.1', '::ffff:127.0.0.1']);
  
  const resolveMerchantClientIp = (req) => {
    const ip = req.ip;
    if (LOCALHOST_IPS.has(ip) && process.env.LOCAL_IP) {
      return process.env.LOCAL_IP;
    }
    return ip;
  };
  
  // Normalize a merchant's configured whitelist (string or array, possibly
  // comma-separated) into a clean array of IP/CIDR strings.
  const normalizeWhitelist = (whitelistIps) =>
    (Array.isArray(whitelistIps) ? whitelistIps : [whitelistIps])
      .flatMap((ip) => (typeof ip === 'string' ? ip.split(',') : [String(ip)]))
      .map((ip) => ip.trim())
      .filter(Boolean);
  
  const isIpWhitelisted = (clientIp, whitelist) => {
    if (!clientIp) return false;
    let parsedClientIp;
  
    try {
      parsedClientIp = ipaddr.parse(clientIp);
    } catch {
      return false;
    }
  
    return whitelist.some((entry) => {
      try {
        // CIDR notation
        if (entry.includes('/')) {
          const [network, prefix] = ipaddr.parseCIDR(entry);
          return parsedClientIp.match([network, prefix]);
        }
  
        // Exact IP
        return parsedClientIp.toString() === ipaddr.parse(entry).toString();
      } catch {
        // Ignore invalid whitelist entries
        return false;
      }
    });
  };
  
  export const IPWhiteListChecker = async (req, res, next) => {
    try {
      const userIp = resolveMerchantClientIp(req);
  
      if (req.merchant?.config?.whitelist_ips) {
        const whitelist = normalizeWhitelist(
            req.merchant.config.whitelist_ips
        );
  
        if (
          whitelist.length > 0 &&
          !isIpWhitelisted(userIp, whitelist)
        ) {
          return sendError(res, 'IP not whitelisted', 403);
        }
      }
  
      next();
    } catch (error) {
      next(error);
    }
  };

  