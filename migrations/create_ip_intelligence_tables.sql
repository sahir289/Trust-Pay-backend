-- Internal IP Intelligence Service (IPIS) — Phase 1 schema.
--
-- These tables back the cache-first Internal IP Intelligence Service that
-- replaces the inline third-party VPN check on the login + payment hot paths.
-- See docs/architecture/ip-intelligence-service-design.md (sections 3-5).
--
-- Phase 1 ships two tables:
--   * IPIntelligence  — system-of-record for per-IP verdicts (warm tier behind Redis)
--   * IpFeedRange    — authoritative local CIDR feeds (TOR / datacenter / VPN ASN)
-- The decision-audit table is introduced later (Phase 3) once enforcement is on.
--
-- CamelCase table names + native inet/cidr types are intentional: the cidr
-- GiST index enables fast "is this IP inside any known bad range" containment
-- lookups, which a varchar/JSONB layout cannot do efficiently.

-- One row per normalized IP key (IPv4 address, or an IPv6 /64 prefix).
CREATE TABLE IF NOT EXISTS "IPIntelligence" (
  "id"              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "ip"              inet         NOT NULL,                 -- native inet type
  "ip_key"          varchar(64)  NOT NULL,                 -- normalized key (v4 addr or v6 /64)
  "asn"             integer,
  "isp"             varchar(256),
  "org"             varchar(256),
  "country"         char(2),                               -- ISO-3166 alpha-2
  "region"          varchar(128),
  "city"            varchar(128),
  "is_vpn"          boolean      NOT NULL DEFAULT false,
  "is_proxy"        boolean      NOT NULL DEFAULT false,
  "is_hosting"      boolean      NOT NULL DEFAULT false,   -- datacenter / cloud range
  "is_tor"          boolean      NOT NULL DEFAULT false,
  "risk_score"      smallint     NOT NULL DEFAULT 0,       -- 0..100
  "confidence"      numeric(4,3) NOT NULL DEFAULT 0,       -- 0.000..1.000
  "provider"        varchar(64),                           -- vendor that produced this verdict
  "policy_version"  varchar(16),
  "metadata"        jsonb        NOT NULL DEFAULT '{}'::jsonb, -- raw normalized provider payload
  "last_checked_at" TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "expires_at"      TIMESTAMPTZ  NOT NULL,
  "created_at"      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "updated_at"      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT uq_ip_intelligence_key UNIQUE ("ip_key")
);

-- Point lookups + UPSERT conflict target (the hot read path).
-- (uq_ip_intelligence_key already provides the unique btree on ip_key.)
-- Worker scans for stale/expired rows to refresh.
CREATE INDEX IF NOT EXISTS idx_ip_intel_expires ON "IPIntelligence" ("expires_at");
-- High-risk analytics without bloating the index on the long tail of clean IPs.
CREATE INDEX IF NOT EXISTS idx_ip_intel_risk ON "IPIntelligence" ("risk_score")
  WHERE "risk_score" >= 70;

COMMENT ON TABLE "IPIntelligence" IS 'Per-IP intelligence/verdict system-of-record for the Internal IP Intelligence Service (warm tier behind Redis)';
COMMENT ON COLUMN "IPIntelligence"."ip_key" IS 'Normalized cache/lookup key: IPv4 address as-is, or IPv6 collapsed to a /64 prefix';
COMMENT ON COLUMN "IPIntelligence"."risk_score" IS 'Composite risk 0..100 used by the decision engine block threshold';
COMMENT ON COLUMN "IPIntelligence"."confidence" IS 'Verdict confidence 0.000..1.000; drives shorter TTLs for low-confidence records';
COMMENT ON COLUMN "IPIntelligence"."expires_at" IS 'When the record is considered stale and eligible for background refresh';
COMMENT ON COLUMN "IPIntelligence"."metadata" IS 'Raw normalized provider payload kept for debugging / re-normalization';

-- Authoritative local feeds: TOR exit nodes, datacenter/cloud ranges, known VPN
-- ASNs, and manual allow/deny lists. Always available even when every external
-- provider is down, so the service is never fully blind.
CREATE TABLE IF NOT EXISTS "IpFeedRange" (
  "id"          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "cidr"        cidr         NOT NULL,
  "feed_type"   varchar(32)  NOT NULL,    -- 'tor' | 'datacenter' | 'vpn_asn' | 'allowlist' | 'denylist'
  "source"      varchar(64)  NOT NULL,    -- feed name / url
  "asn"         integer,
  "metadata"    jsonb        NOT NULL DEFAULT '{}'::jsonb,
  "imported_at" TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "expires_at"  TIMESTAMPTZ              -- NULL = no expiry (permanent until re-imported)
);

-- CIDR containment lookups: "does any feed range contain this IP?" via cidr >>= $ip.
-- The inet_ops GiST opclass is built into core PostgreSQL.
CREATE INDEX IF NOT EXISTS idx_ip_feed_cidr ON "IpFeedRange" USING gist ("cidr" inet_ops);
CREATE INDEX IF NOT EXISTS idx_ip_feed_type ON "IpFeedRange" ("feed_type");

COMMENT ON TABLE "IpFeedRange" IS 'Authoritative local CIDR feeds (TOR/datacenter/VPN-ASN/allow/deny) imported by background workers';
COMMENT ON COLUMN "IpFeedRange"."feed_type" IS 'tor | datacenter | vpn_asn | allowlist | denylist';
COMMENT ON COLUMN "IpFeedRange"."expires_at" IS 'Optional expiry; NULL means the range is permanent until the next feed import replaces it';
