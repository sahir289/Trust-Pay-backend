// Adapter for one specific vendor: proxycheck.io.
//
// Its whole job is to translate between "proxycheck.io's world" and "our world",
// so the rest of the service never has to deal with vendor-specific field names.
// Any other vendor we add later implements this exact same set of functions:
//   name             a label used in logs and the circuit breaker.
//   isConfigured()   do we have the URL/key needed to use this vendor?
//   lookup(ip, ms)   call the vendor and return its raw response (or null).
//   normalize(raw)   reshape that raw response into our standard record.

import axios from 'axios';
import config from '../../../config/config.js';

export const name = 'proxycheck';

export const isConfigured = () => Boolean(config.proxyCheck?.proxyCheckUrl);

// proxycheck.io reports booleans as the string "yes" — treat that (and any real
// truthy value) as true.
const yes = (value) => value === 'yes' || value === true || value === 1;

// Pull the numeric part out of an ASN string, e.g. "AS15169" -> 15169.
const parseAsn = (value) => {
  if (value == null) return null;
  const digits = String(value).replace(/[^0-9]/g, '');
  return digits ? Number.parseInt(digits, 10) : null;
};

// Keep a risk score inside the sane 0–100 range; anything unparseable becomes 0.
const clampRisk = (value) => {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
};

// Call proxycheck.io for one IP and hand back its raw JSON (or null if the
// response is empty or an unexpected shape). Honors the timeout so we don't hang.
export const lookup = async (ip, timeoutMs) => {
  const base = config.proxyCheck?.proxyCheckUrl;
  if (!base) return null;

  // The configured URL template encodes the placeholder ${userIp} as
  // $%7BuserIp%7D (matching the existing proxyCheckService.js behavior).
  const url = base.replace('$%7BuserIp%7D', encodeURIComponent(ip));
  const { data } = await axios.get(url, { timeout: timeoutMs });

  const info = data?.[ip] || data;
  if (!info || typeof info !== 'object') return null;
  return info;
};

// Turn proxycheck.io's raw JSON into our standard record shape (VPN/proxy flags,
// country, ASN, risk, ...). We stash the original payload under metadata.raw in
// case a caller needs a field we didn't map here.
export const normalize = (info) => {
  const isVpn = yes(info.vpn);
  const isProxy = yes(info.proxy);
  const type = typeof info.type === 'string' ? info.type : '';

  return {
    asn: parseAsn(info.asn),
    isp: info.isp || info.provider || info.organisation || null,
    org: info.organisation || info.provider || null,
    country: info.isocode || info.country_code || info.country || null,
    region: info.region || info.city || null,
    city: info.city || null,
    isVpn,
    isProxy,
    isHosting: yes(info.hosting) || /hosting|data\s?cent/i.test(type),
    isTor: yes(info.tor) || /tor/i.test(type),
    riskScore: clampRisk(info.risk),
    confidence: isVpn || isProxy ? 0.9 : 0.7,
    metadata: { raw: info },
  };
};
