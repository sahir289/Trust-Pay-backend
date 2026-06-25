-- Create DeliveryAttempt table: an append-only audit trail of outbound delivery
-- attempts processed by the RabbitMQ consumers (merchant callbacks, Telegram
-- text alerts, Telegram OCR jobs). One row per queue-message processing attempt.
CREATE TABLE IF NOT EXISTS "DeliveryAttempt" (
  "id" varchar PRIMARY KEY DEFAULT (uuid_generate_v4()),
  "channel" varchar NOT NULL,
  "reference" varchar,
  "type" varchar,
  "attempt" integer NOT NULL DEFAULT 0,
  "outcome" varchar NOT NULL,
  "status_code" integer,
  "error" text,
  "duration_ms" integer,
  "created_at" TIMESTAMPTZ DEFAULT (now())
);

-- Indexes for the common audit queries (by channel, by outcome, recent-first,
-- and lookups by the per-message reference such as a callback URL or chat id).
CREATE INDEX IF NOT EXISTS idx_delivery_attempt_channel ON "DeliveryAttempt" ("channel");
CREATE INDEX IF NOT EXISTS idx_delivery_attempt_outcome ON "DeliveryAttempt" ("outcome");
CREATE INDEX IF NOT EXISTS idx_delivery_attempt_created_at ON "DeliveryAttempt" ("created_at");
CREATE INDEX IF NOT EXISTS idx_delivery_attempt_reference ON "DeliveryAttempt" ("reference");

COMMENT ON TABLE "DeliveryAttempt" IS 'Append-only audit trail of outbound delivery attempts (merchant callbacks, Telegram messages, Telegram OCR jobs)';
COMMENT ON COLUMN "DeliveryAttempt"."channel" IS 'Delivery channel: merchant_callback | telegram_message | telegram_ocr';
COMMENT ON COLUMN "DeliveryAttempt"."reference" IS 'Per-attempt reference: callback URL, Telegram chat id, or OCR caption';
COMMENT ON COLUMN "DeliveryAttempt"."type" IS 'Sub-type when applicable (e.g. Payin / Payout for callbacks)';
COMMENT ON COLUMN "DeliveryAttempt"."attempt" IS 'Zero-based retry count for this delivery attempt';
COMMENT ON COLUMN "DeliveryAttempt"."outcome" IS 'success | failure';
COMMENT ON COLUMN "DeliveryAttempt"."status_code" IS 'HTTP status code when the attempt produced an HTTP response';
COMMENT ON COLUMN "DeliveryAttempt"."error" IS 'Truncated error message on failure';
COMMENT ON COLUMN "DeliveryAttempt"."duration_ms" IS 'Wall-clock duration of the attempt in milliseconds';
