-- Create IdempotencyKey table: a short-lived store that lets merchant-facing
-- MUTATING endpoints (payIn create / payOut create) be safely retried without
-- double-charging / double-paying. Each (merchant_scope, idempotency_key) pair
-- is claimed atomically; the first request executes and its response is cached,
-- and any later request reusing the same key replays the stored response
-- instead of re-running the operation.
--
-- This table is only used when IDEMPOTENCY_ENABLED='true' (default off). When
-- the flag is off the middleware no-ops and never touches this table.
CREATE TABLE IF NOT EXISTS "IdempotencyKey" (
  "id" varchar PRIMARY KEY DEFAULT (uuid_generate_v4()),
  "idempotency_key" varchar NOT NULL,
  "merchant_scope" varchar NOT NULL,
  "method" varchar NOT NULL,
  "path" varchar NOT NULL,
  "request_hash" varchar NOT NULL,
  "status" varchar NOT NULL DEFAULT 'in_progress',
  "response_status" integer,
  "response_body" jsonb,
  "created_at" TIMESTAMPTZ DEFAULT (now()),
  "completed_at" TIMESTAMPTZ,
  "expires_at" TIMESTAMPTZ DEFAULT (now() + interval '24 hours'),
  -- One claim per merchant per key. Enables the atomic INSERT ... ON CONFLICT
  -- claim used by the idempotency middleware.
  CONSTRAINT uq_idempotency_scope_key UNIQUE ("merchant_scope", "idempotency_key")
);

-- Supports the (future) periodic cleanup of expired claims and recent-first
-- diagnostics.
CREATE INDEX IF NOT EXISTS idx_idempotency_expires_at ON "IdempotencyKey" ("expires_at");
CREATE INDEX IF NOT EXISTS idx_idempotency_created_at ON "IdempotencyKey" ("created_at");

COMMENT ON TABLE "IdempotencyKey" IS 'Short-lived idempotency claims/response cache for mutating merchant endpoints (used only when IDEMPOTENCY_ENABLED=true)';
COMMENT ON COLUMN "IdempotencyKey"."idempotency_key" IS 'Merchant-supplied Idempotency-Key request header value';
COMMENT ON COLUMN "IdempotencyKey"."merchant_scope" IS 'Identity the key is scoped to (authenticated merchant or request code) so keys never collide across merchants';
COMMENT ON COLUMN "IdempotencyKey"."request_hash" IS 'SHA-256 of method+path+canonical payload; a key reused with a different payload is rejected';
COMMENT ON COLUMN "IdempotencyKey"."status" IS 'in_progress while the first request runs; completed once a 2xx response is cached';
COMMENT ON COLUMN "IdempotencyKey"."response_status" IS 'Cached HTTP status of the first successful response (replayed on retry)';
COMMENT ON COLUMN "IdempotencyKey"."response_body" IS 'Cached JSON response body of the first successful response (replayed on retry)';
COMMENT ON COLUMN "IdempotencyKey"."expires_at" IS 'When the claim/cache becomes eligible for cleanup (default now()+24h)';
