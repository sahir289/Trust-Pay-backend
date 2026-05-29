-- create SystemSettings Table with standard format
CREATE TABLE IF NOT EXISTS "SystemSettings" (
  "id" varchar PRIMARY KEY DEFAULT (uuid_generate_v4()),
  "key" varchar UNIQUE NOT NULL,
  "value" json NOT NULL DEFAULT '{}',
  "config" json NOT NULL DEFAULT '{}',
  "created_by" varchar,
  "updated_by" varchar,
  "created_at" TIMESTAMPTZ DEFAULT (now()),
  "updated_at" TIMESTAMPTZ DEFAULT (now()),
  "is_obsolete" boolean DEFAULT false
);

-- creates index on key for faster lookups
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON "SystemSettings" ("key");
CREATE INDEX IF NOT EXISTS idx_system_settings_is_obsolete ON "SystemSettings" ("is_obsolete");

COMMENT ON TABLE "SystemSettings" IS 'System-wide configuration settings';
COMMENT ON COLUMN "SystemSettings"."key" IS 'Unique setting key identifier';
COMMENT ON COLUMN "SystemSettings"."value" IS 'Setting value stored as JSON';
COMMENT ON COLUMN "SystemSettings"."config" IS 'Additional metadata for the setting';
