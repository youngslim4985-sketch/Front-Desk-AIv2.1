-- ============================================================================
-- negative_control.sql
-- ============================================================================
-- Purpose:
--   Provide control workloads for the subtransaction, visibility, MultiXact,
--   and replica experiments.
--
-- Core principle:
--
--   CONTROL workload
--       same approximate amount of work
--       same transaction duration where practical
--       NO subtransaction-cache overflow
--
--   TEST workload
--       same general workload
--       >64 XID-bearing subtransactions
--
-- Only differences supported by measurement should be attributed to overflow.
--
-- Run only against authorized test infrastructure.
-- ============================================================================


-- ============================================================================
-- 1. Experiment metadata
-- ============================================================================

SELECT
    current_database() AS database_name,
    current_user AS database_user,
    version() AS postgres_version,
    now() AS experiment_start;


-- ============================================================================
-- 2. Control table
-- ============================================================================

DROP TABLE IF EXISTS negative_control_workload;

CREATE TABLE negative_control_workload (
    id bigint PRIMARY KEY,
    payload text NOT NULL
);


-- ============================================================================
-- 3. Populate equivalent data volume
-- ============================================================================

INSERT INTO negative_control_workload (id, payload)
SELECT
    g,
    md5(g::text)
FROM generate_series(1, 10000) AS g;


-- ============================================================================
-- 4. Baseline SLRU measurements
-- ============================================================================

SELECT
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
-- 5. CONTROL A — single transaction, no subtransactions
-- ============================================================================
--
-- This represents ordinary transactional work.
--
-- The transaction remains open briefly so its duration can be matched
-- approximately against the overflow test.
-- ============================================================================

BEGIN;

INSERT INTO negative_control_workload (id, payload)
SELECT
    100000 + g,
    md5(g::text)
FROM generate_series(1, 256) AS g
ON CONFLICT (id) DO UPDATE
SET payload = EXCLUDED.payload;

-- Keep transaction open for controlled observation if required.
--
-- SELECT pg_sleep(5);

COMMIT;


-- ============================================================================
-- 6. CONTROL B — comparable work without EXCEPTION subtransactions
-- ============================================================================
--
-- Same broad amount of row processing, but performed set-wise.
-- ============================================================================

BEGIN;

INSERT INTO negative_control_workload (id, payload)
SELECT
    200000 + g,
    md5(('control-' || g)::text)
FROM generate_series(1, 256) AS g
ON CONFLICT (id) DO UPDATE
SET payload = EXCLUDED.payload;

COMMIT;


-- ============================================================================
-- 7. CONTROL C — long-running transaction without subxact storm
-- ============================================================================
--
-- Use this control when testing concurrent visibility or standby behavior.
-- ============================================================================

BEGIN;

INSERT INTO negative_control_workload (id, payload)
VALUES (
    300000,
    md5(clock_timestamp()::text)
);

-- Keep the top-level transaction open while the concurrent workload runs.
--
-- SELECT pg_sleep(30);

-- COMMIT;


-- ============================================================================
-- 8. Verify control backend state
-- ============================================================================

SELECT
    a.pid,
    a.usename,
    a.application_name,
    a.state,
    a.xact_start,
    now() - a.xact_start AS transaction_age,
    s.subxact_count,
    s.subxact_overflow,
    a.wait_event_type,
    a.wait_event
FROM pg_stat_activity AS a
CROSS JOIN LATERAL pg_stat_get_backend_subxact(a.pid) AS s
WHERE a.xact_start IS NOT NULL
ORDER BY a.xact_start;


-- ============================================================================
-- 9. Concurrent visibility control
-- ============================================================================
--
-- Execute while CONTROL C remains open.
--
-- Compare execution time against:
--
--     concurrent_visibility.sql
--
-- ============================================================================

EXPLAIN (ANALYZE, BUFFERS, TIMING)
SELECT count(*)
FROM negative_control_workload
WHERE id BETWEEN 1 AND 10000;


-- ============================================================================
-- 10. Capture Subtrans statistics
-- ============================================================================

SELECT
    name,
    blks_hit,
    blks_read,
    blks_written
FROM pg_stat_slru
WHERE name = 'Subtrans';


-- ============================================================================
-- 11. Capture MultiXact statistics
-- ============================================================================

SELECT
    name,
    blks_hit,
    blks_read,
    blks_written
FROM pg_stat_slru
WHERE name IN (
    'MultiXactMember',
    'MultiXactOffset'
)
ORDER BY name;


-- ============================================================================
-- 12. Capture relevant waits
-- ============================================================================

SELECT
    wait_event_type,
    wait_event,
    count(*) AS sessions
FROM pg_stat_activity
WHERE wait_event_type IS NOT NULL
GROUP BY wait_event_type, wait_event
ORDER BY sessions DESC;


-- ============================================================================
-- 13. Control requirements
-- ============================================================================
--
-- The control should match the test as closely as possible in:
--
--     rows processed
--     transaction duration
--     WAL generated
--     number of concurrent sessions
--     query shape
--     database state
--
-- while avoiding:
--
--     >64 XID-bearing subtransactions
--
-- ============================================================================
-- 14. Required comparison matrix
-- ============================================================================
--
--                  CONTROL       OVERFLOW TEST
-- ------------------------------------------------
-- rows processed       X               X
-- transaction time     X               X
-- WAL volume           X               X
-- concurrency          X               X
-- Subtrans reads       ?               ?
-- SLRU waits           ?               ?
-- query latency        ?               ?
-- standby readiness    ?               ?
--
-- The values marked "?" must come from measurements.
--
-- ============================================================================
-- 15. Interpretation
-- ============================================================================
--
-- If TEST >> CONTROL for Subtrans reads/waits and latency:
--
--     evidence supports an overflow-specific performance effect.
--
-- If TEST ~= CONTROL:
--
--     overflow-specific impact was not demonstrated under this workload.
--
-- If both are slow but TEST has substantially more WAL:
--
--     further normalization is required before assigning causality.
--
-- ============================================================================
-- 16. Important limitation
-- ============================================================================
--
-- A negative control does not prove that no effect exists.
--
-- It only establishes whether the effect is distinguishable from the chosen
-- baseline under the tested workload and measurement conditions.
-- ============================================================================
