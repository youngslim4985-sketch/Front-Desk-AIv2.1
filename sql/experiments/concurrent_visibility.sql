-- ============================================================================
-- concurrent_visibility.sql
-- ============================================================================
-- Purpose:
--   Measure concurrent MVCC visibility-check behavior while another backend
--   holds a top-level transaction containing >64 XID-bearing subtransactions.
--
-- This experiment separates:
--
--   subtransaction creation
--              from
--   visibility-check cost in another session.
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
-- 2. Prepare the visibility workload
-- ============================================================================

DROP TABLE IF EXISTS concurrent_visibility_workload;

CREATE TABLE concurrent_visibility_workload (
    id bigint PRIMARY KEY,
    payload text NOT NULL
);

INSERT INTO concurrent_visibility_workload (id, payload)
SELECT
    g,
    md5(g::text)
FROM generate_series(1, 10000) AS g;


-- ============================================================================
-- 3. Capture initial Subtrans statistics
-- ============================================================================

SELECT
    name,
    blks_hit,
    blks_read,
    blks_written,
    stats_reset
FROM pg_stat_slru
WHERE name = 'Subtrans';


-- ============================================================================
-- 4. Baseline visibility query
-- ============================================================================
--
-- Run this section BEFORE starting the overflow transaction in another
-- session.
--
-- Repeat the query enough times to establish a latency distribution.
-- Do not rely on a single execution.
-- ============================================================================

EXPLAIN (ANALYZE, BUFFERS, TIMING)
SELECT count(*)
FROM concurrent_visibility_workload
WHERE id BETWEEN 1 AND 10000;


-- ============================================================================
-- 5. OVERFLOW SESSION
-- ============================================================================
--
-- Run the following block from SESSION A.
--
-- Keep the transaction open after the subtransactions have been generated.
-- SESSION B will execute the visibility workload while SESSION A remains open.
-- ============================================================================

-- BEGIN;

-- DO $$
-- DECLARE
--     i integer;
-- BEGIN
--     FOR i IN 1..256 LOOP
--         BEGIN
--             INSERT INTO concurrent_visibility_workload (id, payload)
--             VALUES (
--                 100000 + i,
--                 md5(i::text)
--             );
--         EXCEPTION
--             WHEN unique_violation THEN
--                 NULL;
--         END;
--     END LOOP;
-- END
-- $$;


-- ============================================================================
-- 6. Confirm overflow in SESSION A
-- ============================================================================

-- SELECT
--     a.pid,
--     a.xact_start,
--     now() - a.xact_start AS transaction_age,
--     s.subxact_count,
--     s.subxact_overflow,
--     a.wait_event_type,
--     a.wait_event
-- FROM pg_stat_activity AS a
-- CROSS JOIN LATERAL pg_stat_get_backend_subxact(a.pid) AS s
-- WHERE a.pid = pg_backend_pid();


-- ============================================================================
-- 7. CONCURRENT VISIBILITY SESSION
-- ============================================================================
--
-- Run this section from SESSION B while SESSION A remains open.
--
-- Repeat the query and record execution latency.
-- ============================================================================

EXPLAIN (ANALYZE, BUFFERS, TIMING)
SELECT count(*)
FROM concurrent_visibility_workload
WHERE id BETWEEN 1 AND 10000;


-- ============================================================================
-- 8. Monitor Subtrans activity during the test
-- ============================================================================

SELECT
    name,
    blks_hit,
    blks_read,
    blks_written,
    stats_reset
FROM pg_stat_slru
WHERE name = 'Subtrans';


-- ============================================================================
-- 9. Monitor SLRU I/O waits
-- ============================================================================

SELECT
    pid,
    usename,
    application_name,
    state,
    query_start,
    wait_event_type,
    wait_event,
    left(query, 160) AS query
FROM pg_stat_activity
WHERE wait_event_type = 'IO'
  AND wait_event = 'SLRURead'
ORDER BY query_start;


-- ============================================================================
-- 10. Monitor Subtrans LWLock waits
-- ============================================================================

SELECT
    pid,
    usename,
    application_name,
    state,
    query_start,
    wait_event_type,
    wait_event,
    left(query, 160) AS query
FROM pg_stat_activity
WHERE wait_event_type = 'LWLock'
  AND wait_event IN (
      'SubtransSLRU',
      'SubtransControlLock'
  )
ORDER BY query_start;


-- ============================================================================
-- 11. Capture concurrent activity
-- ============================================================================

SELECT
    pid,
    usename,
    application_name,
    state,
    xact_start,
    query_start,
    now() - query_start AS query_age,
    wait_event_type,
    wait_event,
    left(query, 160) AS query
FROM pg_stat_activity
WHERE state <> 'idle'
ORDER BY query_start;


-- ============================================================================
-- 12. Repeat visibility test
-- ============================================================================
--
-- Execute multiple times rather than relying on one sample.
--
-- Record:
--
--   execution_time
--   shared_blks_hit
--   shared_blks_read
--   Subtrans blks_read delta
--   SLRURead waits
--   Subtrans LWLock waits
--
-- Compare against the baseline collected before overflow.
-- ============================================================================

EXPLAIN (ANALYZE, BUFFERS, TIMING)
SELECT count(*)
FROM concurrent_visibility_workload
WHERE id BETWEEN 1 AND 10000;


-- ============================================================================
-- 13. End overflow transaction
-- ============================================================================
--
-- Run from SESSION A after SESSION B finishes its measurements.
-- ============================================================================

-- COMMIT;


-- ============================================================================
-- 14. Post-transaction Subtrans statistics
-- ============================================================================

SELECT
    name,
    blks_hit,
    blks_read,
    blks_written,
    stats_reset
FROM pg_stat_slru
WHERE name = 'Subtrans';


-- ============================================================================
-- Expected result
-- ============================================================================
--
-- The experiment is successful only if measurements allow comparison between:
--
--   BASELINE
--       no overflowing transaction
--
--   OVERFLOW
--       another backend has >64 relevant subtransactions
--
--   POST-COMMIT
--       overflowing transaction has ended
--
-- Do NOT assume that an overflow automatically produces a performance
-- regression.
--
-- The finding must be based on measured:
--
--   - latency
--   - throughput
--   - Subtrans SLRU reads
--   - SLRU I/O waits
--   - LWLock waits
--
-- ============================================================================
-- Negative-control requirement
-- ============================================================================
--
-- Repeat the same concurrent workload while SESSION A performs an equivalent
-- amount of work WITHOUT creating subtransactions.
--
-- This is necessary to distinguish:
--
--   transaction duration / general database load
--
-- from:
--
--   subtransaction-cache overflow.
--
-- ============================================================================
-- Research boundary
-- ============================================================================
--
-- This experiment establishes whether overflow can impose measurable
-- concurrent visibility overhead.
--
-- It does NOT establish:
--
--   subtransaction overflow -> replica unavailability
--
-- and it does NOT establish:
--
--   width/alignment processing -> subtransaction overflow.
--
-- Those require separate experiments.
-- ============================================================================
