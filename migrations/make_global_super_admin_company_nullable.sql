-- Migration: Allow NULL company_id for SUPER_ADMIN users and enforce company_id for all other roles
-- Run this on PostgreSQL database or let create-super-admin.mjs apply it automatically

ALTER TABLE public."User"
  ALTER COLUMN company_id DROP NOT NULL;

ALTER TABLE public."AccessToken"
  ALTER COLUMN company_id DROP NOT NULL;

-- Function to validate company_id constraint based on role
CREATE OR REPLACE FUNCTION public.require_company_for_non_super_admin()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.company_id IS NULL AND NOT EXISTS (
    SELECT 1
    FROM public."Role"
    WHERE id = NEW.role_id
      AND role = 'SUPER_ADMIN'
      AND is_obsolete = false
  ) THEN
    RAISE EXCEPTION 'company_id is required unless the user role is SUPER_ADMIN';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS require_company_for_non_super_admin ON public."User";

CREATE TRIGGER require_company_for_non_super_admin
BEFORE INSERT OR UPDATE OF company_id, role_id ON public."User"
FOR EACH ROW
EXECUTE FUNCTION public.require_company_for_non_super_admin();
