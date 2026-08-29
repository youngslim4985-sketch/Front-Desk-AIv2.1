-- ============================================================================
-- slru_cache_comparison.sql
-- ============================================================================
-- Experiment: SLRU cache-size A/B comparison
--
-- Purpose:
--   Measure whether larger PostgreSQL 17+ SLRU caches reduce:
--
--       - SLRU block reads
--       - SLRU cache misses
--       - SLRU-related waits
--       - workload latency
--
-- Tested caches:
--
--       Subtrans
--       MultiXactMember
--       MultiXactOffset
--
-- IMPORTANT:
--   These parameters are server-start settings.
--   Each A/B configuration therefore requires a PostgreSQL restart.
--
-- DO NOT change production configuration as part of this experiment.
-- ============================================================================


-- ============================================================================
-- PART A — CAPTURE SERVER CONFIGURATION
-- ============================================================================

SELECT
    version() AS postgres_version;


SELECT
    name,
    setting,
    unit,
    context,
    source
FROM pg_settings
WHERE name IN (
    'shared_buffers',
    'subtransaction_buffers',
    'transaction_buffers',
    'multixact_member_buffers',
    'multixact_offset_buffers'
)
ORDER BY name;


-- ============================================================================
-- NOTE
-- ============================================================================
--
-- Parameter names must be verified against the PostgreSQL version under test.
--
-- PostgreSQL 17+ is the target for this experiment.
--
-- Do not silently substitute another parameter if a setting is unavailable.
-- Record the actual server version and configuration in the results.
-- ============================================================================


-- ============================================================================
-- PART B — BASELINE SLRU STATISTICS
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
-- PART C — BASELINE WAIT EVENTS
-- ============================================================================

SELECT
    wait_event_type,
    wait_event,
    count(*) AS waiting_sessions
FROM pg_stat_activity
WHERE wait_event_type IN ('LWLock', 'IO')
  AND (
       wait_event LIKE '%SLRU%'
       OR wait_event LIKE '%MultiXact%'
  )
GROUP BY
    wait_event_type,
    wait_event
ORDER BY waiting_sessions DESC;


-- ============================================================================
-- PART D — WORKLOAD MARKER
-- ============================================================================
--
-- Record a timestamp immediately before running the workload.
-- ============================================================================

SELECT
    clock_timestamp() AS workload_start;


-- ============================================================================
-- PART E — WORKLOAD
-- ============================================================================
--
-- Run the SAME workload for every configuration.
--
-- Recommended workload components:
--
--     1. XID-bearing subtransaction generation
--     2. Concurrent MultiXact generation
--     3. Representative application queries
--
-- Do not modify workload intensity between A and B.
--
-- The actual workload runner should be supplied by the corresponding
-- experiment scripts.
-- ============================================================================


SELECT
    clock_timestamp() AS workload_end;


-- ============================================================================
-- PART F — POST-WORKLOAD SLRU STATISTICS
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
-- PART G — INTERVAL HIT RATE
-- ============================================================================
--
-- If baseline values have been recorded separately, calculate:
--
--     hit_delta
--     read_delta
--     hit_percentage
--
-- Example:
-- ============================================================================

-- Replace these constants with recorded baseline values.

WITH current_stats AS (
    SELECT
        name,
        blks_hit,
        blks_read
    FROM pg_stat_slru
    WHERE name IN (
        'Subtrans',
        'MultiXactMember',
        'MultiXactOffset'
    )
)
SELECT
    name,
    blks_hit,
    blks_read,
    round(
        100.0 * blks_hit /
        NULLIF(blks_hit + blks_read, 0),
        2
    ) AS cumulative_hit_pct
FROM current_stats
ORDER BY name;


-- ============================================================================
-- PART H — WAIT EVENT SNAPSHOT
-- ============================================================================

SELECT
    clock_timestamp() AS captured_at,
    wait_event_type,
    wait_event,
    count(*) AS waiting_sessions
FROM pg_stat_activity
WHERE wait_event_type IN ('LWLock', 'IO')
  AND (
       wait_event LIKE '%SLRU%'
       OR wait_event LIKE '%MultiXact%'
  )
GROUP BY
    wait_event_type,
    wait_event
ORDER BY waiting_sessions DESC;


-- ============================================================================
-- PART I — TRANSACTION / SESSION STATE
-- ============================================================================

SELECT
    pid,
    usename,
    application_name,
    state,
    xact_start,
    query_start,
    wait_event_type,
    wait_event,
    now() - xact_start AS transaction_age,
    left(query, 200) AS query
FROM pg_stat_activity
WHERE xact_start IS NOT NULL
ORDER BY xact_start;


-- ============================================================================
-- PART J — RESULTS TO RECORD
-- ============================================================================
--
-- For every configuration record:
--
--     configuration_id
--     PostgreSQL version
--     shared_buffers
--     subtransaction_buffers
--     multixact_member_buffers
--     multixact_offset_buffers
--     workload duration
--
--     Subtrans:
--         blks_hit_delta
--         blks_read_delta
--         blks_written_delta
--
--     MultiXactMember:
--         blks_hit_delta
--         blks_read_delta
--         blks_written_delta
--
--     MultiXactOffset:
--         blks_hit_delta
--         blks_read_delta
--         blks_written_delta
--
--     wait counts
--     query latency
--     throughput
-- ============================================================================


-- ============================================================================
-- A/B CONFIGURATION
-- ============================================================================
--
-- CONFIGURATION A — DEFAULT
--
-- Use the PostgreSQL version's default SLRU settings.
--
--
-- CONFIGURATION B — INCREASED
--
-- Example test point:
--
--     multixact_offset_buffers = 128
--     multixact_member_buffers = 256
--
-- For Subtrans, select an increased value appropriate to the PostgreSQL
-- version and available shared memory.
--
-- DO NOT assume that the example values are optimal.
-- ============================================================================


-- ============================================================================
-- ANALYSIS
-- ============================================================================
--
-- The hypothesis is supported only if increasing the relevant cache produces
-- measurable improvement under the same workload.
--
-- Look for:
--
--     ↓ blks_read
--     ↓ SLRURead waits
--     ↓ MultiXact*Buffer waits
--     ↓ MultiXact*SLRU waits
--     ↓ query latency
--     ↑ throughput
--
-- If cache size increases but latency does not improve:
--
--     cache capacity may not be the bottleneck.
--
-- If reads decrease but latency does not:
--
--     storage/cache misses were reduced, but another bottleneck dominates.
--
-- If waits remain high while reads fall:
--
--     internal synchronization or row-lock contention may be dominant.
--
-- ============================================================================


-- ============================================================================
-- CRITICAL LIMITATION
-- ============================================================================
--
-- Larger SLRU caches DO NOT:
--
--     - increase PGPROC_MAX_CACHED_SUBXIDS
--     - eliminate subtransaction overflow
--     - replicate pg_subtrans
--     - change RUNNING_XACTS semantics
--     - guarantee faster hot-standby activation
--
-- They only change how much SLRU metadata can remain cached.
-- ============================================================================


-- ============================================================================
-- REQUIRED REPLICATION
-- ============================================================================
--
-- Run each configuration at least 5 times:
--
--     A1 A2 A3 A4 A5
--     B1 B2 B3 B4 B5
--
-- Report:
--
--     median
--     p95
--     minimum
--     maximum
--
-- for latency and SLRU activity.
--
-- ============================================================================


-- ============================================================================
-- FINAL CONCLUSION TEMPLATE
-- ============================================================================
--
-- Configuration B reduced MultiXactMember blks_read by ______%.
--
-- Configuration B reduced MultiXactOffset blks_read by ______%.
--
-- Configuration B reduced Subtrans blks_read by ______%.
--
-- SLRU-related waits changed by ______%.
--
-- Query latency changed by ______%.
--
-- Therefore:
--
--     [ ] cache pressure was demonstrated
--     [ ] cache pressure was not demonstrated
--     [ ] results were inconclusive
--
-- ============================================================================
