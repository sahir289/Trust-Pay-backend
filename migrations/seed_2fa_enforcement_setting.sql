-- Seed initial value for two_factor_enforcement setting
INSERT INTO "SystemSettings" (key, value)
VALUES ('two_factor_enforcement', '{"enabled": false}')
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE "SystemSettings" IS 'System-wide configuration settings including 2FA enforcement';
