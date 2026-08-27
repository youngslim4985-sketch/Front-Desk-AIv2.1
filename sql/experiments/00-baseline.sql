-- Baseline control
-- Purpose: establish normal transaction, SLRU, and query behavior
-- No intentional subtransaction overflow.

SELECT
    now() AS captured_at,
    name,
    blks_hit,
    blks_read,
    blks_written
FROM pg_stat_slru
WHERE name IN ('Subtrans', 'MultiXactMember', 'MultiXactOffset');

SELECT
    pid,
    state,
    wait_event_type,
    wait_event,
    xact_start,
    query_start
FROM pg_stat_activity
WHERE datname = current_database();
