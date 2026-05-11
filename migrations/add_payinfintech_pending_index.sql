-- Migration: Add partial index for PayInFintech pending payouts reconciliation
-- Purpose: Optimize query performance for getPendingPayInFintechPayoutsDao
-- Date: 2024
-- 
-- This index improves the performance of the reconciliation cron job that queries
-- for pending PayInFintech payouts older than 10 minutes.
--
-- The partial index only includes rows where:
-- - status = 'PENDING'
-- - is_obsolete = false
-- - config->>'method' = 'PAYINFINTECH'
--
-- This significantly reduces index size and improves query performance.

-- Create the partial index concurrently to avoid locking the table
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payout_pending_payinfintech 
ON public."Payout" ((config->>'method'), status, company_id, updated_at)
WHERE status = 'PENDING' AND is_obsolete = false;

-- Verify the index was created
-- SELECT 
--   schemaname,
--   tablename,
--   indexname,
--   indexdef
-- FROM pg_indexes
-- WHERE indexname = 'idx_payout_pending_payinfintech';

-- To drop the index if needed (for rollback):
-- DROP INDEX CONCURRENTLY IF EXISTS idx_payout_pending_payinfintech;
