// Helpers for tidying up IP addresses before we cache or look them up.
//
// Everything is stored under a normalized "IP key":
//   * IPv4 addresses are used exactly as they are.
//   * IPv6 addresses are shortened to their /64 prefix. A single user is
//     usually handed a whole /64 block, so grouping by /64 keeps the number of
//     cache entries reasonable and the hit-rate high.
//
// The IP passed in here is expected to already be the trusted client IP that
// Express worked out (req.ip behind a correctly-sized "trust proxy"), NOT a raw
// header a client could have faked.

export const normalizeIp = (ip) => {
  if (!ip) return null;
  let value = String(ip).trim();
  // Strip an IPv4-mapped IPv6 prefix (e.g. ::ffff:203.0.113.5 -> 203.0.113.5).
  if (value.toLowerCase().startsWith('::ffff:') && value.includes('.')) {
    value = value.slice(7);
  }
  return value || null;
};

// True for the machine's own address (localhost). We don't run intelligence on it.
export const isLoopback = (ip) =>
  ip === '::1' || ip === '127.0.0.1' || ip === 'localhost';

// Quick "does this look like IPv6?" check — IPv6 addresses always contain colons.
export const isIpv6 = (ip) => typeof ip === 'string' && ip.includes(':');

// Builds the key we cache/look up by. IPv4 is returned unchanged. For IPv6 we reduce the address to its /64 prefix — first expanding the shorthand "::" 
// form back into its 8 groups, then keeping just the first 4 groups.
export const toIpKey = (ip) => {
  const value = normalizeIp(ip);
  if (!value) return null;

  if (!isIpv6(value)) {
    return value; // IPv4 — use as-is
  }

  // Split on "::" to handle zero-compression, then expand to 8 hextets.
  const [head = '', tail = ''] = value.split('::');
  const headParts = head ? head.split(':').filter(Boolean) : [];
  const tailParts = tail ? tail.split(':').filter(Boolean) : [];
  const missing = 8 - (headParts.length + tailParts.length);
  const expanded = [
    ...headParts,
    ...Array(Math.max(0, missing)).fill('0'),
    ...tailParts,
  ].slice(0, 8);

  // /64 prefix = first 4 hextets, normalized to lowercase without leading zeros.
  const prefix = expanded
    .slice(0, 4)
    .map((h) => (h ? parseInt(h, 16).toString(16) : '0'))
    .join(':');
  return `${prefix}::/64`;
};
