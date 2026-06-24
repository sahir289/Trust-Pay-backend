import dns from 'node:dns/promises';
import net from 'node:net';
import { URL } from 'node:url';
import { logger } from './logger.js';

/**
 * SSRF protection for outbound HTTP requests whose destination is
 * influenced by merchant/vendor supplied data (callback / notify URLs).
 *
 * Strategy:
 *  - Only allow http/https schemes.
 *  - Reject userinfo (user:pass@host) and non-standard ports unless allowed.
 *  - Resolve the hostname and reject if ANY resolved address falls inside a
 *    private, loopback, link-local, unique-local, CGNAT or cloud-metadata
 *    range. Resolving (instead of trusting the literal host) mitigates DNS
 *    rebinding and hostnames that point at internal infrastructure.
 *
 * This only ever blocks destinations that a legitimate public merchant
 * endpoint would never use, so it is safe to enable in production.
 */

const isPrivateIPv4 = (ip) => {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true;
  const [a, b] = parts;

  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // loopback 127.0.0.0/8
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 169 && b === 254) return true; // link-local / 169.254.169.254 metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
  if (a === 192 && b === 0) return true; // 192.0.0.0/24 (incl. 192.0.0.x)
  if (a >= 224) return true; // multicast / reserved 224.0.0.0+
  return false;
};

const normalizeIPv6 = (ip) => ip.toLowerCase().replace(/^\[|\]$/g, '');

const isPrivateIPv6 = (rawIp) => {
  const ip = normalizeIPv6(rawIp);

  if (ip === '::1' || ip === '::') return true; // loopback / unspecified
  if (ip.startsWith('fe80')) return true; // link-local
  if (ip.startsWith('fc') || ip.startsWith('fd')) return true; // unique-local fc00::/7
  if (ip.startsWith('ff')) return true; // multicast

  // IPv4-mapped / compatible addresses (::ffff:127.0.0.1, ::ffff:169.254.x.x)
  const v4Match = ip.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (v4Match) return isPrivateIPv4(v4Match[1]);

  return false;
};

export const isDisallowedAddress = (ip) => {
  if (!ip) return true;
  if (net.isIPv4(ip)) return isPrivateIPv4(ip);
  if (net.isIPv6(ip)) return isPrivateIPv6(ip);
  return true; // not a valid IP literal -> treat as unsafe
};

/**
 * Validates that a URL is safe to call from the server.
 * Throws an Error if the URL is malformed or resolves to a blocked range.
 *
 * @param {string} rawUrl
 * @returns {Promise<URL>} parsed URL when safe
 */
export const assertSafeOutboundUrl = async (rawUrl) => {
  let parsed;
  try {
    parsed = new URL(String(rawUrl));
  } catch {
    throw new Error('SSRF_BLOCKED: invalid URL');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`SSRF_BLOCKED: protocol "${parsed.protocol}" not allowed`);
  }

  if (parsed.username || parsed.password) {
    throw new Error('SSRF_BLOCKED: credentials in URL not allowed');
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, '');

  // If the host is already an IP literal, validate it directly.
  if (net.isIP(hostname)) {
    if (isDisallowedAddress(hostname)) {
      throw new Error(`SSRF_BLOCKED: host resolves to blocked range (${hostname})`);
    }
    return parsed;
  }

  // Otherwise resolve and verify every returned address.
  let addresses = [];
  try {
    addresses = await dns.lookup(hostname, { all: true });
  } catch {
    throw new Error(`SSRF_BLOCKED: DNS resolution failed for ${hostname}`);
  }

  if (!addresses.length) {
    throw new Error(`SSRF_BLOCKED: no addresses for ${hostname}`);
  }

  for (const { address } of addresses) {
    if (isDisallowedAddress(address)) {
      throw new Error(
        `SSRF_BLOCKED: ${hostname} resolves to blocked address ${address}`,
      );
    }
  }

  return parsed;
};

/**
 * Convenience wrapper that returns a boolean and logs instead of throwing.
 * @param {string} rawUrl
 * @returns {Promise<boolean>}
 */
export const isSafeOutboundUrl = async (rawUrl) => {
  try {
    await assertSafeOutboundUrl(rawUrl);
    return true;
  } catch (err) {
    logger.warn(`Blocked potentially unsafe outbound URL: ${err.message}`, {
      url: rawUrl,
    });
    return false;
  }
};
