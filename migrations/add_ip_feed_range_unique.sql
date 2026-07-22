-- Internal IP Intelligence Service (IPIS) — IpFeedRange uniqueness guard.
--
-- The original schema (create_ip_intelligence_tables.sql) has no unique key on
-- IpFeedRange, so every writer would pile up duplicate rows for the same range.
--
-- Adding a unique index on (cidr, feed_type) lets both writers UPSERT safely:
--   * the background feed importer (TOR / datacenter / VPN-ASN lists), and
--   * auto-promotion of bad IPs discovered during a cold provider lookup
--     (see src/services/ipIntelligence/index.js -> promoteToFeedAsync).
--
-- (cidr, feed_type) is the natural key: the same range can legitimately appear
-- under different feed_types (e.g. an allowlist override vs a denylist), but
-- only once per type. Safe to re-run; the table is empty until a writer exists.
CREATE UNIQUE INDEX IF NOT EXISTS uq_ip_feed_range_cidr_type
  ON "IpFeedRange" ("cidr", "feed_type");
