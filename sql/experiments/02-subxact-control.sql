-- Negative control for subtransaction experiment
-- Purpose: perform equivalent useful work without creating
-- a per-row subtransaction storm.

-- TODO:
-- Implement set-based equivalent.
-- Compare elapsed time, WAL, SLRU activity,
-- and wait events against 01-subxact-overflow.sql.
