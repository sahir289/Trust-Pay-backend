// Unit tests for IP normalization + keying (pure logic).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeIp, isLoopback, isIpv6, toIpKey } from '../ipUtils.js';

test('normalizeIp trims and strips IPv4-mapped IPv6', () => {
  assert.equal(normalizeIp('  203.0.113.5 '), '203.0.113.5');
  assert.equal(normalizeIp('::ffff:203.0.113.5'), '203.0.113.5');
  assert.equal(normalizeIp('::FFFF:203.0.113.5'), '203.0.113.5');
  assert.equal(normalizeIp(''), null);
  assert.equal(normalizeIp(null), null);
});

test('isLoopback recognizes loopback forms', () => {
  assert.equal(isLoopback('::1'), true);
  assert.equal(isLoopback('127.0.0.1'), true);
  assert.equal(isLoopback('localhost'), true);
  assert.equal(isLoopback('203.0.113.5'), false);
});

test('isIpv6 detects colon-form addresses', () => {
  assert.equal(isIpv6('2001:db8::1'), true);
  assert.equal(isIpv6('203.0.113.5'), false);
});

test('toIpKey keeps IPv4 as-is', () => {
  assert.equal(toIpKey('203.0.113.5'), '203.0.113.5');
  assert.equal(toIpKey('::ffff:203.0.113.5'), '203.0.113.5');
});

test('toIpKey collapses IPv6 to a stable /64 key', () => {
  const full = toIpKey('2001:0db8:85a3:0000:0000:8a2e:0370:7334');
  const compressed = toIpKey('2001:db8:85a3::8a2e:370:7334');
  // Same /64 network -> same cache key regardless of input form.
  assert.equal(full, compressed);
  assert.match(full, /::\/64$/);
});

test('toIpKey handles fully-compressed IPv6', () => {
  assert.equal(toIpKey('2001:db8::1'), '2001:db8:0:0::/64');
});

test('toIpKey returns null for empty input', () => {
  assert.equal(toIpKey(''), null);
  assert.equal(toIpKey(null), null);
});
