-- Migrate existing companies that have PAYINFINTECH configuration to enable allowPayInFintech
-- This sets allowPayInFintech = true for companies where PAYINFINTECH object exists with required fields
-- Companies without PAYINFINTECH will get allowPayInFintech = false via application defaults

UPDATE "Company"
SET config = jsonb_set(config, '{allowPayInFintech}', 'true', true)
WHERE config ? 'PAYINFINTECH'
  AND config -> 'PAYINFINTECH' ? 'Email'
  AND config -> 'PAYINFINTECH' ? 'Password'
  AND config -> 'PAYINFINTECH' ? 'defaultBankId'
  AND (config ->> 'allowPayInFintech') IS NULL;

-- Optional: Log how many rows were updated
-- SELECT rows_updated FROM ... (run manually to verify)

COMMENT ON COLUMN "Company".config IS 'Updated: Added allowPayInFintech boolean flag for PayInFintech enablement';
