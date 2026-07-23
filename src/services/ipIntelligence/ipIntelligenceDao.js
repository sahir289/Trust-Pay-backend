// The database layer for the IP Intelligence Service — our long-term saved copy
// of IP lookups (the "system of record").
//
// Reads automatically go to the read replica and the write (UPSERT) goes to the
// primary, because executeQuery routes by whether the SQL starts with SELECT.
//
// Every function here is deliberately "fail-soft": if the database has a hiccup
// we log it and return null / do nothing, so a DB problem can never crash a
// login or a payment — the Redis cache and the provider can still answer.

import { executeQuery } from '../../utils/db.js';
import { logger } from '../../utils/logger.js';

// Converts one raw database row (snake_case columns) into the camelCase record
// shape the rest of the service works with.
const rowToIntel = (row) => ({
  ip: row.ip,
  ipKey: row.ip_key,
  asn: row.asn ?? null,
  isp: row.isp ?? null,
  org: row.org ?? null,
  country: row.country ?? null,
  region: row.region ?? null,
  city: row.city ?? null,
  isVpn: row.is_vpn === true,
  isProxy: row.is_proxy === true,
  isHosting: row.is_hosting === true,
  isTor: row.is_tor === true,
  riskScore: Number(row.risk_score ?? 0),
  confidence: Number(row.confidence ?? 0),
  providerName: row.provider ?? null,
  policyVersion: row.policy_version ?? null,
  metadata: row.metadata ?? {},
  lastCheckedAt: row.last_checked_at
    ? new Date(row.last_checked_at).toISOString()
    : null,
  expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
  source: 'db',
});

// Fetch the saved record for one IP key, or null if we've never stored it.
export const lookupByIpKey = async (ipKey) => {
  if (!ipKey) return null;
  try {
    const sql = 'SELECT * FROM "IPIntelligence" WHERE ip_key = $1 LIMIT 1';
    const { rows } = await executeQuery(sql, [ipKey]);
    return rows?.length ? rowToIntel(rows[0]) : null;
  } catch (err) {
    logger.warn('ip-intel db lookup failed', { ipKey, err: err.message });
    return null;
  }
};

// Checks our own offline lists of known IP ranges (TOR exit nodes, datacenters,
// VPN networks, block/allow lists). Returns the most specific range that
// CONTAINS the given IP, or null if none match. These lists are trusted and free to query.
export const lookupFeed = async (ip) => {
  if (!ip) return null;
  try {
    const sql = `
      SELECT feed_type, asn, source
      FROM "IpFeedRange"
      WHERE cidr >>= $1::inet
        AND (expires_at IS NULL OR expires_at > now())
      ORDER BY masklen(cidr) DESC
      LIMIT 1`;
    const { rows } = await executeQuery(sql, [ip]);
    return rows?.length ? rows[0] : null;
  } catch (err) {
    logger.warn('ip-feed lookup failed', { ip, err: err.message });
    return null;
  }
};

// Save (insert or update) a range into our own offline block/allow lists
// ("IpFeedRange"). This is how a bad IP we discover during a live (cold) lookup gets "remembered" as a range, so future requests from it are blocked for free straight from our DB — without ever paying the provider again, 
// and even after the per-IP cache in "IPIntelligence" has expired.
//
// Keyed by (cidr, feed_type) so calling it repeatedly for the same range just refreshes it instead of creating duplicates. To avoid ever weakening a manual, human-curated entry, a permanent row (expires_at IS NULL) stays permanent, and
// otherwise we keep the later of the two expiries. Fail-soft like everything else.
export const upsertFeedRange = async (entry) => {
  if (!entry?.cidr || !entry?.feedType) return;
  try {
    const sql = `
      INSERT INTO "IpFeedRange"
        (cidr, feed_type, source, asn, metadata, imported_at, expires_at)
      VALUES ($1::cidr, $2, $3, $4, $5::jsonb, now(), $6)
      ON CONFLICT (cidr, feed_type) DO UPDATE SET
        source = EXCLUDED.source,
        asn = COALESCE(EXCLUDED.asn, "IpFeedRange".asn),
        metadata = EXCLUDED.metadata,
        imported_at = now(),
        expires_at = CASE
          WHEN "IpFeedRange".expires_at IS NULL OR EXCLUDED.expires_at IS NULL
            THEN NULL
          ELSE GREATEST("IpFeedRange".expires_at, EXCLUDED.expires_at)
        END`;

    const params = [
      entry.cidr,
      entry.feedType,
      entry.source || 'auto',
      entry.asn ?? null,
      JSON.stringify(entry.metadata ?? {}),
      entry.expiresAt ?? null,
    ];

    await executeQuery(sql, params);
  } catch (err) {
    logger.warn('ip-feed upsert failed', { cidr: entry.cidr, err: err.message });
  }
};

// Save (insert or update) the record for an IP, keyed by ip_key. It's safe to
// call over and over. The WHERE guard at the very end makes sure a slower/older lookup that finishes late can't overwrite a newer record that's already saved.
export const upsertIntel = async (intel) => {
  if (!intel?.ipKey || !intel?.ip) return;
  try {
    const sql = `
      INSERT INTO "IPIntelligence"
        (ip, ip_key, asn, isp, org, country, region, city,
         is_vpn, is_proxy, is_hosting, is_tor, risk_score, confidence,
         provider, policy_version, metadata, last_checked_at, expires_at)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8,
         $9, $10, $11, $12, $13, $14,
         $15, $16, $17::jsonb, now(), $18)
      ON CONFLICT (ip_key) DO UPDATE SET
        asn = EXCLUDED.asn, isp = EXCLUDED.isp, org = EXCLUDED.org,
        country = EXCLUDED.country, region = EXCLUDED.region, city = EXCLUDED.city,
        is_vpn = EXCLUDED.is_vpn, is_proxy = EXCLUDED.is_proxy,
        is_hosting = EXCLUDED.is_hosting, is_tor = EXCLUDED.is_tor,
        risk_score = EXCLUDED.risk_score, confidence = EXCLUDED.confidence,
        provider = EXCLUDED.provider, policy_version = EXCLUDED.policy_version,
        metadata = EXCLUDED.metadata, last_checked_at = now(),
        expires_at = EXCLUDED.expires_at, updated_at = now()
      WHERE "IPIntelligence".last_checked_at <= EXCLUDED.last_checked_at`;

    const params = [
      intel.ip,
      intel.ipKey,
      intel.asn ?? null,
      intel.isp ?? null,
      intel.org ?? null,
      intel.country ?? null,
      intel.region ?? null,
      intel.city ?? null,
      intel.isVpn === true,
      intel.isProxy === true,
      intel.isHosting === true,
      intel.isTor === true,
      Math.max(0, Math.min(100, Math.round(intel.riskScore ?? 0))),
      Math.max(0, Math.min(1, Number(intel.confidence ?? 0))),
      intel.providerName ?? null,
      intel.policyVersion ?? null,
      JSON.stringify(intel.metadata ?? {}),
      intel.expiresAt,
    ];

    await executeQuery(sql, params);
  } catch (err) {
    logger.warn('ip-intel upsert failed', { ipKey: intel.ipKey, err: err.message });
  }
};
