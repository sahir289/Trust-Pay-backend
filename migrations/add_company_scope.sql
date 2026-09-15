-- Migration: Add `scope` column to Company table.
-- scope = 'global'  → system / super-admin company
-- scope = 'company' → regular merchant / vendor companies (default)

BEGIN;

-- 1. Add the column with a safe default so existing rows are covered
ALTER TABLE public."Company"
  ADD COLUMN scope VARCHAR(10) NOT NULL DEFAULT 'company';


-- 3. Constrain to the two allowed values
ALTER TABLE public."Company"
  ADD CONSTRAINT company_scope_check
  CHECK (scope IN ('global', 'company'));

-- 4. Index for fast scope-based lookups
CREATE INDEX "Company_scope_idx"
  ON public."Company" USING btree (scope);

COMMIT;
