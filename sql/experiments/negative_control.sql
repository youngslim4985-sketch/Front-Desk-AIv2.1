-- ============================================================================
-- negative_control.sql
-- ============================================================================
-- Experiment: Negative control for subtransaction-overflow investigation
--
-- Purpose:
--   Reproduce approximately the same transaction/WAL workload without
--   generating the >64 XID-bearing subtransaction condition.
--
-- Comparison:
--
--   CONTROL:
--       normal transaction
--       comparable WAL activity
--       NO subtransaction overflow
--
--   TEST:
--       >64 XID-bearing subtransactions
--       overflow = true
--       comparable WAL activity
--
-- This experiment is intended to isolate the effect of subtransaction
-- overflow from ordinary WAL generation and standby replay.
--
-- Run only on dedicated test infrastructure.
-- ============================================================================


-- ============================================================================
-- PART A — ENVIRONMENT
-- ============================================================================

SELECT
    clock_timestamp() AS experiment_started,
    current_database() AS database_name,
    current_user AS database_user,
    version() AS postgres_version,
    pg_is_in_recovery() AS in_recovery;


-- ============================================================================
-- 1. Confirm this is the PRIMARY
-- ============================================================================

SELECT
    pg_is_in_recovery() AS in_recovery;


-- Expected:
--
--     false
--
-- ============================================================================


-- ============================================================================
-- 2. Initial WAL position
-- ============================================================================

SELECT
    clock_timestamp() AS captured_at,
    pg_current_wal_lsn() AS wal_lsn;


-- ============================================================================
-- 3. Initial Subtrans SLRU state
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
-- 4. Create control table
-- ============================================================================

CREATE TABLE IF NOT EXISTS standby_negative_control (
    id integer PRIMARY KEY,
    payload text NOT NULL
);


-- ============================================================================
-- PART B — CONTROL TRANSACTION
-- ============================================================================
--
-- Keep the transaction open for approximately the same duration as the
-- overflow experiment.
--
-- IMPORTANT:
--
-- No EXCEPTION blocks.
-- No SAVEPOINT loop.
-- No generated XID-bearing subtransactions.
-- ============================================================================


BEGIN;


-- ============================================================================
-- 5. Generate comparable WAL
-- ============================================================================

INSERT INTO standby_negative_control (id, payload)
SELECT
    i,
    'negative-control-' || i
FROM generate_series(1, 1000) AS i
ON CONFLICT (id)
DO UPDATE
SET payload = EXCLUDED.payload;


-- ============================================================================
-- 6. Verify backend state
-- ============================================================================

SELECT
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
-- 7. Keep transaction open
-- ============================================================================
--
-- Match the approximate duration used in the overflow experiment.
--
-- Adjust this value to match the measured duration of the test run.
-- ============================================================================

SELECT pg_sleep(30);


-- ============================================================================
-- 8. Capture WAL before commit
-- ============================================================================

SELECT
    clock_timestamp() AS captured_at,
    pg_current_wal_lsn() AS wal_lsn;


-- ============================================================================
-- 9. Capture Subtrans state
-- ============================================================================

SELECT
    clock_timestamp() AS captured_at,
    name,
    blks_hit,
    blks_read,
    blks_written
FROM pg_stat_slru
WHERE name = 'Subtrans';


-- ============================================================================
-- 10. Commit control transaction
-- ============================================================================

COMMIT;


-- ============================================================================
-- PART C — POST-COMMIT
-- ============================================================================


SELECT
    clock_timestamp() AS commit_time,
    pg_current_wal_lsn() AS wal_lsn;


-- ============================================================================
-- 11. Final Subtrans state
-- ============================================================================

SELECT
    clock_timestamp() AS captured_at,
    name,
    blks_hit,
    blks_read,
    blks_written
FROM pg_stat_slru
WHERE name = 'Subtrans';


-- ============================================================================
-- PART D — STANDBY COMPARISON
-- ============================================================================
--
-- Execute the following from the STANDBY during the corresponding recovery
-- test.
-- ============================================================================


SELECT
    clock_timestamp() AS captured_at,
    pg_is_in_recovery() AS in_recovery,
    pg_last_wal_receive_lsn() AS receive_lsn,
    pg_last_wal_replay_lsn() AS replay_lsn,
    pg_last_xact_replay_timestamp() AS replay_timestamp;


-- ============================================================================
-- 12. Test read availability
-- ============================================================================

SELECT
    clock_timestamp() AS query_time,
    current_database() AS database_name,
    pg_is_in_recovery() AS in_recovery,
    current_setting('transaction_read_only') AS transaction_read_only;


-- ============================================================================
-- ============================================================================
-- COMPARISON MATRIX
-- ============================================================================
--
-- Record one row for the CONTROL and one for the OVERFLOW experiment.
--
-- | Metric                         | Control | Overflow |
-- |--------------------------------|---------|----------|
-- | PostgreSQL version             |         |          |
-- | transaction duration           |         |          |
-- | subxact_count                  |         |          |
-- | subxact_overflow               |         |          |
-- | Subtrans blks_read delta       |         |          |
-- | Subtrans blks_hit delta        |         |          |
-- | WAL generated                  |         |          |
-- | standby receive lag            |         |          |
-- | standby replay lag             |         |          |
-- | standby readiness time         |         |          |
-- | first successful read          |         |          |
-- | SLRURead waits                 |         |          |
-- | MultiXact waits                |         |          |
--
-- ============================================================================


-- ============================================================================
-- INTERPRETATION
-- ============================================================================
--
-- The control should demonstrate:
--
--     subxact_overflow = false
--
-- while producing a comparable amount of ordinary database/WAL activity.
--
-- If standby recovery time is similar between CONTROL and OVERFLOW:
--
--     the overflow condition has not demonstrated a measurable standby
--     availability effect under this workload.
--
-- If OVERFLOW consistently shows materially longer readiness/recovery:
--
--     investigate the WAL transaction-state records and snapshot construction
--     path before attributing the difference specifically to pg_subtrans.
--
-- ============================================================================


-- ============================================================================
-- REPEATABILITY REQUIREMENT
-- ============================================================================
--
-- Run both workloads multiple times.
--
-- Recommended minimum:
--
--     5 CONTROL runs
--     5 OVERFLOW runs
--
-- Report:
--
--     median
--     p95
--     minimum
--     maximum
--
-- rather than relying on a single observation.
--
-- ============================================================================


-- ============================================================================
-- FINAL RULE
-- ============================================================================
--
-- This experiment must NOT be used to claim:
--
--     "PGPROC_MAX_CACHED_SUBXIDS causes replica outages."
--
-- It can only establish whether the overflow condition produces a measurable
-- difference under the tested PostgreSQL version, configuration, replication
-- topology, and workload.
--
-- ============================================================================
