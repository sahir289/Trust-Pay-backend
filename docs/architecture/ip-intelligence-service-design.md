# Internal IP Intelligence Service — Enterprise Architecture Design

**Status:** Proposed
**Audience:** Senior Architects, Engineering Leadership, SRE, Security
**Owner:** Platform / Fraud Engineering
**Last updated:** 2026-06-30
**Document type:** Technical Design Document (TDD)

---

## 0. Executive Summary

We currently enforce a strict business rule: **VPN/proxy users must not be able to log in or open a payment page.** Today this is enforced by calling a third-party provider (**proxycheck.io**) *synchronously and inline* inside two middlewares:

- `geoLocationGuard` ([src/middlewares/loginLocationRestrict.js](../../src/middlewares/loginLocationRestrict.js)) — login flow, **fails soft**.
- `getUserLocationMiddleware` ([src/middlewares/locationRestrict.js](../../src/middlewares/locationRestrict.js)) — payment page flow, **fails closed (HTTP 500)**.

Both ultimately call [src/utils/proxyCheckService.js](../../src/utils/proxyCheckService.js) (`checkProxyAndVpn`).

This couples every login and every payment-page render to an external HTTP call on the hot path. At ~20K req/sec this is the system's most fragile dependency: it adds 50–800ms tail latency, has no shared cache, duplicates lookups for the same IP, and creates a hard external SPOF.

**This document proposes replacing the inline provider call with an Internal IP Intelligence Service (IPIS)**: a dedicated, cache-first, multi-provider service with a Redis hot tier, a PostgreSQL system-of-record, asynchronous background refresh workers, a provider abstraction with circuit breakers, and a deterministic decision engine. The middlewares become thin and call **only** the internal service — never a vendor directly.

**Key outcomes:**

| Dimension | Today | Target |
|---|---|---|
| Hot-path dependency | External HTTP (proxycheck.io) | Redis GET (sub-ms) |
| p99 added latency | 50–800ms | < 3ms (cache hit) |
| Cache | None (per-request lookups) | Redis hot tier + Postgres warm tier |
| Provider coupling | 1 vendor, hard-coded URL | N vendors behind an abstraction, fallback + circuit breaker |
| Failure mode | Inconsistent (soft vs. closed) | Explicit, policy-driven per flow |
| Scale ceiling | Bounded by vendor QPS/cost | 100K–250K req/sec on internal cache |
| Cost | 1 paid lookup per request | 1 paid lookup per *unique IP per TTL* |

---

## 1. Current-State Analysis (grounded in this codebase)

### 1.1 What exists today

```
Client → ALB/Cloudflare → Express (PM2 cluster)
                              │
        ┌─────────────────────┴───────────────────────┐
        │                                              │
  Login: geoLocationGuard                     Payment: getUserLocationMiddleware
  loginLocationRestrict.js                    locationRestrict.js
        │                                              │
   checkProxyAndVpn(ip)  ◄── both ──►  axios.get(PROXY_CHECK_URL)
   proxyCheckService.js                          (inline)
        │                                              │
        └──────────────► proxycheck.io ◄───────────────┘  (external, on hot path)
```

Relevant facts already true in the repo (reused by this design):

- **IP trust:** `app.set('trust proxy', 1)` in [src/app.js](../../src/app.js). `req.ip` is the address as seen by the single trusted proxy and cannot be spoofed by a client `X-Forwarded-For` (see notes in [src/middlewares/checkApiKey.js](../../src/middlewares/checkApiKey.js)). **This is the correct primitive and we build on it.**
- **Redis** is already standardized: `ioredis` client ([src/utils/redisClient.js](../../src/utils/redisClient.js)) with cache helpers `getCachedData` / `setCachedData` / `setCachedDataIfNotExists (NX)` / `deleteCachedData` ([src/utils/redishashkey.js](../../src/utils/redishashkey.js)).
- **RabbitMQ** is already the async backbone (amqplib, producer/consumer/topology under [src/rabbitmq/](../../src/rabbitmq/)), with dedicated workers (`rabbitmq-worker.js`, `cron-worker.js`).
- **PostgreSQL** with reader/writer split and RDS Proxy / PgBouncer support ([src/utils/db.js](../../src/utils/db.js)), JSONB-heavy schema, `uuid_generate_v4()`, `TIMESTAMPTZ`, SQL migrations under [migrations/](../../migrations/).
- **Rate limiting** already uses `rate-limiter-flexible` with a Redis store and in-memory fallback ([src/middlewares/rateLimiter.js](../../src/middlewares/rateLimiter.js)).

### 1.2 Concrete problems in the current implementation

| # | Problem | Evidence | Impact |
|---|---|---|---|
| 1 | Provider called on the hot path of every request | `checkProxyAndVpn` invoked per-request in both middlewares | Latency + external SPOF |
| 2 | No caching of IP verdicts | `proxyCheckService.js` has no cache read/write | Duplicate paid lookups for the same IP |
| 3 | Inconsistent failure policy | Login `withTimeout(...) → null → continue` (fail-open); payment `catch → 500` (fail-closed) | A VPN user can slip through login when the vendor is slow |
| 4 | Vendor lock-in | URL hard-coded via `PROXY_CHECK_URL`, response shape parsed inline (`vpn === 'yes'`) | Hard to switch/add providers |
| 5 | `getClientIp` trusts raw `X-Forwarded-For[0]` | [loginLocationRestrict.js](../../src/middlewares/loginLocationRestrict.js) reads `req.headers['x-forwarded-for'].split(',')[0]` | Spoofable if not behind a normalizing proxy; inconsistent with `trust proxy` |
| 6 | No central IP intelligence | Two middlewares, two code paths, two response shapes | No reuse for Admin/Fraud/future services |
| 7 | 8s provider timeout in service vs 3s in caller | `PROXY_CHECK_TIMEOUT = 8000` but caller wraps in 3s | Wasted vendor work, confusing tail behavior |

> **Note on #5:** `getClientIp` picking `x-forwarded-for.split(',')[0]` is the **client-controlled left-most hop** and is spoofable. The codebase already established the safer pattern (`req.ip` with `trust proxy`). The new middleware standardizes on that (see §6).

---

## 2. Target Architecture Overview

```
                         ┌──────────────────────────────────────────────────────┐
                         │                  Edge / L7                            │
   Client ──────────────►│  Cloudflare ──► AWS ALB ──► (trust proxy = N hops)    │
                         └───────────────────────────────┬──────────────────────┘
                                                         │ req.ip (trusted)
              ┌──────────────────────────────────────────┼───────────────────────────────┐
              │                         API tier (PM2 / K8s, stateless)                    │
              │                                                                            │
              │   Login route ─► ipGuard()      Payment route ─► ipGuard()   Admin/Fraud   │
              │        │                              │                          │         │
              │        └──────────────┬───────────────┴────────────┬────────────┘         │
              │                       ▼                            ▼                        │
              │              IPIS Client SDK (in-process)   IPIS Client SDK                 │
              │                       │  decide(ip, ctx)     (L1 in-proc LRU, 1–5s)         │
              └───────────────────────┼──────────────────────────────────────────┬─────────┘
                                      ▼                                           │
                  ┌───────────────────────────────────────────┐                  │ async
                  │     Internal IP Intelligence Service       │                  │ events
                  │  (library mode now → microservice later)   │                  │ (RabbitMQ)
                  │                                            │                  ▼
                  │  ┌──────────┐   miss   ┌───────────────┐    │        ┌──────────────────┐
                  │  │ L2 Redis │◄────────►│ Decision Eng. │    │        │  Background       │
                  │  │ hot tier │          └──────┬────────┘    │        │  Workers          │
                  │  └────┬─────┘   miss          │             │        │  (refresh, import │
                  │       │                       ▼             │        │   retry, prune,   │
                  │       │            ┌────────────────────┐   │        │   health-probe)   │
                  │       └───────────►│ L3 Postgres (SoR)  │◄──┼────────┤                  │
                  │                    └─────────┬──────────┘   │        └────────┬─────────┘
                  │                              │ miss/stale   │                 │
                  │                    ┌─────────▼──────────┐   │                 │
                  │                    │ Provider Gateway   │   │                 │
                  │                    │ (abstraction +     │   │                 │
                  │                    │  circuit breaker + │   │                 │
                  │                    │  fallback + RL)    │   │                 │
                  │                    └─────────┬──────────┘   │                 │
                  └──────────────────────────────┼─────────────┘                 │
                                                 ▼                                ▼
                            proxycheck.io   ipqualityscore   MaxMind/IPinfo   bulk DB feeds
                            (primary)       (fallback)       (local DB)       (TOR, ASN, DC)
```

**Design tenets**

1. **Hot path never blocks on a vendor.** A request reads the verdict from cache (L1 → L2 → L3). Vendor calls happen on *cold miss* with strict budget, or **out-of-band** in workers.
2. **One service, many consumers.** Login, payment, admin, and the fraud engine share one decision contract.
3. **Deterministic decisions.** Same inputs → same verdict, versioned policy, fully auditable.
4. **Explicit, per-flow failure policy.** Payment fails *closed*; login fails *closed for high-risk signals, soft for unknown* (see §7).
5. **Incremental delivery.** Ship as an in-process module first (zero new infra), extract to a microservice only when scale demands it.

---

## 3. Internal IP Intelligence Service (IPIS)

### 3.1 Responsibilities

A single component that, given an IP (and optional context), returns a **normalized intelligence record** and a **decision**:

- VPN detection, proxy detection, hosting/datacenter detection, TOR exit-node detection
- ASN + ISP/organization lookup
- Country / region / city + geo
- Composite **risk score** (0–100) and **confidence** (0–1)
- **Decision** (`ALLOW` / `BLOCK` / `CHALLENGE`) under a versioned policy

### 3.2 Deployment model — start as a library, evolve to a service

| Phase | Form | Why |
|---|---|---|
| Now | **In-process module** `src/services/ipIntelligence/` imported by middlewares | Zero new infra, reuses existing Redis/PG/MQ, fastest path to value, no extra network hop |
| Later (>80–100K rps or multi-language consumers) | **Standalone microservice** (Fastify) behind internal LB, same contract over HTTP/gRPC | Independent scaling, isolation, language-agnostic reuse |

The **client SDK contract is identical** in both forms, so consumers don't change when we extract the service. This is the key decoupling decision.

### 3.3 Public contract (stable API)

```ts
// Logical contract — identical whether in-process or remote.
interface IpDecisionRequest {
  ip: string;                 // already-trusted client IP (from req.ip)
  context: {
    flow: 'login' | 'payment' | 'admin' | 'fraud';
    merchantId?: string;      // payment flow: per-merchant allow/deny overrides
    userRole?: string;        // e.g. VENDOR (existing geoGuard concept)
    requestId: string;        // trace correlation
  };
  budgetMs?: number;          // hard cap for any synchronous provider escalation
}

interface IpIntelligence {
  ip: string;
  asn: number | null;
  isp: string | null;
  org: string | null;
  country: string | null;     // ISO-3166 alpha-2
  region: string | null;
  city: string | null;
  isVpn: boolean;
  isProxy: boolean;
  isHosting: boolean;         // datacenter / cloud range
  isTor: boolean;
  riskScore: number;          // 0..100
  confidence: number;         // 0..1
  source: 'cache' | 'db' | 'provider' | 'local-db' | 'default';
  providerName: string | null;
  lastCheckedAt: string;      // ISO8601
  expiresAt: string;          // ISO8601
}

interface IpDecision {
  decision: 'ALLOW' | 'BLOCK' | 'CHALLENGE';
  reason: string;             // machine-readable, e.g. 'VPN_DETECTED'
  policyVersion: string;      // e.g. 'v3'
  intelligence: IpIntelligence;
  degraded: boolean;          // true if served under a failover/default path
}
```

### 3.4 Decision Engine

The decision engine is **pure** (no I/O): it maps an `IpIntelligence` record + flow policy → `IpDecision`. Pure functions are unit-testable, deterministic, and versionable.

```
decide(intel, flow, policy):
  if flow == payment OR flow == login:
     if intel.isTor                      -> BLOCK  (TOR_DETECTED)
     if intel.isVpn OR intel.isProxy     -> BLOCK  (VPN_OR_PROXY)
     if intel.isHosting AND riskScore≥H  -> BLOCK  (DATACENTER_HIGH_RISK)
     if country in blockedCountries      -> BLOCK  (COUNTRY_RESTRICTED)
     if riskScore ≥ policy.blockThreshold-> BLOCK  (RISK_THRESHOLD)
     else                                -> ALLOW
```

- Thresholds (`blockThreshold`, `H`) and country lists come from **versioned policy** loaded from `system_settings` (the repo already has a settings table pattern + migrations) so changes require no deploy.
- The existing per-flow rules (blocked countries, role/region rules in [geoGuard config](../../src/config/geoGuard.js), merchant `unblockedcountries` in [locationRestrict.js](../../src/middlewares/locationRestrict.js)) fold into the policy object cleanly.

### 3.5 Why this is better than calling the provider directly

| Concern | Inline vendor call (today) | IPIS |
|---|---|---|
| Latency | Vendor RTT on every request | Cache hit, sub-ms; vendor only on cold miss/worker |
| Availability | Vendor outage = feature outage | Cache+DB serve verdicts during vendor outage |
| Cost | Pay per request | Pay per unique IP per TTL (10–100x fewer calls) |
| Consistency | Two code paths, two shapes | One normalized contract |
| Reuse | None | Login, payment, admin, fraud share it |
| Auditability | Ad-hoc logs | Versioned policy + decision audit trail |
| Vendor switch | Code change in hot path | Config change behind abstraction |

---

## 4. Redis Caching Strategy

Redis is the **hot tier (L2)**, fronted by an in-process **L1 LRU** per Node worker. Both sit in front of Postgres (L3).

### 4.1 Key design

```
ip:intel:v3:{ipKeyspace}:{ip}        -> JSON IpIntelligence    (the verdict)
ip:lock:v3:{ip}                       -> short NX lock for single-flight refresh
ip:neg:v3:{ip}                        -> negative/unknown marker (provider gave nothing)
policy:ip:v3                          -> active decision policy snapshot
```

- **Versioned prefix (`v3`)** lets us roll the schema/policy and invalidate atomically by bumping the version — no `KEYS`/`SCAN` sweep needed.
- **IP normalization:** IPv4 stored as-is; IPv6 normalized to a **/64 prefix** keyspace (clients in the same /64 share a verdict — drastically improves hit-rate and curbs key explosion).
- Reuse the existing helpers (`getCachedData`/`setCachedData`/`setCachedDataIfNotExists`) so behavior and logging are consistent with the rest of the platform.

### 4.2 TTL strategy (tiered by confidence and verdict)

| Verdict / class | TTL | Rationale |
|---|---|---|
| Confident VPN/TOR/hosting `BLOCK` | 24h | These ranges are stable (datacenter/TOR lists change slowly) |
| Confident clean residential `ALLOW` | 6–12h | Residential IPs rotate, but slowly |
| Low-confidence / partial | 30–60 min | Re-evaluate sooner |
| Negative/unknown (provider empty) | 2–5 min (`ip:neg`) | Avoid hammering provider for un-resolvable IPs |
| Local-DB hits (TOR/DC feeds) | Until next feed import | Authoritative until refreshed |

- **TTL jitter:** add ±10% random jitter to every TTL to prevent synchronized expiry stampedes (thundering herd) at popular IPs.
- **Soft-TTL / stale-while-revalidate:** store `expiresAt` *inside* the value with a TTL slightly longer than `expiresAt`. On read, if `now > expiresAt` but key still present → **serve stale immediately** and enqueue an async refresh. Avoids hot-path provider calls entirely.

### 4.3 Cache hit/miss flow (single-flight)

```
get(ip):
  v = L1.get(ip)                         # in-proc LRU, ~1–5s TTL
  if v: return v
  v = redis.get(ip:intel)                # L2
  if v:
     L1.set(ip, v)
     if stale(v): enqueueRefresh(ip)     # SWR, non-blocking
     return v
  # L2 miss → try L3 (DB) before provider
  v = db.lookup(ip)
  if v and fresh(v):
     redis.setex(ip:intel, ttl(v), v); L1.set(ip,v); return v
  # cold path: single-flight to avoid stampede
  if redis.set(ip:lock, 1, 'NX', 'PX', 800):   # I won the lock
     v = providerGateway.lookup(ip, budgetMs)
     persist(v) -> db (async) + redis.setex + L1
     return v
  else:                                        # someone else is fetching
     wait-or-default(ip, budgetMs)             # brief poll, else flow default (§7)
```

**Single-flight (`NX` lock)** ensures that when 5,000 concurrent requests hit a brand-new IP, exactly **one** provider call is made; the rest reuse the result or fall back to policy. This is the single most important anti-stampede control at 20K+ rps.

### 4.4 Cache invalidation

- **Version bump** (`v3 → v4`) for global invalidation (policy/schema change).
- **Targeted `DEL`** for a specific IP when a worker re-classifies it or an analyst overrides it (`deleteCachedData`).
- **Feed-driven:** after a TOR/datacenter feed import, workers proactively `DEL` affected hot keys (or bump a feed-epoch suffix).

### 4.5 Cache warming

- **Top-N warmer:** a worker periodically pre-loads the most frequent source IPs (from access logs / fraud DB) so peak traffic hits warm keys.
- **Feed warmer:** after importing bulk VPN/TOR/datacenter lists, pre-populate Redis for the highest-traffic ranges.
- **Negative cache** prevents repeated cold misses for un-resolvable IPs.

### 4.6 Memory optimization & horizontal scaling

- Store **compact JSON** (short field names) or MessagePack; a verdict is ~200–400 bytes. 10M unique IPs ≈ 2–4GB — comfortable for a small cluster.
- `maxmemory-policy = volatile-lru` (the repo already warns when policy is `noeviction`, see [redisClient.js](../../src/utils/redisClient.js)) so only TTL-bearing keys are evicted under pressure; locks/policy keys carry their own short TTLs.
- **Redis Cluster** when a single primary's memory/throughput is exceeded: keys are hashtag-free single keys, so they shard cleanly by key. Use `{ip}`-free hashing (no cross-slot multi-key ops in the hot path). Run with replicas + `cluster-require-full-coverage no` for partial-failure tolerance, and read from replicas for verdict GETs if needed.

---

## 5. Persistent Storage (System of Record)

PostgreSQL is the **warm tier / source of record** for IP intelligence. It survives Redis flushes, powers analytics, feeds cache warming, and stores the audit trail.

### 5.1 Schema

```sql
-- IP intelligence: one row per normalized IP key (IPv4 or IPv6 /64).
CREATE TABLE IF NOT EXISTS "IPIntelligence" (
  "id"             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "ip"             inet        NOT NULL,            -- native inet type
  "ip_key"         varchar(64) NOT NULL,            -- normalized key (v4 or v6/64)
  "asn"            integer,
  "isp"            varchar(256),
  "org"            varchar(256),
  "country"        char(2),                         -- ISO-3166 alpha-2
  "region"         varchar(128),
  "city"           varchar(128),
  "is_vpn"         boolean     NOT NULL DEFAULT false,
  "is_proxy"       boolean     NOT NULL DEFAULT false,
  "is_hosting"     boolean     NOT NULL DEFAULT false,
  "is_tor"         boolean     NOT NULL DEFAULT false,
  "risk_score"     smallint    NOT NULL DEFAULT 0,  -- 0..100
  "confidence"     numeric(4,3) NOT NULL DEFAULT 0, -- 0.000..1.000
  "provider"       varchar(64),                     -- which vendor produced this
  "policy_version" varchar(16),
  "metadata"       jsonb       NOT NULL DEFAULT '{}'::jsonb, -- raw provider payload, normalized extras
  "last_checked_at" timestamptz NOT NULL DEFAULT now(),
  "expires_at"     timestamptz NOT NULL,
  "created_at"     timestamptz NOT NULL DEFAULT now(),
  "updated_at"     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_ip_intelligence_key UNIQUE ("ip_key")
);

-- Authoritative local feeds (TOR exit nodes, datacenter/cloud ranges, known VPN ASNs).
CREATE TABLE IF NOT EXISTS "ip_feed_range" (
  "id"          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "cidr"        cidr        NOT NULL,
  "feed_type"   varchar(32) NOT NULL,   -- 'tor' | 'datacenter' | 'vpn_asn' | 'allowlist' | 'denylist'
  "source"      varchar(64) NOT NULL,   -- feed name/url
  "asn"         integer,
  "metadata"    jsonb       NOT NULL DEFAULT '{}'::jsonb,
  "imported_at" timestamptz NOT NULL DEFAULT now(),
  "expires_at"  timestamptz
);

-- Decision audit trail (sampled / async-written; not on the hot path synchronously).
CREATE TABLE IF NOT EXISTS "ip_decision_audit" (
  "id"            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "ip_key"        varchar(64) NOT NULL,
  "flow"          varchar(16) NOT NULL,
  "decision"      varchar(16) NOT NULL,
  "reason"        varchar(64) NOT NULL,
  "policy_version" varchar(16),
  "merchant_id"   varchar(64),
  "request_id"    varchar(64),
  "degraded"      boolean NOT NULL DEFAULT false,
  "created_at"    timestamptz NOT NULL DEFAULT now()
) PARTITION BY RANGE ("created_at");      -- monthly partitions, cheap pruning
```

### 5.2 Indexing strategy

| Index | Type | Purpose |
|---|---|---|
| `uq_ip_intelligence_key (ip_key)` | B-tree UNIQUE | Primary point lookup + UPSERT target |
| `idx_ip_intel_expires (expires_at)` | B-tree | Worker scans for stale/expired rows to refresh |
| `idx_ip_intel_risk (risk_score) WHERE risk_score >= 70` | Partial | Fast high-risk analytics without bloating index |
| `idx_ip_feed_cidr` on `ip_feed_range USING gist (cidr inet_ops)` | GiST | **CIDR containment** (`>>=`) lookups for "is this IP in any datacenter/TOR range" |
| `idx_feed_type (feed_type)` | B-tree | Filter by feed class |
| audit table: monthly **range partitions** | — | `DROP PARTITION` for retention instead of `DELETE` |

**Reader/writer routing:** point lookups and worker scans go to the **reader pool**; UPSERTs and feed imports go to the **writer** — reusing the existing split in [src/utils/db.js](../../src/utils/db.js). The hot path should rarely touch Postgres (cache absorbs it), so reader load stays low.

**UPSERT pattern** (idempotent worker writes):

```sql
INSERT INTO IPIntelligence (ip, ip_key, asn, ..., expires_at)
VALUES ($1, $2, ...)
ON CONFLICT (ip_key) DO UPDATE SET
  asn = EXCLUDED.asn, is_vpn = EXCLUDED.is_vpn, risk_score = EXCLUDED.risk_score,
  provider = EXCLUDED.provider, last_checked_at = now(),
  expires_at = EXCLUDED.expires_at, updated_at = now()
WHERE IPIntelligence.last_checked_at < EXCLUDED.last_checked_at;  -- monotonic, no clobber
```

---

## 6. Background Workers

Workers run in the **existing worker process model** (`rabbitmq-worker.js` / `cron-worker.js`), separate from API processes, so they never compete with the hot path.

| Worker | Trigger | Job |
|---|---|---|
| **Refresh worker** | RabbitMQ `ip.refresh` queue (from SWR enqueues) | Re-fetch one IP via provider gateway, UPSERT DB, refresh cache. Single-flight per IP. |
| **Staleness sweeper** | Cron (e.g. every 5 min) | `SELECT ip_key WHERE expires_at < now() AND hot` → enqueue `ip.refresh` for high-traffic IPs only |
| **Feed importer** | Cron (hourly/daily) | Download TOR exit list, datacenter/cloud CIDR ranges, known VPN ASNs → bulk UPSERT `ip_feed_range`; invalidate affected hot keys |
| **Retry worker** | RabbitMQ DLQ + backoff | Re-process provider lookups that failed (timeouts/5xx) with exponential backoff + jitter; cap attempts → park |
| **Cache pruner** | Cron | Drop stale negative-cache keys, reconcile L1/L2 drift metrics; verify Redis memory headroom |
| **Provider health probe** | Cron (every 15–30s) | Synthetic lookups against each vendor; publish health → drives circuit-breaker state + dashboards |

**Backpressure & idempotency**

- Refresh queue is **bounded**; the sweeper only enqueues IPs above a traffic threshold to avoid flooding.
- All worker writes are **idempotent UPSERTs** keyed by `ip_key` (safe to retry).
- Retries use the existing producer retry/DLQ conventions already present in [src/rabbitmq/](../../src/rabbitmq/).

---

## 7. Third-party Providers — Gateway, Fallback, Circuit Breaker

### 7.1 Provider abstraction (vendor independence)

```ts
interface IpProvider {
  name: string;
  lookup(ip: string, signal: AbortSignal): Promise<RawProviderResult>;
  normalize(raw: RawProviderResult): IpIntelligence;  // vendor → canonical shape
  health(): ProviderHealth;
}
```

- proxycheck.io becomes one `IpProvider` implementation (today's logic in [proxyCheckService.js](../../src/utils/proxyCheckService.js) moves behind `normalize()`).
- Add fallbacks (e.g., IPQualityScore, IPinfo, MaxMind local DB) as additional implementations. **The decision engine never sees vendor-specific shapes.**

### 7.2 When to call a provider — and when NOT to

| Situation | Call provider? |
|---|---|
| Hot path, cache hit | **No** |
| Hot path, DB hit & fresh | **No** |
| Hot path, cold miss, won single-flight lock, within budget | **Yes** (strict budget, e.g. 300–500ms) |
| Hot path, lost single-flight lock | **No** — wait briefly or apply flow default |
| Local feed says TOR/datacenter | **No** — authoritative local answer |
| SWR refresh / sweeper / retry | **Yes**, off the hot path |

### 7.3 Fallback strategy

Ordered chain with health-aware skipping:

```
primary (proxycheck.io)
   └─(open breaker OR timeout OR empty)─► secondary (IPQS)
        └─(open breaker OR timeout)─────► local DB (MaxMind/feeds)  [always available]
             └────────────────────────► flow default decision (§7.5)
```

- **Local DB is the floor**: it's offline-importable and always answers TOR/datacenter/ASN, so we are never fully blind even if every external vendor is down.

### 7.4 Resilience controls

- **Circuit breaker** per provider (e.g. `opossum`): open after an error-rate/latency threshold, half-open probe to recover. Skips dead vendors instantly instead of paying the timeout repeatedly.
- **Timeout budget:** per-call deadline (`AbortController`); total escalation bounded by `budgetMs`. (Today there's a mismatch — 8s in the service vs 3s in the caller; the gateway enforces one coherent budget.)
- **Retry:** only off-hot-path (workers), exponential backoff + full jitter, capped attempts, then DLQ/park. **No synchronous retries on the request path.**
- **Rate limiting toward vendors:** `rate-limiter-flexible` (already used in-repo) caps outbound QPS per vendor to respect contracts and control cost; excess refreshes are queued, not dropped.
- **Bulkhead:** a bounded concurrency pool for outbound provider calls so a vendor slowdown can't exhaust the Node event loop / sockets.

### 7.5 Flow default decisions (used only when all tiers fail)

See §8 (Failover) — payment defaults to **CHALLENGE/BLOCK** (fail-closed), login uses a risk-tiered default.

---

## 8. Middleware (thin, IP-only)

The new middleware does **two** things: derive a trustworthy IP, and ask IPIS for a decision. It **never** calls a vendor.

### 8.1 Correct, spoof-resistant client IP

```ts
// Standardize on Express's computed req.ip with a correctly-sized trust-proxy.
// Behind Cloudflare → ALB, set: app.set('trust proxy', <number of trusted hops>)
// (today it's `1`; if Cloudflare + ALB are both in front, count the real hops).
function getTrustedClientIp(req): string {
  // req.ip is the left-most *untrusted* address after Express strips N trusted
  // proxies from X-Forwarded-For. This cannot be spoofed by the client as long
  // as `trust proxy` matches the real infra depth.
  let ip = req.ip;
  // Optional hardening when Cloudflare is authoritative: only trust
  // CF-Connecting-IP if the connecting peer is a verified Cloudflare egress range.
  if (cloudflareEnabled && isFromCloudflare(req.socket.remoteAddress)) {
    ip = req.headers['cf-connecting-ip'] || ip;
  }
  return normalizeIp(ip); // IPv6 → /64 keyspace, strip ::ffff: mapping, etc.
}
```

**Critical fix vs. today:** the current `getClientIp` blindly takes `x-forwarded-for.split(',')[0]` (the *client-controlled* hop) — spoofable. We replace it with `req.ip` + a correctly-sized `trust proxy`, optionally pinned to verified Cloudflare ranges. This aligns with the safe pattern already documented in [checkApiKey.js](../../src/middlewares/checkApiKey.js).

### 8.2 Middleware shape

```ts
function ipGuard(flow) {
  return async (req, res, next) => {
    const ip = getTrustedClientIp(req);
    const decision = await ipis.decide({
      ip,
      context: { flow, merchantId: req.params.merchantOrderId, userRole: req.userRole, requestId: req.id },
      budgetMs: flow === 'payment' ? 400 : 300,
    });
    req.ipIntel = decision.intelligence;          // available downstream (geo, audit)
    if (decision.decision === 'BLOCK') {
      auditAsync(decision);                        // fire-and-forget to MQ
      return next(new ForbiddenError(decision.reason));
    }
    if (decision.decision === 'CHALLENGE') { req.requireStepUp = true; }
    next();
  };
}
```

- Wiring: `login` route uses `ipGuard('login')`; payment page uses `ipGuard('payment')`. Existing geo/region/merchant rules move into the policy/decision engine so the middleware stays thin.

---

## 9. Failover Strategy

> **Principle:** *Match the failure mode to the value at risk.* A blocked legitimate login is recoverable (retry, support); an approved fraudulent payment is not. So **payment leans fail-closed**; login is risk-tiered.

| Component down | Behavior | Decision policy |
|---|---|---|
| **Provider(s) down** | Serve from Redis/DB/local feeds; breaker open; workers retry async | Cache/DB verdicts still enforce blocks. New unseen IP: **payment → CHALLENGE/BLOCK**, **login → ALLOW only if not in any local denylist/feed, else BLOCK** |
| **Redis down** | Fall back to L1 (in-proc) + Postgres reader directly; raise alert | Degraded but functional; `degraded=true`. Postgres absorbs lookups (low volume due to L1). **Payment fails closed on cold miss.** |
| **Postgres down** | Serve from Redis + L1 + local feed file (in-memory); workers pause writes | Verdicts still served from cache; **no new persistence** until recovery. Cold miss → flow default. |
| **Redis + Postgres both down** | L1 + in-memory local feed only | **Payment → BLOCK on unknown** (fail-closed). **Login → BLOCK on feed hit, else ALLOW** to preserve access. |
| **Latency spike** | Budget/timeout trips → default path | Never block the event loop; return flow default within `budgetMs`. |
| **Provider returns wrong result** | Confidence/cross-check + analyst override + feed authority | Multi-signal: a single low-confidence vendor "clean" does not override a local TOR/datacenter feed "blocked". |

**Why payment is fail-closed:** the strict business requirement is "VPN users must not open the payment page." If we cannot prove an IP is clean, the safe default for *money movement* is to deny/step-up. The current payment middleware already fails closed (HTTP 500) — we keep the intent but return a clean 403 + retry guidance instead of a 500.

**Why login is risk-tiered, not blanket fail-open:** today login fails *open* on timeout (a VPN user can slip through when the vendor is slow). That violates the business rule. The new default still blocks IPs that match **local, always-available denylists/feeds**, and only fails open for genuinely unknown IPs — closing the current gap without locking out all users during a vendor blip.

---

## 10. Migration Plan (zero downtime)

This runs in production today, so we use **parallel-run + shadow + gradual rollout** with instant rollback.

### 10.1 Controls

- **Feature flags** (per flow, per environment), stored in the existing settings table so flips need no deploy:
  - `IPIS_ENABLED` (master), `IPIS_LOGIN_MODE` / `IPIS_PAYMENT_MODE` ∈ `{off, shadow, canary, enforce}`.
- **Versioned policy** (`policy:ip:v3`) so we can roll forward/back the decision logic independently of code.

### 10.2 Stages

```
Stage 0  Build IPIS in library mode behind flags (OFF). No traffic impact.
Stage 1  SHADOW: middleware still uses the OLD path for the actual decision,
         but ALSO calls IPIS and logs (old_decision, new_decision). Compare
         offline. Zero user impact. Tune thresholds until disagreement < target.
Stage 2  CANARY: enforce IPIS for 1% → 5% → 25% of traffic (by IP hash /
         merchant cohort). Old path remains for the rest. Watch SLOs + block rate.
Stage 3  RAMP: 50% → 100% enforce. Old vendor-inline path stays wired but dormant.
Stage 4  DECOMMISSION: remove inline vendor calls from the two middlewares once
         100% stable for N days. proxycheck.io now only reachable via the gateway.
```

- **Shadow traffic** is the key safety net: it lets us validate the new decision against the live one on real traffic with **no risk**, quantifying false-positive/negative deltas before enforcing.
- **Canary by deterministic IP hash** keeps a given client on a stable code path (no flapping between old/new mid-session).

### 10.3 Rollback

- Any flag flips back to `shadow`/`off` instantly (config change, no deploy).
- Policy version can be pinned to the last-known-good (`v3 → v2`).
- Because IPIS reuses existing Redis/PG/MQ, there's no new stateful infra to unwind.

### 10.4 Monitoring during migration

- Dashboard panel: `old_vs_new_disagreement_rate`, `new_block_rate`, `new_p99_latency`, `degraded_rate`. Promotion gates are explicit thresholds on these.

---

## 11. Observability

### 11.1 SLIs / SLOs

| SLI | SLO target |
|---|---|
| IPIS decision latency (cache hit) | p99 < 3ms |
| IPIS decision latency (cold miss, within budget) | p99 < 450ms |
| Cache hit ratio (L1+L2) | > 97% steady state |
| Decision availability (any verdict returned) | 99.99% |
| Provider success rate (per vendor) | tracked, breaker thresholds tied to it |
| False-positive rate (legit user blocked) | < target, measured via appeals/override signal |

### 11.2 Metrics (Prometheus naming)

```
ipis_decision_total{flow,decision,reason,degraded}
ipis_decision_latency_seconds{flow,source}          # histogram; source=cache|db|provider
ipis_cache_hit_total{tier}                           # tier=l1|l2|db
ipis_cache_miss_total{tier}
ipis_provider_request_total{provider,outcome}        # outcome=ok|timeout|error|empty
ipis_provider_latency_seconds{provider}
ipis_circuit_breaker_state{provider}                 # 0 closed,1 half,2 open
ipis_redis_latency_seconds
ipis_block_rate                                       # blocks / decisions
ipis_refresh_queue_depth
ipis_requests_per_second{flow}
```

### 11.3 Dashboards, logs, tracing, alerts

- **Dashboards:** Cache hit ratio, decision latency heatmap, block rate over time, per-provider latency + breaker state, refresh queue depth, degraded-mode %.
- **Logs:** structured (reuse existing `logger`), one decision log per BLOCK + sampled ALLOWs, with `requestId`, `ip_key` (hashed/truncated for PII), `reason`, `policyVersion`, `source`, `degraded`.
- **Tracing:** OpenTelemetry spans — `ipis.decide` → `cache.get` → `db.lookup` → `provider.lookup`, propagating `requestId` so a slow login can be traced to a vendor span.
- **Alerts:** breaker open > N min; cache hit ratio < 90%; degraded-mode % > threshold; refresh queue depth growing; block-rate anomaly (sudden spike could mean a vendor mis-classification → page on-call).

---

## 12. Security

| Area | Control |
|---|---|
| **IP spoofing** | Use `req.ip` with correctly-sized `trust proxy`; do **not** trust raw `X-Forwarded-For[0]`. Optionally pin `CF-Connecting-IP` to verified Cloudflare egress ranges. |
| **Trusted proxy config** | Count real hops (Cloudflare + ALB). Document and assert at boot (fail-fast if misconfigured). |
| **Cloudflare integration** | Validate `CF-Connecting-IP` only when peer ∈ Cloudflare ranges; use Authenticated Origin Pulls (mTLS) so only Cloudflare reaches the origin. |
| **Header validation** | Reject/sanitize malformed forwarded headers; never log full raw client headers at INFO. |
| **Abuse prevention / rate limiting** | Reuse `rate-limiter-flexible` per-IP/per-merchant on login + payment-page endpoints; outbound vendor RL to prevent self-inflicted bill spikes. |
| **DDoS** | Absorb at edge (Cloudflare/ALB); IPIS cache + negative cache prevent origin amplification (one bad IP = one provider call, not N). |
| **Audit logging** | `ip_decision_audit` (async, partitioned) for every BLOCK and overrides; immutable, retained per compliance. PCI-relevant access decisions are auditable. |
| **PII / data handling** | Treat IP as PII: hash/truncate in logs, encrypt at rest (RDS), restrict raw-IP table access by IAM/role, define retention + purge (partition drop). |
| **Secrets** | Vendor API keys in secrets manager, not env files committed to the repo. |

---

## 13. Scalability

### 13.1 Scaling path

| Tier | API | Redis | Postgres | Notes |
|---|---|---|---|---|
| **20K rps** (today) | PM2 cluster / few K8s pods | Single primary + replica | Reader/writer split (existing) | Cache hit-ratio does the heavy lifting; vendor QPS collapses to unique-IP rate |
| **50K rps** | HPA-scaled stateless pods | Primary + 2 replicas, read verdicts from replicas | Add read replicas | L1 in-proc cache cuts Redis load further |
| **100K rps** | More pods, multi-AZ | **Redis Cluster** (shard by key) | Partition `ip_intelligence` if needed; audit already partitioned | Provider calls fully off hot path |
| **250K rps** | Extract IPIS to standalone Fastify service + gRPC; multi-region | Regional Redis Clusters | Regional read replicas, async cross-region replication of feeds | Event-driven refresh via Kafka if MQ volume demands |

### 13.2 How it scales

- **Stateless API & service:** no per-request state → horizontal scale behind ALB; K8s HPA on CPU/RPS.
- **Cache-first:** at 97%+ hit ratio, origin/vendor load grows with *unique IPs*, not request volume — the core reason this scales.
- **Redis Cluster:** single-key verdicts shard cleanly; no cross-slot ops on the hot path.
- **Postgres:** hot path rarely touches it; reads go to replicas; writes are low-rate idempotent UPSERTs from workers. Partition the audit table; partition `ip_intelligence` by `ip_key` hash only if write volume demands.
- **Event-driven refresh:** SWR enqueues + workers decouple freshness from request latency. Migrate `ip.refresh` from RabbitMQ to **Kafka** only if refresh throughput exceeds broker comfort (Kafka's log/replay suits high-volume fan-out; RabbitMQ is simpler and already in place).
- **Multi-region:** feeds and intelligence replicate async; each region serves from its local cache → no cross-region calls on the hot path.

---

## 14. High-Level Diagrams

### 14.1 Login flow (target)

```
Client ─► Cloudflare ─► ALB ─► API(login route)
                                  │ getTrustedClientIp(req.ip)
                                  ▼
                            ipGuard('login') ─► ipis.decide()
                                                     │
                                  ┌──────────────────┼───────────────────┐
                                  ▼ hit              ▼ miss(fresh DB)     ▼ cold miss
                              L1/L2 Redis        Postgres SoR        ProviderGateway(budget)
                                  │                  │                    │ (single-flight)
                                  └────────► IpDecision ◄─────────────────┘
                                                     │
                              BLOCK ──► 403 + audit  │  ALLOW ──► continue auth
```

### 14.2 Payment page flow (target)

```
Client(payment link) ─► Cloudflare ─► ALB ─► API(payment route)
                                               │ getTrustedClientIp
                                               ▼
                                         ipGuard('payment')  (fail-CLOSED default)
                                               │
                                          ipis.decide(flow=payment, merchantId)
                                               │
                  ┌────────────────────────────┼──────────────────────────┐
                  ▼                            ▼                           ▼
            merchant allow/deny         VPN/proxy/TOR/DC check       country/region rules
                  └────────────────────────────┼──────────────────────────┘
                                               ▼
                         BLOCK ─► 403 "VPN not allowed" + processPayInRestricted()
                         ALLOW ─► render payment page
```

### 14.3 Cache lookup (single-flight, SWR)

```
decide(ip)
  │
  ├─ L1 LRU hit? ───────────────► return
  ├─ L2 Redis hit? ─► stale? ─► enqueue refresh (async) ─► return (serve stale)
  ├─ L3 DB fresh? ──► warm L2/L1 ─► return
  └─ cold miss:
        SET ip:lock NX PX800
          ├─ won  ─► provider.lookup(budget) ─► persist(DB async + Redis + L1) ─► return
          └─ lost ─► brief wait → value? return : flow-default(§9)
```

### 14.4 Background worker flow

```
                 ┌── sweeper (cron) ──┐
expired/stale ──►│ enqueue ip.refresh │──► RabbitMQ ──► refresh worker ─► provider ─► UPSERT DB
                 └────────────────────┘                       │                       └─► invalidate/refresh cache
feed sources ──► feed importer (cron) ─► bulk UPSERT ip_feed_range ─► invalidate hot keys
failures ──────► DLQ ─► retry worker (backoff+jitter) ─► provider ─► UPSERT / park
vendors ───────► health probe (cron) ─► breaker state + metrics
```

### 14.5 Provider integration / failover

```
ProviderGateway.lookup(ip, budget)
   ├─ primary(proxycheck) [breaker closed?] ─ ok ─► normalize ─► return
   │        └─ timeout/err/empty/open ─┐
   ├─ secondary(IPQS) [breaker closed?]◄┘ ─ ok ─► normalize ─► return
   │        └─ timeout/err/open ────────┐
   ├─ local DB (MaxMind/feeds) ◄────────┘ ─ always answers ─► return
   └─ none ─► flow default decision (fail-closed for payment)
```

### 14.6 Overall system

```
        ┌────────── Edge ──────────┐
Client─►│ Cloudflare ─► AWS ALB     │
        └──────────────┬───────────┘
                       ▼ req.ip (trusted)
      ┌──────────── API tier (stateless, autoscaled) ─────────────┐
      │  login ─ ipGuard   payment ─ ipGuard   admin/fraud ─ SDK   │
      └───────────────────────┬───────────────────────────────────┘
                              ▼
                 ┌──── IPIS (lib → service) ────┐       ┌──── Workers ────┐
                 │ DecisionEngine               │  MQ   │ refresh/sweeper  │
                 │ Cache(L1+L2) ─ DB(L3) ─ Gw    │◄─────►│ import/retry     │
                 └───────┬─────────┬────────┬───┘       │ prune/health     │
                         ▼         ▼        ▼            └────────┬─────────┘
                   Redis(Cluster) Postgres  Provider             ▼
                                  (R/W)     Gateway ─► proxycheck/IPQS/MaxMind/feeds
```

---

## 15. Sample APIs (if/when extracted to a microservice)

```
POST /v1/ip/decide
  Body: { ip, context:{flow,merchantId,userRole,requestId}, budgetMs }
  200:  { decision, reason, policyVersion, intelligence:{...}, degraded }
  (idempotent, cacheable per ip+policyVersion)

GET  /v1/ip/{ip}                      # raw intelligence (no decision), admin/fraud use
POST /v1/ip/{ip}/refresh             # force async refresh (enqueues, 202)
POST /v1/ip/{ip}/override            # analyst allow/deny override (audited)
GET  /v1/policy                       # current policy + version
GET  /v1/health  /v1/ready  /metrics  # ops endpoints
```

Until extraction, the **identical contract** is exposed as an in-process module (`src/services/ipIntelligence/index.js`) — same method names, same shapes — so middlewares are written once.

---

## 16. Sequence Diagram (cold-miss login, single-flight)

```
Client      ipGuard       IPIS        Redis        Postgres     Gateway     proxycheck
  │  login    │             │            │             │           │            │
  │──────────►│             │            │             │           │            │
  │           │ decide(ip)  │            │             │           │            │
  │           │────────────►│ GET intel  │             │           │            │
  │           │             │───────────►│ (miss)      │           │            │
  │           │             │ SET lock NX│             │           │            │
  │           │             │───────────►│ (won)       │           │            │
  │           │             │ lookup DB  │             │           │            │
  │           │             │───────────────────────► │ (miss)     │            │
  │           │             │ provider.lookup(budget)  │           │            │
  │           │             │─────────────────────────────────────►│ GET /ip    │
  │           │             │                                       │───────────►│
  │           │             │                                       │◄───────────│ vpn=yes
  │           │             │ normalize+persist (async DB UPSERT, Redis SETEX)   │
  │           │             │◄──────────────────────────────────────│            │
  │           │ IpDecision  │ DEL lock                                            │
  │           │◄────────────│ (BLOCK, VPN_DETECTED)                               │
  │  403      │             │                                                     │
  │◄──────────│ audit async ─► RabbitMQ                                           │
```

---

## 17. Implementation Roadmap

### Phase 1 — Foundation (in-process IPIS, shadow only)
- **Deliverables:** `src/services/ipIntelligence/` (decision engine, cache layer over existing Redis helpers, `ip_intelligence` + `ip_feed_range` tables via SQL migration), proxycheck.io wrapped as an `IpProvider`, feature flags in settings, **shadow logging** in both middlewares.
- **Risks:** schema churn, normalization gaps vs. raw proxycheck payload. *Mitigation:* `metadata jsonb` keeps raw payload; shadow mode means zero user impact.
- **Testing:** unit tests for decision engine (pure), contract tests for provider normalize, load test cache path.
- **Rollout:** deploy with all flags `off/shadow`. No behavior change.

### Phase 2 — Caching + workers + single provider enforce
- **Deliverables:** L1 LRU, single-flight lock, SWR refresh, refresh/sweeper/feed-importer/health workers on existing worker processes, dashboards + alerts, canary enforce for **login** 1%→25%.
- **Risks:** cache stampede, false positives blocking real users. *Mitigation:* single-flight, negative cache, shadow-tuned thresholds, instant flag rollback.
- **Testing:** chaos test (kill Redis, kill provider) verifying failover matrix (§9); soak test at 1.5x peak.
- **Rollout:** login canary → 100%; payment stays shadow.

### Phase 3 — Multi-provider, circuit breakers, payment enforce
- **Deliverables:** secondary provider + MaxMind/feeds local DB, circuit breakers, gateway fallback chain, payment **fail-closed** enforce canary → 100%, audit table + partitioning.
- **Risks:** payment false-positives (revenue impact). *Mitigation:* fail-closed = CHALLENGE/step-up before hard block where possible; tight monitoring of payment block-rate; merchant override list.
- **Testing:** provider-outage game day; payment block-rate regression gate.
- **Rollout:** payment canary by merchant cohort → full.

### Phase 4 — Scale-out & hardening
- **Deliverables:** Redis Cluster, replica reads, optional IPIS microservice extraction (Fastify + gRPC), multi-region feed replication, OpenTelemetry tracing end-to-end, decommission inline vendor calls.
- **Risks:** cluster migration, cross-region consistency. *Mitigation:* dual-write/replicate then cut over; feeds are eventually-consistent by nature.
- **Testing:** 100K-rps load test, region-failover drill.
- **Rollout:** blue/green per region; remove dormant old code paths last.

---

## 18. Technology Stack & Rationale

| Concern | Choice | Why (and what's already in this repo) |
|---|---|---|
| Runtime | **Node.js** | Existing platform; no rewrite |
| API framework | **Express now; Fastify if/when IPIS is extracted** | Express is in place; Fastify's lower overhead + schema validation suits a high-QPS internal service |
| Hot cache | **Redis (ioredis) → Redis Cluster** | Already standardized ([redisClient.js](../../src/utils/redisClient.js)); cluster shards single-key verdicts cleanly |
| In-proc cache | **lru-cache** | Cuts Redis round-trips for ultra-hot IPs; per-worker, tiny TTL |
| System of record | **PostgreSQL (RDS, reader/writer + RDS Proxy)** | Existing split in [db.js](../../src/utils/db.js); `inet`/`cidr`/GiST give native IP-range queries |
| Messaging | **RabbitMQ now; Kafka if fan-out demands** | amqplib + workers already in repo; Kafka only if refresh volume outgrows it |
| Circuit breaker | **opossum** | Battle-tested per-provider breaker |
| Outbound RL | **rate-limiter-flexible** | Already used in repo ([rateLimiter.js](../../src/middlewares/rateLimiter.js)) |
| Local IP DB | **MaxMind GeoIP2 / IPinfo + TOR/datacenter feeds** | Offline floor so we're never fully blind |
| Metrics | **Prometheus + Grafana** | Standard; histogram-friendly metric names above |
| Tracing | **OpenTelemetry (+ Jaeger/Tempo)** | End-to-end span from `decide` to vendor |
| Logs | existing structured **logger** | Consistent with platform |
| Process mgmt | **PM2 cluster now; Kubernetes + HPA later** | `ecosystem.config.cjs`/`cluster.js` today; K8s for elastic scale |
| Containerization | **Docker → K8s** | Standard immutable deploys, HPA-driven scale |
| Secrets | **AWS Secrets Manager / SSM** | Keep vendor keys out of env files in the repo |

---

## 19. Trade-offs & Alternatives Considered

| Decision | Chosen | Alternative | Why chosen |
|---|---|---|---|
| Service form | In-process lib first | Microservice immediately | Avoids an extra network hop + new infra at 20K rps; extract only when scale/reuse demands |
| Freshness | Cache-first + SWR | Always-live vendor call | Live calls reintroduce the SPOF/latency we're removing |
| Login failure | Risk-tiered (block on local feed, soft on unknown) | Pure fail-open / pure fail-closed | Fail-open violates the business rule; pure fail-closed locks out users during vendor blips |
| Payment failure | Fail-closed (CHALLENGE→BLOCK) | Fail-open | Money movement: an approved fraudulent payment is irreversible |
| IPv6 keying | /64 prefix | Full address | Hit-rate + key-count control; /64 is the practical client boundary |
| Messaging | RabbitMQ | Kafka now | Already in repo; Kafka complexity unjustified until fan-out volume requires it |
| Anti-stampede | Single-flight `NX` lock | TTL-only | At 20K rps a new hot IP would otherwise trigger thousands of duplicate vendor calls |

---

## 20. Appendix — Migration SQL skeleton

```sql
-- migrations/create_ip_intelligence_tables.sql  (apply only when IPIS_ENABLED rollout begins)
-- (see §5.1 for full DDL: ip_intelligence, ip_feed_range, ip_decision_audit + indexes)
-- Indexes:
CREATE UNIQUE INDEX IF NOT EXISTS uq_ip_intelligence_key ON "ip_intelligence" ("ip_key");
CREATE INDEX IF NOT EXISTS idx_ip_intel_expires ON "ip_intelligence" ("expires_at");
CREATE INDEX IF NOT EXISTS idx_ip_intel_risk ON "ip_intelligence" ("risk_score") WHERE "risk_score" >= 70;
CREATE INDEX IF NOT EXISTS idx_ip_feed_cidr ON "ip_feed_range" USING gist ("cidr" inet_ops);
CREATE INDEX IF NOT EXISTS idx_ip_feed_type ON "ip_feed_range" ("feed_type");
```

---

### TL;DR for leadership
Replace the per-request third-party VPN call with a **cache-first Internal IP Intelligence Service** that reuses our existing Redis, PostgreSQL, and RabbitMQ. It cuts hot-path latency from hundreds of milliseconds to sub-millisecond, removes the external single point of failure, slashes vendor cost (pay per unique IP, not per request), enforces the strict "no VPN" rule **consistently and fail-closed for payments**, and scales from 20K to 250K+ rps. Delivered incrementally behind feature flags with shadow traffic and instant rollback — **zero downtime**.
```
