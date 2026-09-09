-- Migration: Create a sentinel "System" company for the global super admin.
-- This avoids company_id = NULL which breaks the entire auth/session flow
-- (getSessionByIdDao, getLoginDao, buildAuthSessionCacheKey, refresh, logout, etc.)
--
-- Safe to run multiple times (idempotent via ON CONFLICT).

BEGIN;

-- 5. Drop the old trigger + function (no longer needed — super admin has a real company_id)
DROP TRIGGER IF EXISTS require_company_for_non_super_admin ON public."User";
DROP FUNCTION IF EXISTS public.require_company_for_non_super_admin();

COMMIT;
