import { getIntelligence } from '../services/ipIntelligence/index.js';

// Small adapter used by the login guard and the payment-page guard. It asks the IP Intelligence Service about an IP, then reshapes the answer into the little { isVpn, country, region, provider, raw } object those guards already expect.

// Why go through the service instead of calling the provider here? So the paid provider (proxycheck.io) is only hit on a real cache miss instead of on every request. The returned shape is kept exactly like the old inline version, so none of the callers had to change.
export const checkProxyAndVpn = async (ip) => {
  if (!ip || ip === '::1' || ip === '127.0.0.1') return null;

  const intel = await getIntelligence(ip);
  // `raw` is the untouched payload the provider returned. If it's missing (e.g. a loopback IP or an IP we couldn't resolve) we have nothing useful to say.
  const info = intel?.metadata?.raw;
  if (!info) return null;

  return {
    isVpn: intel.isVpn === true || intel.isProxy === true,
    country: intel.country || info.country || info.country_name || null,
    region: intel.region || info.region || info.region_name || info.city || null,
    provider: info.provider || info.organisation || intel.isp || null,
    raw: info,
  };
};
