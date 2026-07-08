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
