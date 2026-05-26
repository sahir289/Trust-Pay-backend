-- Migration: Add is_two_factor_required column to User table
-- This flag indicates whether 2FA is mandatory for a user (set by admin)
-- It is separate from is_two_factor_enabled which indicates actual 2FA setup completion

ALTER TABLE "User" 
  ADD COLUMN IF NOT EXISTS is_two_factor_required BOOLEAN NOT NULL DEFAULT false;

-- Add comment to clarify the difference between the two flags
COMMENT ON COLUMN "User".is_two_factor_required IS 'Admin-set flag: whether 2FA is mandatory for this user';
COMMENT ON COLUMN "User".is_two_factor_enabled IS 'User-set flag: whether user has completed 2FA setup (scanned QR + verified OTP)';
