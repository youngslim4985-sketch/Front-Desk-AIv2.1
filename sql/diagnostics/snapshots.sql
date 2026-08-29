-- ============================================================================
-- snapshots.sql
-- ============================================================================
-- Purpose:
--   Capture MVCC snapshot and transaction-horizon information relevant to
--   subtransaction overflow and hot-standby recovery.
--
-- Diagnostic only. No writes or configuration changes.
-- ============================================================================


-- ============================================================================
-- 1. Current transaction IDs and horizons
-- ============================================================================

SELECT
    txid_current() AS current_xid,
    txid_current_snapshot() AS current_snapshot,
    txid_snapshot_xmin(txid_current_snapshot()) AS snapshot_xmin,
    txid_snapshot_xmax(txid_current_snapshot()) AS snapshot_xmax;


-- ============================================================================
-- 2. Current backend transaction horizons
-- ============================================================================

SELECT
    pid,
    usename,
    application_name,
    backend_xid,
    backend_xmin,
    xact_start,
    CASE
        WHEN xact_start IS NOT NULL
        THEN now() - xact_start
    END AS xact_age,
    state,
    wait_event_type,
    wait_event,
    left(query, 200) AS query
FROM pg_stat_activity
WHERE
    backend_xid IS NOT NULL
    OR backend_xmin IS NOT NULL
ORDER BY
    backend_xmin ASC NULLS LAST,
    xact_start ASC NULLS LAST;


-- ============================================================================
-- 3. Oldest active transaction
-- ============================================================================

SELECT
    pid,
    usename,
    application_name,
    backend_xid,
    backend_xmin,
    xact_start,
    now() - xact_start AS xact_age,
    state,
    left(query, 200) AS query
FROM pg_stat_activity
WHERE xact_start IS NOT NULL
ORDER BY xact_start
LIMIT 1;


-- ============================================================================
-- 4. Transaction age by database
-- ============================================================================

SELECT
    datname,
    age(datfrozenxid) AS xid_age,
    datfrozenxid,
    age(datminmxid) AS multixact_age,
    datminmxid
FROM pg_database
ORDER BY xid_age DESC;


-- ============================================================================
-- 5. Transaction-ID horizon context
-- ============================================================================

SELECT
    datname,
    numbackends,
    xact_commit,
    xact_rollback,
    stats_reset
FROM pg_stat_database
WHERE datname IS NOT NULL
ORDER BY numbackends DESC;


-- ============================================================================
-- 6. Snapshot-related wait events
-- ============================================================================
--
-- This is intentionally broad. Snapshot construction does not have one
-- universal wait event that proves subtransaction overflow.
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
-- 7. Subtransaction state associated with active snapshots
-- ============================================================================

SELECT
    a.pid,
    a.usename,
    a.application_name,
    a.backend_xid,
    a.backend_xmin,
    a.xact_start,
    now() - a.xact_start AS xact_age,
    s.subxact_count,
    s.subxact_overflow,
    a.state,
    a.wait_event_type,
    a.wait_event,
    left(a.query, 200) AS query
FROM pg_stat_activity AS a
CROSS JOIN LATERAL pg_stat_get_backend_subxact(a.pid) AS s
WHERE
    a.xact_start IS NOT NULL
ORDER BY
    s.subxact_overflow DESC,
    s.subxact_count DESC,
    a.xact_start ASC;


-- ============================================================================
-- 8. Long-lived xmin holders
-- ============================================================================
--
-- Long-lived xmin values can prevent cleanup and are important context when
-- evaluating transaction-horizon effects.
-- ============================================================================

SELECT
    pid,
    usename,
    application_name,
    backend_xmin,
    xact_start,
    now() - xact_start AS xact_age,
    state,
    left(query, 200) AS query
FROM pg_stat_activity
WHERE backend_xmin IS NOT NULL
ORDER BY backend_xmin;


-- ============================================================================
-- 9. Prepared transactions
-- ============================================================================
--
-- Prepared transactions can also retain transaction horizons and therefore
-- matter when interpreting snapshot behavior.
-- ============================================================================

SELECT
    gid,
    prepared,
    owner,
    database
FROM pg_prepared_xacts
ORDER BY prepared;


-- ============================================================================
-- 10. Replication snapshot context
-- ============================================================================

SELECT
    pid,
    usename,
    application_name,
    client_addr,
    state,
    sent_lsn,
    write_lsn,
    flush_lsn,
    replay_lsn,
    write_lag,
    flush_lag,
    replay_lag,
    sync_state,
    sync_priority
FROM pg_stat_replication
ORDER BY pid;


-- ============================================================================
-- 11. Standby recovery state
-- ============================================================================
--
-- Run this query directly on the standby.
-- ============================================================================

SELECT
    pg_is_in_recovery() AS in_recovery,
    pg_last_wal_receive_lsn() AS receive_lsn,
    pg_last_wal_replay_lsn() AS replay_lsn,
    pg_last_xact_replay_timestamp() AS last_replayed_xact;


-- ============================================================================
-- 12. Standby replay delay
-- ============================================================================

SELECT
    now() - pg_last_xact_replay_timestamp()
        AS replay_time_since_last_xact
WHERE pg_last_xact_replay_timestamp() IS NOT NULL;


-- ============================================================================
-- 13. Recovery pause state
-- ============================================================================
--
-- Useful when determining whether WAL replay is progressing independently
-- from query availability.
-- ============================================================================

SELECT
    pg_get_wal_replay_pause_state() AS wal_replay_pause_state;


-- ============================================================================
-- 14. Hot-standby query capability
-- ============================================================================
--
-- This provides a simple readiness signal when executed against a standby.
-- pg_is_in_recovery() being true is expected on a hot standby; it does NOT
-- mean the standby is unavailable for reads.
-- ============================================================================

SELECT
    pg_is_in_recovery() AS in_recovery,
    current_setting('transaction_read_only') AS transaction_read_only;


-- ============================================================================
-- 15. Snapshot observation timestamp
-- ============================================================================

SELECT clock_timestamp() AS captured_at;


-- ============================================================================
-- Interpretation
-- ============================================================================
--
-- IMPORTANT:
--
-- These queries provide evidence about transaction horizons and recovery
-- state. They do not by themselves prove RUNNING_XACTS overflow.
--
-- In the standby experiment, combine this information with:
--
--   diagnostics/replication.sql
--   diagnostics/subtransactions.sql
--   diagnostics/slru.sql
--   experiment WAL/recovery timing
--   PostgreSQL server logs
--
-- The critical distinction is:
--
--   WAL replay progressing
--          !=
--   hot-standby queries being available
--
-- A standby can continue replaying WAL while waiting for a safe snapshot.
--
-- For the controlled overflow experiment, record:
--
--   T0 = overflow-producing transaction begins
--   T1 = subtransaction cache becomes overflowed
--   T2 = standby/recovery reaches the relevant WAL position
--   T3 = standby accepts read queries
--   T4 = overflowing transaction completes
--
-- The measured interval T3 - T2, and its relationship to T4, is the
-- important empirical result.
-- ============================================================================
