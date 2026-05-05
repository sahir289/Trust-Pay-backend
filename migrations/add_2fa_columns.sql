-- Migration: Add Google Authenticator 2FA columns to "User" table
-- Run this on the database before deploying the application changes.

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS is_two_factor_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS two_factor_secret TEXT;
