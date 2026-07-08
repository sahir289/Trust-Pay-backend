// Unit tests for IP normalization + keying (pure logic).
/* global describe, it, expect*/
import { normalizeIp, isLoopback, isIpv6, toIpKey } from '../ipUtils.js';

describe('ipUtils', () => {
  it('normalizeIp trims and strips IPv4-mapped IPv6', () => {
    expect(normalizeIp('  203.0.113.5 ')).toBe('203.0.113.5');
    expect(normalizeIp('::ffff:203.0.113.5')).toBe('203.0.113.5');
    expect(normalizeIp('::FFFF:203.0.113.5')).toBe('203.0.113.5');
    expect(normalizeIp('')).toBeNull();
    expect(normalizeIp(null)).toBeNull();
  });

  it('isLoopback recognizes loopback forms', () => {
    expect(isLoopback('::1')).toBe(true);
    expect(isLoopback('127.0.0.1')).toBe(true);
    expect(isLoopback('localhost')).toBe(true);
    expect(isLoopback('203.0.113.5')).toBe(false);
  });

  it('isIpv6 detects colon-form addresses', () => {
    expect(isIpv6('2001:db8::1')).toBe(true);
    expect(isIpv6('203.0.113.5')).toBe(false);
  });

  it('toIpKey keeps IPv4 as-is', () => {
    expect(toIpKey('203.0.113.5')).toBe('203.0.113.5');
    expect(toIpKey('::ffff:203.0.113.5')).toBe('203.0.113.5');
  });

  it('toIpKey collapses IPv6 to a stable /64 key', () => {
    const full = toIpKey('2001:0db8:85a3:0000:0000:8a2e:0370:7334');
    const compressed = toIpKey('2001:db8:85a3::8a2e:370:7334');
    // Same /64 network -> same cache key regardless of input form.
    expect(full).toBe(compressed);
    expect(full).toMatch(/::\/64$/);
  });

  it('toIpKey handles fully-compressed IPv6', () => {
    expect(toIpKey('2001:db8::1')).toBe('2001:db8:0:0::/64');
  });

  it('toIpKey returns null for empty input', () => {
    expect(toIpKey('')).toBeNull();
    expect(toIpKey(null)).toBeNull();
  });
});
