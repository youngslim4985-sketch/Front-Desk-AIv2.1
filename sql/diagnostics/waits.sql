-- ============================================================================
-- waits.sql
-- ============================================================================
-- Purpose:
--   Capture PostgreSQL wait events relevant to:
--     - Subtransaction / pg_subtrans pressure
--     - MultiXact pressure
--     - SLRU I/O
--     - Lock contention
--     - General concurrency
--
-- Diagnostic only. No writes or configuration changes.
-- ============================================================================


-- ============================================================================
-- 1. All currently waiting backends
-- ============================================================================

SELECT
    pid,
    usename,
    application_name,
    client_addr,
    state,
    wait_event_type,
    wait_event,
    xact_start,
    query_start,
    now() - query_start AS query_age,
    left(query, 200) AS query
FROM pg_stat_activity
WHERE wait_event IS NOT NULL
ORDER BY
    wait_event_type,
    wait_event,
    query_start;


-- ============================================================================
-- 2. Aggregate wait-event counts
-- ============================================================================

SELECT
    wait_event_type,
    wait_event,
    count(*) AS waiting_sessions
FROM pg_stat_activity
WHERE wait_event IS NOT NULL
GROUP BY
    wait_event_type,
    wait_event
ORDER BY
    waiting_sessions DESC,
    wait_event_type,
    wait_event;


-- ============================================================================
-- 3. SLRU-related waits
-- ============================================================================

SELECT
    pid,
    usename,
    application_name,
    state,
    wait_event_type,
    wait_event,
    xact_start,
    query_start,
    now() - query_start AS query_age,
    left(query, 200) AS query
FROM pg_stat_activity
WHERE
    wait_event_type IN ('IO', 'LWLock')
    AND (
        wait_event = 'SLRURead'
        OR wait_event ILIKE '%Subtrans%'
        OR wait_event ILIKE '%MultiXact%'
    )
ORDER BY query_start;


-- ============================================================================
-- 4. Aggregate SLRU waits
-- ============================================================================

SELECT
    wait_event_type,
    wait_event,
    count(*) AS waiting_sessions
FROM pg_stat_activity
WHERE
    wait_event_type IN ('IO', 'LWLock')
    AND (
        wait_event = 'SLRURead'
        OR wait_event ILIKE '%Subtrans%'
        OR wait_event ILIKE '%MultiXact%'
    )
GROUP BY
    wait_event_type,
    wait_event
ORDER BY
    waiting_sessions DESC;


-- ============================================================================
-- 5. Subtransaction-specific waits
-- ============================================================================

SELECT
    pid,
    usename,
    application_name,
    state,
    wait_event_type,
    wait_event,
    xact_start,
    now() - xact_start AS xact_age,
    backend_xid,
    backend_xmin,
    left(query, 200) AS query
FROM pg_stat_activity
WHERE
    wait_event ILIKE '%Subtrans%'
ORDER BY
    xact_start;


-- ============================================================================
-- 6. MultiXact-specific waits
-- ============================================================================

SELECT
    pid,
    usename,
    application_name,
    state,
    wait_event_type,
    wait_event,
    xact_start,
    now() - xact_start AS xact_age,
    backend_xid,
    backend_xmin,
    left(query, 200) AS query
FROM pg_stat_activity
WHERE
    wait_event ILIKE '%MultiXact%'
ORDER BY
    xact_start;


-- ============================================================================
-- 7. SLRU I/O waits
-- ============================================================================

SELECT
    pid,
    usename,
    application_name,
    state,
    wait_event_type,
    wait_event,
    query_start,
    now() - query_start AS query_age,
    left(query, 200) AS query
FROM pg_stat_activity
WHERE
    wait_event_type = 'IO'
    AND wait_event = 'SLRURead'
ORDER BY query_start;


-- ============================================================================
-- 8. Lock waits
-- ============================================================================
--
-- Used as a control so row/table-lock contention is not incorrectly
-- attributed to SLRU contention.
-- ============================================================================

SELECT
    pid,
    usename,
    application_name,
    state,
    wait_event_type,
    wait_event,
    xact_start,
    query_start,
    now() - query_start AS query_age,
    left(query, 200) AS query
FROM pg_stat_activity
WHERE
    wait_event_type = 'Lock'
ORDER BY query_start;


-- ============================================================================
-- 9. Aggregate lock waits
-- ============================================================================

SELECT
    wait_event_type,
    wait_event,
    count(*) AS waiting_sessions
FROM pg_stat_activity
WHERE wait_event_type = 'Lock'
GROUP BY
    wait_event_type,
    wait_event
ORDER BY waiting_sessions DESC;


-- ============================================================================
-- 10. Blocking relationships
-- ============================================================================

SELECT
    blocked.pid AS blocked_pid,
    blocked.usename AS blocked_user,
    blocked.application_name AS blocked_application,
    blocked.wait_event_type AS blocked_wait_type,
    blocked.wait_event AS blocked_wait_event,
    blocker.pid AS blocker_pid,
    blocker.usename AS blocker_user,
    blocker.application_name AS blocker_application,
    blocker.state AS blocker_state,
    blocker.xact_start AS blocker_xact_start,
    now() - blocker.xact_start AS blocker_xact_age,
    left(blocked.query, 160) AS blocked_query,
    left(blocker.query, 160) AS blocker_query
FROM pg_stat_activity AS blocked
CROSS JOIN LATERAL unnest(
    pg_blocking_pids(blocked.pid)
) AS blocking_pid
JOIN pg_stat_activity AS blocker
    ON blocker.pid = blocking_pid
ORDER BY blocker.xact_start;


-- ============================================================================
-- 11. Long-running active transactions
-- ============================================================================

SELECT
    pid,
    usename,
    application_name,
    state,
    xact_start,
    now() - xact_start AS xact_age,
    backend_xid,
    backend_xmin,
    wait_event_type,
    wait_event,
    left(query, 200) AS query
FROM pg_stat_activity
WHERE
    xact_start IS NOT NULL
    AND now() - xact_start > interval '1 minute'
ORDER BY xact_start;


-- ============================================================================
-- 12. Idle-in-transaction sessions
-- ============================================================================
--
-- These can retain snapshots and locks longer than intended.
-- ============================================================================

SELECT
    pid,
    usename,
    application_name,
    xact_start,
    now() - xact_start AS xact_age,
    state_change,
    now() - state_change AS state_age,
    backend_xid,
    backend_xmin,
    wait_event_type,
    wait_event,
    left(query, 200) AS last_query
FROM pg_stat_activity
WHERE state = 'idle in transaction'
ORDER BY xact_start;


-- ============================================================================
-- 13. Waits correlated with transaction age
-- ============================================================================

SELECT
    pid,
    usename,
    application_name,
    now() - xact_start AS xact_age,
    backend_xid,
    backend_xmin,
    wait_event_type,
    wait_event,
    left(query, 200) AS query
FROM pg_stat_activity
WHERE
    xact_start IS NOT NULL
    AND wait_event IS NOT NULL
ORDER BY
    xact_age DESC;


-- ============================================================================
-- 14. Current SLRU statistics
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
-- 15. Subtransaction cache state
-- ============================================================================

SELECT
    a.pid,
    a.usename,
    a.application_name,
    a.state,
    a.xact_start,
    now() - a.xact_start AS xact_age,
    s.subxact_count,
    s.subxact_overflow,
    a.backend_xid,
    a.backend_xmin,
    a.wait_event_type,
    a.wait_event
FROM pg_stat_activity AS a
CROSS JOIN LATERAL pg_stat_get_backend_subxact(a.pid) AS s
WHERE
    a.xact_start IS NOT NULL
ORDER BY
    s.subxact_overflow DESC,
    s.subxact_count DESC;


-- ============================================================================
-- 16. Diagnostic interpretation
-- ============================================================================
--
-- IMPORTANT:
--
-- IO:SLRURead
--   Indicates a backend is currently waiting for SLRU page I/O.
--
-- LWLock-related Subtrans/MultiXact waits
--   Indicate synchronization contention associated with those structures.
--
-- pg_stat_slru.blks_read
--   Is cumulative SLRU read activity and should be measured using interval
--   deltas for incident analysis.
--
-- A wait event by itself does NOT establish causation.
--
-- Strong evidence requires correlation between:
--
--   workload
--       |
--       +--> subtransaction / MultiXact generation
--       |
--       +--> SLRU statistics
--       |
--       +--> wait-event changes
--       |
--       +--> query latency / throughput
--
-- and, for the standby experiment:
--
--   primary overflow
--       |
--       +--> WAL / RUNNING_XACTS state
--       |
--       +--> standby recovery state
--       |
--       +--> hot-standby read availability
--
-- ============================================================================

