-- ============================================================================
-- multixact.sql
-- ============================================================================
-- Purpose:
--   Diagnose MultiXact generation, MultiXact SLRU activity, and related
--   contention.
--
-- Diagnostic only. No writes or configuration changes.
-- ============================================================================


-- ============================================================================
-- 1. Current MultiXact age
-- ============================================================================

SELECT
    datname,
    age(datminmxid) AS multixact_age,
    datminmxid
FROM pg_database
ORDER BY multixact_age DESC;


-- ============================================================================
-- 2. Tables with oldest MultiXact horizons
-- ============================================================================

SELECT
    n.nspname AS schema_name,
    c.relname AS table_name,
    age(c.relminmxid) AS rel_multixact_age,
    c.relminmxid
FROM pg_class AS c
JOIN pg_namespace AS n
    ON n.oid = c.relnamespace
WHERE
    c.relkind IN ('r', 'm')
    AND c.relminmxid IS NOT NULL
ORDER BY rel_multixact_age DESC;


-- ============================================================================
-- 3. Current MultiXact SLRU statistics
-- ============================================================================

SELECT
    name,
    blks_hit,
    blks_read,
    blks_written,
    stats_reset
FROM pg_stat_slru
WHERE name IN (
    'MultiXactMember',
    'MultiXactOffset'
)
ORDER BY name;


-- ============================================================================
-- 4. MultiXact SLRU hit ratios
-- ============================================================================

SELECT
    name,
    blks_hit,
    blks_read,
    round(
        100.0 * blks_hit /
        NULLIF(blks_hit + blks_read, 0),
        2
    ) AS hit_pct
FROM pg_stat_slru
WHERE name IN (
    'MultiXactMember',
    'MultiXactOffset'
)
ORDER BY name;


-- ============================================================================
-- 5. MultiXact wait events
-- ============================================================================

SELECT
    wait_event_type,
    wait_event,
    count(*) AS waiting_sessions
FROM pg_stat_activity
WHERE
    wait_event ILIKE '%MultiXact%'
GROUP BY
    wait_event_type,
    wait_event
ORDER BY waiting_sessions DESC;


-- ============================================================================
-- 6. Current MultiXact waiters
-- ============================================================================

SELECT
    pid,
    usename,
    datname,
    application_name,
    state,
    xact_start,
    now() - xact_start AS xact_age,
    query_start,
    now() - query_start AS query_age,
    wait_event_type,
    wait_event,
    left(query, 200) AS query
FROM pg_stat_activity
WHERE
    wait_event ILIKE '%MultiXact%'
ORDER BY query_start;


-- ============================================================================
-- 7. SLRU I/O waiters
-- ============================================================================

SELECT
    pid,
    usename,
    datname,
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
-- 8. Lock contention control
-- ============================================================================
--
-- MultiXact pressure commonly occurs in lock-heavy workloads. This query
-- provides a control signal so ordinary heavyweight lock waits are not
-- mistaken for MultiXact SLRU waits.
-- ============================================================================

SELECT
    wait_event,
    count(*) AS waiting_sessions
FROM pg_stat_activity
WHERE wait_event_type = 'Lock'
GROUP BY wait_event
ORDER BY waiting_sessions DESC;


-- ============================================================================
-- 9. Row-lock-heavy relations
-- ============================================================================
--
-- pg_locks identifies currently held/requested locks. This is contextual
-- evidence rather than a direct measurement of MultiXact creation.
-- ============================================================================

SELECT
    l.relation::regclass AS relation_name,
    l.mode,
    l.granted,
    count(*) AS lock_count
FROM pg_locks AS l
WHERE
    l.relation IS NOT NULL
GROUP BY
    l.relation,
    l.mode,
    l.granted
ORDER BY lock_count DESC;


-- ============================================================================
-- 10. Row-level lock waits
-- ============================================================================

SELECT
    pid,
    usename,
    application_name,
    relation::regclass AS relation_name,
    mode,
    granted
FROM pg_locks
WHERE
    locktype = 'tuple'
ORDER BY
    relation,
    pid;


-- ============================================================================
-- 11. Long-running transactions with MultiXact-relevant state
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
    AND now() - xact_start >= interval '1 minute'
ORDER BY xact_start;


-- ============================================================================
-- 12. Capture MultiXact SLRU baseline
-- ============================================================================
--
-- Run this before the controlled workload, then again afterward.
-- Compare the deltas rather than only absolute values.
-- ============================================================================

SELECT
    clock_timestamp() AS captured_at,
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
-- 13. Interval delta helper
-- ============================================================================
--
-- Temporary baseline table. The experiment runner may use this to calculate
-- changes during a controlled test.
-- ============================================================================

DROP TABLE IF EXISTS pg_research_multixact_baseline;

CREATE TEMP TABLE pg_research_multixact_baseline AS
SELECT
    name,
    blks_hit,
    blks_read,
    blks_written
FROM pg_stat_slru
WHERE name IN (
    'MultiXactMember',
    'MultiXactOffset'
);


-- ============================================================================
-- 14. Compare against baseline
-- ============================================================================

SELECT
    cur.name,
    cur.blks_hit - base.blks_hit AS hit_delta,
    cur.blks_read - base.blks_read AS read_delta,
    cur.blks_written - base.blks_written AS written_delta
FROM pg_stat_slru AS cur
JOIN pg_research_multixact_baseline AS base
    USING (name)
WHERE cur.name IN (
    'MultiXactMember',
    'MultiXactOffset'
)
ORDER BY cur.name;


-- ============================================================================
-- Interpretation
-- ============================================================================
--
-- MultiXactMember:
--   Stores MultiXact member-list information.
--
-- MultiXactOffset:
--   Maps MultiXact IDs to positions in the member data.
--
-- Rising blks_read:
--   Indicates SLRU pages are being read.
--
-- MultiXact* LWLock waits:
--   Indicate internal synchronization contention.
--
-- IO:SLRURead:
--   Indicates an active SLRU page-read wait, but does not identify the
--   particular SLRU by itself.
--
-- IMPORTANT:
--
-- MultiXact SLRU activity does not prove that the application has a
-- MultiXact problem.
--
-- Strong causal evidence requires correlation among:
--
--   concurrent row-lock workload
--       +
--   MultiXact SLRU read deltas
--       +
--   MultiXact-related waits
--       +
--   query latency / throughput
--
-- A negative control using the same workload with reduced concurrent
-- row-locking should be run before concluding that cache pressure caused
-- the observed performance degradation.
-- ============================================================================
