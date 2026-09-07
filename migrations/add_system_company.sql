-- Migration: Create a sentinel "System" company for the global super admin.
-- This avoids company_id = NULL which breaks the entire auth/session flow
-- (getSessionByIdDao, getLoginDao, buildAuthSessionCacheKey, refresh, logout, etc.)
--
-- Safe to run multiple times (idempotent via ON CONFLICT).

BEGIN;

-- 1. Create the sentinel "System" company (idempotent)
INSERT INTO public."Company" (
  id, first_name, last_name, email, contact_no, config, is_obsolete
)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'TrustPay',
  'System',
  'system@trustpay.internal',
  '0000000000',
  '{}',
  false
)
ON CONFLICT (id) DO NOTHING;

-- 4. Restore NOT NULL constraints (all NULLs are now resolved)
ALTER TABLE public."User"
  ALTER COLUMN company_id SET NOT NULL;

ALTER TABLE public."AccessToken"
  ALTER COLUMN company_id SET NOT NULL;

-- 5. Drop the old trigger + function (no longer needed — super admin has a real company_id)
DROP TRIGGER IF EXISTS require_company_for_non_super_admin ON public."User";
DROP FUNCTION IF EXISTS public.require_company_for_non_super_admin();

COMMIT;
