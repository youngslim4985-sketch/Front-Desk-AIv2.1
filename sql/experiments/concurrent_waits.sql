-- ============================================================================
-- concurrent_waits.sql
-- ============================================================================
-- Experiment: Concurrent SLRU / MultiXact wait observation
--
-- Purpose:
--   Capture live PostgreSQL wait states while concurrent workloads generate
--   Subtrans and MultiXact activity.
--
-- Target wait classes:
--
--   IO:SLRURead
--   LWLock:MultiXactMemberBuffer
--   LWLock:MultiXactMemberSLRU
--   LWLock:MultiXactOffsetBuffer
--   LWLock:MultiXactOffsetSLRU
--   Subtrans-related LWLocks
--
-- Run from a dedicated monitoring session while worker sessions are active.
--
-- DO NOT run against production infrastructure.
-- ============================================================================


-- ============================================================================
-- 1. Environment
-- ============================================================================

SELECT
    clock_timestamp() AS captured_at,
    version() AS postgres_version,
    current_database() AS database_name,
    current_user AS database_user,
    pg_is_in_recovery() AS in_recovery;


-- ============================================================================
-- 2. Current SLRU statistics
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
-- 3. Current SLRU-related waits
-- ============================================================================

SELECT
    clock_timestamp() AS captured_at,
    pid,
    usename,
    application_name,
    state,
    wait_event_type,
    wait_event,
    now() - query_start AS query_age,
    left(query, 200) AS query
FROM pg_stat_activity
WHERE
    wait_event_type IN ('LWLock', 'IO')
    AND (
        wait_event LIKE '%SLRU%'
        OR wait_event LIKE '%MultiXact%'
        OR wait_event LIKE '%Subtrans%'
    )
ORDER BY query_start;


-- ============================================================================
-- 4. Aggregate waits
-- ============================================================================

SELECT
    clock_timestamp() AS captured_at,
    wait_event_type,
    wait_event,
    count(*) AS waiting_sessions
FROM pg_stat_activity
WHERE
    wait_event_type IN ('LWLock', 'IO')
    AND (
        wait_event LIKE '%SLRU%'
        OR wait_event LIKE '%MultiXact%'
        OR wait_event LIKE '%Subtrans%'
    )
GROUP BY
    wait_event_type,
    wait_event
ORDER BY
    waiting_sessions DESC,
    wait_event;


-- ============================================================================
-- 5. Specifically identify SLRURead waits
-- ============================================================================

SELECT
    clock_timestamp() AS captured_at,
    pid,
    usename,
    application_name,
    state,
    wait_event_type,
    wait_event,
    now() - query_start AS query_age,
    left(query, 200) AS query
FROM pg_stat_activity
WHERE
    wait_event_type = 'IO'
    AND wait_event = 'SLRURead'
ORDER BY query_start;


-- ============================================================================
-- 6. Specifically identify MultiXact waits
-- ============================================================================

SELECT
    clock_timestamp() AS captured_at,
    pid,
    usename,
    application_name,
    state,
    wait_event_type,
    wait_event,
    now() - query_start AS query_age,
    left(query, 200) AS query
FROM pg_stat_activity
WHERE
    wait_event_type = 'LWLock'
    AND wait_event LIKE 'MultiXact%'
ORDER BY query_start;


-- ============================================================================
-- 7. Transaction age
-- ============================================================================

SELECT
    pid,
    usename,
    application_name,
    state,
    xact_start,
    now() - xact_start AS transaction_age,
    backend_xid,
    backend_xmin,
    wait_event_type,
    wait_event,
    left(query, 200) AS query
FROM pg_stat_activity
WHERE xact_start IS NOT NULL
ORDER BY xact_start;


-- ============================================================================
-- 8. Long-running transactions
-- ============================================================================

SELECT
    pid,
    usename,
    application_name,
    now() - xact_start AS transaction_age,
    state,
    wait_event_type,
    wait_event,
    left(query, 200) AS query
FROM pg_stat_activity
WHERE
    xact_start IS NOT NULL
    AND now() - xact_start > interval '5 seconds'
ORDER BY xact_start;


-- ============================================================================
-- 9. MultiXact-related lock activity
-- ============================================================================

SELECT
    locktype,
    mode,
    granted,
    count(*) AS lock_count
FROM pg_locks
GROUP BY
    locktype,
    mode,
    granted
ORDER BY
    locktype,
    mode,
    granted;


-- ============================================================================
-- 10. Capture a timestamped SLRU snapshot
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
-- 11. Wait-state classification
-- ============================================================================
--
-- Interpretation:
--
--   IO:SLRURead
--       Backend is waiting for an SLRU page read.
--
--   MultiXact*Buffer
--       Backend is waiting on a MultiXact SLRU buffer operation.
--
--   MultiXact*SLRU
--       Backend is waiting for synchronization around the MultiXact SLRU.
--
--   Subtrans-related waits
--       Backend is interacting with the pg_subtrans SLRU machinery.
--
-- IMPORTANT:
--
-- A wait event by itself does not prove cache exhaustion.
-- Correlate it with pg_stat_slru deltas and workload latency.
-- ============================================================================


-- ============================================================================
-- 12. Monitoring query
-- ============================================================================
--
-- Repeat this query at a fixed interval, for example every 1 second, from
-- an external runner or psql \watch.
-- ============================================================================

SELECT
    clock_timestamp() AS captured_at,
    wait_event_type,
    wait_event,
    count(*) AS sessions
FROM pg_stat_activity
WHERE
    wait_event IS NOT NULL
    AND (
        wait_event LIKE '%SLRU%'
        OR wait_event LIKE '%MultiXact%'
        OR wait_event LIKE '%Subtrans%'
    )
GROUP BY
    wait_event_type,
    wait_event
ORDER BY sessions DESC;


-- ============================================================================
-- 13. Suggested psql monitoring command
-- ============================================================================
--
-- From psql:
--
--     \watch 1
--
-- Run the aggregate wait query above with \watch while the worker workload
-- executes in other sessions.
--
-- ============================================================================


-- ============================================================================
-- 14. Evidence to record
-- ============================================================================
--
-- For each observation interval record:
--
--     timestamp
--     active worker count
--     SLRU name
--     blks_hit
--     blks_read
--     blks_written
--     wait_event
--     waiting_sessions
--     oldest transaction age
--     workload latency
--
-- ============================================================================


-- ============================================================================
-- 15. Analysis rule
-- ============================================================================
--
-- Strong cache-pressure evidence:
--
--     blks_read increases
--          +
--     SLRURead appears
--          +
--     latency increases
--
--
-- Strong synchronization-contention evidence:
--
--     MultiXact*SLRU / MultiXact*Buffer waits increase
--          +
--     blks_read does NOT increase proportionally
--
--
-- Mixed condition:
--
--     blks_read increases
--          +
--     SLRU waits increase
--          +
--     MultiXact waits increase
--
--
-- This indicates both cache/I/O pressure and internal synchronization may
-- be contributing.
-- ============================================================================


-- ============================================================================
-- 16. Negative-control comparison
-- ============================================================================
--
-- Run the same monitoring procedure during:
--
--     A. MultiXact-heavy workload
--     B. Distributed-row control workload
--     C. Subtransaction-overflow workload
--     D. No-stress baseline
--
-- Compare interval deltas rather than cumulative totals.
-- ============================================================================


-- ============================================================================
-- END
-- ============================================================================
