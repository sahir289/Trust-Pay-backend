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

// Reshape proxycheck.io's raw JSON into our standard record shape (VPN/proxy flags, country, ASN, risk, ...). Supports BOTH response formats: the v3 shape (preferred — accurate per-category detections) and the legacy v2 flat shape,
const normalizeV3 = (info) => {
  const detections = info.detections || {};
  const net = info.network || {};
  const loc = info.location || {};
  const type = typeof net.type === 'string' ? net.type : '';

  const isVpn = detections.vpn === true;
  const isProxy = detections.proxy === true;
  const isTor = detections.tor === true || /tor/i.test(type);
  const isHosting = detections.hosting === true || /hosting|data\s?cent/i.test(type);

  const raw = {
    asn: net.asn ?? null,
    range: net.range ?? null,
    hostname: net.hostname ?? null,
    provider: net.provider ?? null,
    organisation: net.organisation ?? null,
    type,
    continent: loc.continent_name ?? null,
    continentcode: loc.continent_code ?? null,
    country: loc.country_name ?? null,
    isocode: loc.country_code ?? null,
    region: loc.region_name ?? null,
    regioncode: loc.region_code ?? null,
    city: loc.city_name ?? null,
    postcode: loc.postal_code ?? null,
    latitude: loc.latitude ?? null,
    longitude: loc.longitude ?? null,
    timezone: loc.timezone ?? null,
    currency: loc.currency ?? null,
    devices: info.device_estimate ?? null,
    vpn: isVpn ? 'yes' : 'no',
    proxy: isProxy ? 'yes' : 'no',
    detections, // keep v3 response for auditing/debugging
  };

  return {
    asn: parseAsn(net.asn),
    isp: net.provider || net.organisation || null,
    org: net.organisation || net.provider || null,
    country: loc.country_code || loc.country_name || null,
    region: loc.region_name || loc.city_name || null,
    city: loc.city_name || null,
    isVpn,
    isProxy,
    isHosting,
    isTor,
    riskScore: clampRisk(detections.risk),
    confidence: isVpn || isProxy ? 0.9 : 0.7,
    metadata: { raw },
  };
};

// Turn proxycheck.io's raw JSON into our standard record shape (VPN/proxy flags,
// country, ASN, risk, ...). Supports BOTH response formats: the v3 shape
// (preferred — accurate per-category detections) and the legacy v2 flat shape,
// so flipping PROXY_CHECK_URL between /v2/ and /v3/ needs no code change.
// We stash the original payload under metadata.raw in case a caller needs a
// field we didn't map here.
export const normalize = (info) => {
  if (info?.detections && typeof info.detections === 'object') {
    return normalizeV3(info);
  }

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
