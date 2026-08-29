-- ============================================================================
-- baseline.sql
-- ============================================================================
-- Experiment: Baseline / Negative Control
--
-- Purpose:
--   Establish normal PostgreSQL behavior under a comparable workload without
--   intentionally creating subtransaction overflow.
--
-- This experiment is the control for:
--
--   E1  Subtransaction overflow
--   E2  Subtrans SLRU pressure
--   E3  MultiXact pressure
--   E4  Standby snapshot/readiness behavior
--
-- IMPORTANT:
--   This script intentionally avoids per-row EXCEPTION blocks and large
--   SAVEPOINT chains.
--
-- No production infrastructure.
-- Run only against a dedicated test PostgreSQL instance.
-- ============================================================================


-- ============================================================================
-- EXPERIMENT METADATA
-- ============================================================================

SELECT
    clock_timestamp() AS experiment_started,
    current_database() AS database_name,
    current_user AS database_user,
    version() AS postgres_version;


-- ============================================================================
-- 1. Record baseline transaction/subtransaction state
-- ============================================================================

SELECT
    pid,
    usename,
    application_name,
    state,
    xact_start,
    backend_xid,
    backend_xmin,
    s.subxact_count,
    s.subxact_overflow
FROM pg_stat_activity AS a
CROSS JOIN LATERAL pg_stat_get_backend_subxact(a.pid) AS s
WHERE a.pid = pg_backend_pid();


-- ============================================================================
-- 2. Record baseline SLRU statistics
-- ============================================================================

SELECT
    clock_timestamp() AS captured_at,
    name,
    blks_hit,
    blks_read,
    blks_written,
    stats_reset
FROM pg_stat_slru
WHERE name IN (
    'Subtrans',
    'MultiXactMember',
    'MultiXactOffset'
)
ORDER BY name;


-- ============================================================================
-- 3. Record baseline replication state
-- ============================================================================
--
-- On a primary:
-- ============================================================================

SELECT
    clock_timestamp() AS captured_at,
    application_name,
    state,
    sent_lsn,
    write_lsn,
    flush_lsn,
    replay_lsn,
    write_lag,
    flush_lag,
    replay_lag,
    sync_state
FROM pg_stat_replication
ORDER BY application_name;


-- ============================================================================
-- 4. Create dedicated benchmark table
-- ============================================================================
--
-- The experiment harness may execute this section once before repeated runs.
--
-- This is intentionally simple so that the workload itself does not introduce
-- unnecessary database complexity.
-- ============================================================================

CREATE TABLE IF NOT EXISTS pg_research_baseline (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    payload text,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);


-- ============================================================================
-- 5. Baseline write workload
-- ============================================================================
--
-- Set-based INSERT.
--
-- No per-row EXCEPTION handling.
-- No explicit SAVEPOINT loop.
-- ============================================================================

INSERT INTO pg_research_baseline (payload)
SELECT
    'baseline-' || g
FROM generate_series(1, 10000) AS g;


-- ============================================================================
-- 6. Baseline read workload
-- ============================================================================

SELECT
    count(*) AS row_count,
    min(id) AS min_id,
    max(id) AS max_id
FROM pg_research_baseline;


-- ============================================================================
-- 7. Baseline aggregation workload
-- ============================================================================

SELECT
    count(*) AS rows,
    avg(length(payload)) AS average_payload_length,
    min(created_at) AS oldest_row,
    max(created_at) AS newest_row
FROM pg_research_baseline;


-- ============================================================================
-- 8. Re-check current backend subtransaction state
-- ============================================================================

SELECT
    pid,
    s.subxact_count,
    s.subxact_overflow,
    backend_xid,
    backend_xmin,
    xact_start
FROM pg_stat_activity AS a
CROSS JOIN LATERAL pg_stat_get_backend_subxact(a.pid) AS s
WHERE a.pid = pg_backend_pid();


-- ============================================================================
-- 9. Capture SLRU deltas after baseline workload
-- ============================================================================

SELECT
    clock_timestamp() AS captured_at,
    name,
    blks_hit,
    blks_read,
    blks_written
FROM pg_stat_slru
WHERE name IN (
    'Subtrans',
    'MultiXactMember',
    'MultiXactOffset'
)
ORDER BY name;


-- ============================================================================
-- 10. Current wait-event snapshot
-- ============================================================================

SELECT
    wait_event_type,
    wait_event,
    count(*) AS sessions
FROM pg_stat_activity
WHERE wait_event IS NOT NULL
GROUP BY
    wait_event_type,
    wait_event
ORDER BY sessions DESC;


-- ============================================================================
-- 11. Final experiment metadata
-- ============================================================================

SELECT
    clock_timestamp() AS experiment_finished;


-- ============================================================================
-- EXPECTED CONTROL RESULT
-- ============================================================================
--
-- The baseline should NOT intentionally produce:
--
--   subxact_overflow = true
--
-- and should not exhibit a sustained increase in Subtrans reads attributable
-- to the workload itself.
--
-- MultiXact activity should also remain low unless the surrounding test
-- environment introduces concurrent row locking.
--
-- If the baseline already exhibits significant:
--
--   Subtrans reads
--   MultiXact reads
--   SLRURead waits
--   MultiXact LWLock waits
--   transaction-horizon pressure
--
-- investigate the test environment before running the overflow experiment.
--
-- A contaminated baseline weakens the causal comparison.
-- ============================================================================


-- ============================================================================
-- CLEANUP
-- ============================================================================
--
-- Do not automatically DROP the table here.
--
-- Keeping the data allows the experiment harness to compare subsequent
-- workloads against the same relation.
--
-- Cleanup can be performed separately after the complete experiment series.
-- ============================================================================
