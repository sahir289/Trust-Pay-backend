// Unit tests for the proxycheck.io provider adapter's normalize() (pure mapping).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize, name } from '../providers/proxyCheckProvider.js';

test('adapter exposes a stable provider name', () => {
  assert.equal(name, 'proxycheck');
});

test('maps vpn=yes to a high-confidence VPN verdict', () => {
  const r = normalize({ vpn: 'yes', isocode: 'US' });
  assert.equal(r.isVpn, true);
  assert.equal(r.confidence, 0.9);
  assert.equal(r.country, 'US');
});

test('maps proxy=yes', () => {
  const r = normalize({ proxy: 'yes' });
  assert.equal(r.isProxy, true);
});

test('detects TOR and hosting via type and boolean fields', () => {
  assert.equal(normalize({ type: 'TOR' }).isTor, true);
  assert.equal(normalize({ tor: 'yes' }).isTor, true);
  assert.equal(normalize({ type: 'Hosting' }).isHosting, true);
  assert.equal(normalize({ type: 'Data Center' }).isHosting, true);
  assert.equal(normalize({ hosting: 'yes' }).isHosting, true);
});

test('parses ASN from AS-prefixed strings', () => {
  assert.equal(normalize({ asn: 'AS12345' }).asn, 12345);
  assert.equal(normalize({ asn: 12345 }).asn, 12345);
  assert.equal(normalize({}).asn, null);
});

test('clamps risk into 0..100 and defaults invalid to 0', () => {
  assert.equal(normalize({ risk: '85' }).riskScore, 85);
  assert.equal(normalize({ risk: 150 }).riskScore, 100);
  assert.equal(normalize({ risk: 'n/a' }).riskScore, 0);
});

test('prefers ISO code over full country name', () => {
  assert.equal(normalize({ isocode: 'IN', country: 'India' }).country, 'IN');
  assert.equal(normalize({ country: 'India' }).country, 'India');
});

test('clean IP gets a moderate confidence and no flags', () => {
  const r = normalize({ isocode: 'IN' });
  assert.equal(r.isVpn, false);
  assert.equal(r.isProxy, false);
  assert.equal(r.confidence, 0.7);
  assert.deepEqual(r.metadata, { raw: { isocode: 'IN' } });
});

// ---- v3 response shape ({ network, location, detections }) ----

const v3HostingIp = {
  network: {
    asn: 'AS16509',
    range: '18.175.186.0/22',
    hostname: 'ec2-18-175-186-92.eu-west-2.compute.amazonaws.com',
    provider: 'Amazon.com, Inc.',
    organisation: 'Amazon Data Services UK',
    type: 'Hosting',
  },
  location: {
    continent_name: 'Europe',
    continent_code: 'EU',
    country_name: 'United Kingdom',
    country_code: 'GB',
    region_name: 'England',
    region_code: 'ENG',
    city_name: 'London',
    postal_code: 'EC4N 4TR',
    latitude: 51.5134,
    longitude: -0.0891,
    timezone: 'Europe/London',
    currency: { name: 'Pound', code: 'GBP', symbol: '£' },
  },
  device_estimate: { address: 0, subnet: 9 },
  detections: {
    proxy: false,
    vpn: false,
    tor: false,
    hosting: true,
    risk: 33,
  },
};

test('v3: hosting-only IP is NOT flagged as VPN (fixes the v2 conflation)', () => {
  const r = normalize(v3HostingIp);
  assert.equal(r.isVpn, false);
  assert.equal(r.isProxy, false);
  assert.equal(r.isHosting, true);
  assert.equal(r.country, 'GB');
  assert.equal(r.region, 'England');
  assert.equal(r.asn, 16509);
  assert.equal(r.riskScore, 33);
  assert.equal(r.confidence, 0.7);
});

test('v3: legacy-shaped raw is rebuilt for downstream guards', () => {
  const raw = normalize(v3HostingIp).metadata.raw;
  assert.equal(raw.vpn, 'no');
  assert.equal(raw.proxy, 'no');
  assert.equal(raw.country, 'United Kingdom');
  assert.equal(raw.region, 'England');
  assert.equal(raw.continentcode, 'EU');
  assert.equal(raw.latitude, 51.5134);
  assert.equal(raw.longitude, -0.0891);
  assert.equal(raw.timezone, 'Europe/London');
  assert.equal(raw.postcode, 'EC4N 4TR');
  assert.deepEqual(raw.detections, v3HostingIp.detections);
});

test('v3: real VPN detection maps to a high-confidence VPN verdict', () => {
  const r = normalize({
    ...v3HostingIp,
    detections: { ...v3HostingIp.detections, vpn: true },
  });
  assert.equal(r.isVpn, true);
  assert.equal(r.confidence, 0.9);
  assert.equal(r.metadata.raw.vpn, 'yes');
});

test('v3: tor detection maps to isTor', () => {
  const r = normalize({
    ...v3HostingIp,
    detections: { ...v3HostingIp.detections, tor: true },
  });
  assert.equal(r.isTor, true);
});
