-- ============================================================================
-- subxact_overflow.sql
-- ============================================================================
-- Experiment: XID-bearing subtransaction cache overflow
--
-- Purpose:
--   Create more than PGPROC_MAX_CACHED_SUBXIDS (normally 64) XID-bearing
--   subtransactions inside one top-level transaction.
--
-- Measure:
--   1. subxact_count
--   2. subxact_overflow
--   3. Subtrans SLRU activity
--   4. transaction age
--   5. wait events
--   6. WAL position
--
-- This experiment is intentionally designed for a dedicated test database.
-- DO NOT run against production infrastructure.
-- ============================================================================


-- ============================================================================
-- 1. Experiment metadata
-- ============================================================================

SELECT
    clock_timestamp() AS experiment_started,
    current_database() AS database_name,
    current_user AS database_user,
    version() AS postgres_version;


-- ============================================================================
-- 2. Capture initial backend state
-- ============================================================================

SELECT
    a.pid,
    a.state,
    a.xact_start,
    a.backend_xid,
    a.backend_xmin,
    s.subxact_count,
    s.subxact_overflow,
    a.wait_event_type,
    a.wait_event
FROM pg_stat_activity AS a
CROSS JOIN LATERAL pg_stat_get_backend_subxact(a.pid) AS s
WHERE a.pid = pg_backend_pid();


-- ============================================================================
-- 3. Capture initial Subtrans statistics
-- ============================================================================

SELECT
    clock_timestamp() AS captured_at,
    name,
    blks_hit,
    blks_read,
    blks_written,
    stats_reset
FROM pg_stat_slru
WHERE name = 'Subtrans';


-- ============================================================================
-- 4. Capture initial WAL position
-- ============================================================================

SELECT
    clock_timestamp() AS captured_at,
    pg_current_wal_lsn() AS wal_lsn;


-- ============================================================================
-- 5. Begin ONE top-level transaction
-- ============================================================================
--
-- Every iteration below creates an XID-bearing subtransaction.
--
-- The important property is that these subtransactions are created within
-- the same top-level transaction.
-- ============================================================================

BEGIN;


-- ============================================================================
-- 6. Generate XID-bearing subtransactions
-- ============================================================================
--
-- Each block uses EXCEPTION handling, which creates a subtransaction.
--
-- The INSERT forces the subtransaction to acquire an XID.
--
-- The exception is intentionally raised so the subtransaction rolls back,
-- allowing the loop to continue.
--
-- 100 iterations deliberately exceeds the normal 64-entry cache.
-- ============================================================================

CREATE TEMP TABLE IF NOT EXISTS pg_subxact_overflow_test (
    id integer,
    payload text
);

DO $$
DECLARE
    i integer;
BEGIN
    FOR i IN 1..100 LOOP
        BEGIN
            INSERT INTO pg_subxact_overflow_test
            VALUES (
                i,
                'subxact-overflow-' || i
            );

            RAISE EXCEPTION 'intentional test exception %', i;

        EXCEPTION
            WHEN OTHERS THEN
                NULL;
        END;

        -- Observe the backend state periodically.
        IF i IN (1, 32, 64, 65, 66, 80, 100) THEN
            RAISE NOTICE 'completed subtransaction iteration %', i;
        END IF;
    END LOOP;
END
$$;


-- ============================================================================
-- 7. Inspect overflow state WHILE top-level transaction is still open
-- ============================================================================

SELECT
    clock_timestamp() AS captured_at,
    a.pid,
    a.xact_start,
    now() - a.xact_start AS transaction_age,
    a.backend_xid,
    a.backend_xmin,
    s.subxact_count,
    s.subxact_overflow,
    a.wait_event_type,
    a.wait_event
FROM pg_stat_activity AS a
CROSS JOIN LATERAL pg_stat_get_backend_subxact(a.pid) AS s
WHERE a.pid = pg_backend_pid();


-- ============================================================================
-- 8. Capture Subtrans statistics after overflow
-- ============================================================================

SELECT
    clock_timestamp() AS captured_at,
    name,
    blks_hit,
    blks_read,
    blks_written,
    stats_reset
FROM pg_stat_slru
WHERE name = 'Subtrans';


-- ============================================================================
-- 9. Capture current WAL position
-- ============================================================================

SELECT
    clock_timestamp() AS captured_at,
    pg_current_wal_lsn() AS wal_lsn;


-- ============================================================================
-- 10. Check for SLRU-related waits
-- ============================================================================

SELECT
    pid,
    usename,
    application_name,
    state,
    wait_event_type,
    wait_event,
    now() - xact_start AS transaction_age,
    left(query, 200) AS query
FROM pg_stat_activity
WHERE wait_event IS NOT NULL
ORDER BY pid;


-- ============================================================================
-- 11. Keep the top-level transaction open
-- ============================================================================
--
-- IMPORTANT:
--
-- Do NOT COMMIT immediately if this script is being used for the standby
-- snapshot experiment.
--
-- The long-running transaction is part of the test condition.
--
-- For the isolated subtransaction experiment, COMMIT may be executed after
-- measurements have been captured.
--
-- For the replica experiment, leave this transaction open and capture the
-- standby state from a separate session.
-- ============================================================================


-- ============================================================================
-- 12. Final measurement after commit
-- ============================================================================
--
-- Execute this section AFTER the test transaction is intentionally committed
-- or rolled back.
-- ============================================================================

COMMIT;


SELECT
    clock_timestamp() AS post_commit_time,
    pg_current_wal_lsn() AS wal_lsn;


-- ============================================================================
-- 13. Capture post-transaction Subtrans statistics
-- ============================================================================

SELECT
    clock_timestamp() AS captured_at,
    name,
    blks_hit,
    blks_read,
    blks_written,
    stats_reset
FROM pg_stat_slru
WHERE name = 'Subtrans';


-- ============================================================================
-- 14. Final backend subtransaction state
-- ============================================================================

SELECT
    a.pid,
    a.state,
    a.backend_xid,
    a.backend_xmin,
    s.subxact_count,
    s.subxact_overflow
FROM pg_stat_activity AS a
CROSS JOIN LATERAL pg_stat_get_backend_subxact(a.pid) AS s
WHERE a.pid = pg_backend_pid();


-- ============================================================================
-- EXPECTED OBSERVATION
-- ============================================================================
--
-- The critical observation is:
--
--     subxact_overflow = true
--
-- after the backend crosses the cache boundary.
--
-- This establishes that the workload actually produced the condition required
-- for the subsequent Subtrans and standby experiments.
--
-- It does NOT by itself prove:
--
--     overflow
--       -> replica latency
--       -> delayed hot standby
--
-- Those require separate controlled experiments.
-- ============================================================================


-- ============================================================================
-- REQUIRED COMPARISON
-- ============================================================================
--
-- Compare results with:
--
--     baseline.sql
--
-- Specifically calculate:
--
--     Δ Subtrans blks_read
--     Δ Subtrans blks_written
--     Δ WAL bytes
--     transaction duration
--     subxact_count
--     subxact_overflow
--     observed wait events
--
-- Record results in the experiment results schema.
-- ============================================================================
