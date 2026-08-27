-- Controlled MultiXact workload
-- Purpose: generate concurrent compatible row locks and
-- measure MultiXactMember/Offset cache behavior.

-- TODO:
-- Use multiple sessions against a dedicated test table.
-- Capture pg_stat_slru before and after.
-- Record MultiXact-related wait events.
