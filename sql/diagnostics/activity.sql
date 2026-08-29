-- ============================================================================
-- activity.sql
-- ============================================================================
-- Purpose:
--   Capture backend activity and transaction characteristics that may
--   correlate with subtransaction, MultiXact, SLRU, or snapshot behavior.
--
-- Diagnostic only. No writes or configuration changes.
-- ============================================================================


-- ============================================================================
-- 1. Current backend activity
-- ============================================================================

SELECT
    pid,
    usename,
    datname,
    application_name,
    client_addr,
    state,
    backend_type,
    xact_start,
    query_start,
    state_change,
    now() - xact_start AS xact_age,
    now() - query_start AS query_age,
    backend_xid,
    backend_xmin,
    wait_event_type,
    wait_event,
    left(query, 200) AS query
FROM pg_stat_activity
ORDER BY
    xact_start ASC NULLS LAST,
    query_start ASC NULLS LAST;


-- ============================================================================
-- 2. Active queries only
-- ============================================================================

SELECT
    pid,
    usename,
    datname,
    application_name,
    state,
    xact_start,
    query_start,
    now() - query_start AS query_age,
    backend_xid,
    backend_xmin,
    wait_event_type,
    wait_event,
    left(query, 250) AS query
FROM pg_stat_activity
WHERE state = 'active'
ORDER BY query_start;


-- ============================================================================
-- 3. Long-running transactions
-- ============================================================================

SELECT
    pid,
    usename,
    datname,
    application_name,
    state,
    xact_start,
    now() - xact_start AS xact_age,
    backend_xid,
    backend_xmin,
    wait_event_type,
    wait_event,
    left(query, 250) AS query
FROM pg_stat_activity
WHERE
    xact_start IS NOT NULL
    AND now() - xact_start >= interval '1 minute'
ORDER BY xact_start;


-- ============================================================================
-- 4. Idle-in-transaction sessions
-- ============================================================================

SELECT
    pid,
    usename,
    datname,
    application_name,
    state,
    xact_start,
    now() - xact_start AS xact_age,
    state_change,
    now() - state_change AS state_age,
    backend_xid,
    backend_xmin,
    wait_event_type,
    wait_event,
    left(query, 250) AS last_query
FROM pg_stat_activity
WHERE state = 'idle in transaction'
ORDER BY xact_start;


-- ============================================================================
-- 5. Backend transaction identifiers
-- ============================================================================

SELECT
    pid,
    usename,
    application_name,
    backend_xid,
    backend_xmin,
    xact_start,
    now() - xact_start AS xact_age,
    state
FROM pg_stat_activity
WHERE
    backend_xid IS NOT NULL
    OR backend_xmin IS NOT NULL
ORDER BY
    backend_xmin ASC NULLS LAST;


-- ============================================================================
-- 6. Subtransaction state by backend
-- ============================================================================

SELECT
    a.pid,
    a.usename,
    a.application_name,
    a.state,
    a.xact_start,
    now() - a.xact_start AS xact_age,
    a.backend_xid,
    a.backend_xmin,
    s.subxact_count,
    s.subxact_overflow,
    a.wait_event_type,
    a.wait_event,
    left(a.query, 200) AS query
FROM pg_stat_activity AS a
CROSS JOIN LATERAL pg_stat_get_backend_subxact(a.pid) AS s
WHERE a.xact_start IS NOT NULL
ORDER BY
    s.subxact_overflow DESC,
    s.subxact_count DESC;


-- ============================================================================
-- 7. Aggregate backend states
-- ============================================================================

SELECT
    state,
    count(*) AS sessions
FROM pg_stat_activity
GROUP BY state
ORDER BY sessions DESC;


-- ============================================================================
-- 8. Aggregate wait states
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
-- 9. SLRU-related activity
-- ============================================================================

SELECT
    pid,
    usename,
    application_name,
    state,
    xact_start,
    now() - xact_start AS xact_age,
    wait_event_type,
    wait_event,
    left(query, 200) AS query
FROM pg_stat_activity
WHERE
    wait_event = 'SLRURead'
    OR wait_event ILIKE '%Subtrans%'
    OR wait_event ILIKE '%MultiXact%'
ORDER BY xact_start;


-- ============================================================================
-- 10. Lock-related activity
-- ============================================================================
--
-- Control query: helps distinguish SLRU pressure from ordinary lock
-- contention.
-- ============================================================================

SELECT
    pid,
    usename,
    application_name,
    state,
    xact_start,
    now() - xact_start AS xact_age,
    wait_event_type,
    wait_event,
    left(query, 200) AS query
FROM pg_stat_activity
WHERE wait_event_type = 'Lock'
ORDER BY xact_start;


-- ============================================================================
-- 11. Blocking relationships
-- ============================================================================

SELECT
    blocked.pid AS blocked_pid,
    blocked.application_name AS blocked_application,
    blocked.state AS blocked_state,
    blocked.wait_event_type AS blocked_wait_type,
    blocked.wait_event AS blocked_wait_event,
    blocker.pid AS blocker_pid,
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
-- 12. Connection count by application
-- ============================================================================

SELECT
    application_name,
    usename,
    state,
    count(*) AS connections
FROM pg_stat_activity
GROUP BY
    application_name,
    usename,
    state
ORDER BY connections DESC;


-- ============================================================================
-- 13. Database activity summary
-- ============================================================================

SELECT
    datname,
    numbackends,
    xact_commit,
    xact_rollback,
    blks_read,
    blks_hit,
    tup_returned,
    tup_fetched,
    tup_inserted,
    tup_updated,
    tup_deleted,
    stats_reset
FROM pg_stat_database
WHERE datname IS NOT NULL
ORDER BY numbackends DESC;


-- ============================================================================
-- 14. Database-level cache ratio
-- ============================================================================
--
-- This is a general buffer-cache signal, not an SLRU metric.
-- It is included as contextual evidence only.
-- ============================================================================

SELECT
    datname,
    blks_hit,
    blks_read,
    round(
        100.0 * blks_hit /
        NULLIF(blks_hit + blks_read, 0),
        2
    ) AS buffer_hit_pct
FROM pg_stat_database
WHERE datname IS NOT NULL
ORDER BY datname;


-- ============================================================================
-- 15. Capture timestamp
-- ============================================================================

SELECT clock_timestamp() AS captured_at;


-- ============================================================================
-- Interpretation
-- ============================================================================
--
-- This file provides workload context for the other diagnostic files.
--
-- IMPORTANT:
--
-- A long-running transaction does not automatically imply subtransaction
-- overflow.
--
-- A high connection count does not automatically imply SLRU contention.
--
-- A wait event does not automatically establish causation.
--
-- Use this data together with:
--
--   diagnostics/slru.sql
--   diagnostics/subtransactions.sql
--   diagnostics/snapshots.sql
--   diagnostics/waits.sql
--   diagnostics/multixact.sql
--   diagnostics/replication.sql
--
-- The empirical experiment should correlate these observations against
-- controlled workload phases and negative controls.
-- ============================================================================
