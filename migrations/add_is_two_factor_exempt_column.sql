-- Migration: Add is_two_factor_exempt column to User table
-- This flag indicates whether a user is exempt from global 2FA enforcement (set by admin)
-- When true, the user bypasses company-level 2FA enforcement even if it's enabled

ALTER TABLE "User" 
  ADD COLUMN IF NOT EXISTS is_two_factor_exempt BOOLEAN NOT NULL DEFAULT false;

-- Add comment to clarify the purpose
COMMENT ON COLUMN "User".is_two_factor_exempt IS 'Admin-set flag: whether user is exempt from global 2FA enforcement';
