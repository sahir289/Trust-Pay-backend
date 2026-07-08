// Unit tests for the proxycheck.io provider adapter's normalize() (pure mapping).
/* global describe, it, expect, */
import { normalize, name } from '../providers/proxyCheckProvider.js';

describe('proxyCheckProvider', () => {
  it('adapter exposes a stable provider name', () => {
    expect(name).toBe('proxycheck');
  });

  it('maps vpn=yes to a high-confidence VPN verdict', () => {
    const r = normalize({ vpn: 'yes', isocode: 'US' });
    expect(r.isVpn).toBe(true);
    expect(r.confidence).toBe(0.9);
    expect(r.country).toBe('US');
  });

  it('maps proxy=yes', () => {
    const r = normalize({ proxy: 'yes' });
    expect(r.isProxy).toBe(true);
  });

  it('detects TOR and hosting via type and boolean fields', () => {
    expect(normalize({ type: 'TOR' }).isTor).toBe(true);
    expect(normalize({ tor: 'yes' }).isTor).toBe(true);
    expect(normalize({ type: 'Hosting' }).isHosting).toBe(true);
    expect(normalize({ type: 'Data Center' }).isHosting).toBe(true);
    expect(normalize({ hosting: 'yes' }).isHosting).toBe(true);
  });

  it('parses ASN from AS-prefixed strings', () => {
    expect(normalize({ asn: 'AS12345' }).asn).toBe(12345);
    expect(normalize({ asn: 12345 }).asn).toBe(12345);
    expect(normalize({}).asn).toBeNull();
  });

  it('clamps risk into 0..100 and defaults invalid to 0', () => {
    expect(normalize({ risk: '85' }).riskScore).toBe(85);
    expect(normalize({ risk: 150 }).riskScore).toBe(100);
    expect(normalize({ risk: 'n/a' }).riskScore).toBe(0);
  });

  it('prefers ISO code over full country name', () => {
    expect(normalize({ isocode: 'IN', country: 'India' }).country).toBe('IN');
    expect(normalize({ country: 'India' }).country).toBe('India');
  });

  it('clean IP gets a moderate confidence and no flags', () => {
    const r = normalize({ isocode: 'IN' });
    expect(r.isVpn).toBe(false);
    expect(r.isProxy).toBe(false);
    expect(r.confidence).toBe(0.7);
    expect(r.metadata).toEqual({ raw: { isocode: 'IN' } });
  });
});
