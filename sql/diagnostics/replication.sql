-- ============================================================================
-- replication.sql
-- ============================================================================
-- Purpose:
--   Capture primary/standby replication state, WAL positions, replay
--   progress, and recovery readiness.
--
-- Diagnostic only. No writes or configuration changes.
--
-- Run the PRIMARY section on the primary.
-- Run the STANDBY section on the standby.
-- ============================================================================


-- ============================================================================
-- PRIMARY
-- ============================================================================


-- ============================================================================
-- 1. Current primary WAL position
-- ============================================================================

SELECT
    clock_timestamp() AS captured_at,
    pg_current_wal_lsn() AS current_wal_lsn;


-- ============================================================================
-- 2. Connected standbys
-- ============================================================================

SELECT
    pid,
    usename,
    application_name,
    client_addr,
    state,
    sync_state,
    sync_priority,
    sent_lsn,
    write_lsn,
    flush_lsn,
    replay_lsn,
    write_lag,
    flush_lag,
    replay_lag,
    backend_start,
    reply_time
FROM pg_stat_replication
ORDER BY application_name, pid;


-- ============================================================================
-- 3. Replication slots
-- ============================================================================

SELECT
    slot_name,
    slot_type,
    active,
    active_pid,
    restart_lsn,
    confirmed_flush_lsn,
    wal_status,
    safe_wal_size,
    two_phase,
    temporary
FROM pg_replication_slots
ORDER BY slot_name;


-- ============================================================================
-- 4. WAL sender activity
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
    reply_time
FROM pg_stat_replication
WHERE state IS NOT NULL
ORDER BY pid;


-- ============================================================================
-- 5. Replication lag in bytes
-- ============================================================================
--
-- These are instantaneous LSN distances and should be sampled repeatedly.
-- ============================================================================

SELECT
    application_name,
    pg_wal_lsn_diff(
        pg_current_wal_lsn(),
        replay_lsn
    ) AS replay_lag_bytes,
    pg_wal_lsn_diff(
        pg_current_wal_lsn(),
        flush_lsn
    ) AS flush_lag_bytes,
    replay_lag
FROM pg_stat_replication
WHERE replay_lsn IS NOT NULL
ORDER BY replay_lag_bytes DESC;


-- ============================================================================
-- 6. Replication connection count
-- ============================================================================

SELECT
    count(*) AS connected_standbys
FROM pg_stat_replication;


-- ============================================================================
-- 7. Primary transaction activity during replication test
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
    left(query, 250) AS query
FROM pg_stat_activity
WHERE xact_start IS NOT NULL
ORDER BY xact_start;


-- ============================================================================
-- 8. Primary subtransaction state
-- ============================================================================

SELECT
    a.pid,
    a.usename,
    a.application_name,
    a.xact_start,
    now() - a.xact_start AS xact_age,
    s.subxact_count,
    s.subxact_overflow,
    a.backend_xid,
    a.backend_xmin,
    a.state,
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
-- STANDBY
-- ============================================================================


-- ============================================================================
-- 9. Basic recovery state
-- ============================================================================

SELECT
    clock_timestamp() AS captured_at,
    pg_is_in_recovery() AS in_recovery,
    pg_last_wal_receive_lsn() AS receive_lsn,
    pg_last_wal_replay_lsn() AS replay_lsn,
    pg_last_xact_replay_timestamp() AS last_xact_replay_timestamp;


-- ============================================================================
-- 10. Receive/replay distance
-- ============================================================================

SELECT
    pg_wal_lsn_diff(
        pg_last_wal_receive_lsn(),
        pg_last_wal_replay_lsn()
    ) AS receive_replay_lag_bytes;


-- ============================================================================
-- 11. Replay timestamp age
-- ============================================================================

SELECT
    clock_timestamp() AS captured_at,
    pg_last_xact_replay_timestamp() AS last_replayed_transaction,
    CASE
        WHEN pg_last_xact_replay_timestamp() IS NOT NULL
        THEN clock_timestamp() - pg_last_xact_replay_timestamp()
    END AS replay_timestamp_age;


-- ============================================================================
-- 12. WAL replay pause state
-- ============================================================================

SELECT
    pg_get_wal_replay_pause_state() AS replay_pause_state;


-- ============================================================================
-- 13. Recovery configuration
-- ============================================================================
--
-- Record configuration relevant to hot standby behavior.
-- ============================================================================

SELECT
    name,
    setting,
    unit,
    source
FROM pg_settings
WHERE name IN (
    'hot_standby',
    'hot_standby_feedback',
    'max_standby_streaming_delay',
    'max_standby_archive_delay',
    'recovery_min_apply_delay'
)
ORDER BY name;


-- ============================================================================
-- 14. Standby transaction activity
-- ============================================================================
--
-- Run while the standby is accepting queries.
-- ============================================================================

SELECT
    pid,
    usename,
    application_name,
    client_addr,
    state,
    backend_xmin,
    xact_start,
    query_start,
    wait_event_type,
    wait_event,
    left(query, 250) AS query
FROM pg_stat_activity
WHERE pid <> pg_backend_pid()
ORDER BY xact_start ASC NULLS LAST;


-- ============================================================================
-- 15. Test read availability
-- ============================================================================
--
-- This query should be executed repeatedly by the experiment harness.
--
-- Successful execution means the connection was able to execute a
-- read-only query. It does NOT mean recovery has completed.
-- ============================================================================

SELECT
    clock_timestamp() AS observed_at,
    pg_is_in_recovery() AS in_recovery,
    current_setting('transaction_read_only') AS transaction_read_only,
    1 AS read_test;


-- ============================================================================
-- 16. Standby recovery progress snapshot
-- ============================================================================

SELECT
    clock_timestamp() AS captured_at,
    pg_last_wal_receive_lsn() AS receive_lsn,
    pg_last_wal_replay_lsn() AS replay_lsn,
    pg_last_xact_replay_timestamp() AS replay_timestamp,
    pg_get_wal_replay_pause_state() AS replay_pause_state;


-- ============================================================================
-- 17. Replication timeline
-- ============================================================================

SELECT
    timeline_id,
    prev_timeline_id,
    next_timeline_id,
    end_lsn,
    end_time,
    reason
FROM pg_control_checkpoint();


-- ============================================================================
-- EXPERIMENT TIMING
-- ============================================================================
--
-- For the standby availability experiment, record timestamps externally:
--
--   T0 = standby startup begins
--   T1 = standby establishes streaming/recovery
--   T2 = relevant overflowed WAL reaches standby
--   T3 = first successful read-only query
--   T4 = overflowing primary transaction commits/aborts
--   T5 = standby remains continuously queryable
--
-- Do NOT infer T3 from pg_is_in_recovery().
--
-- pg_is_in_recovery() normally remains TRUE while a hot standby is serving
-- read-only queries.
--
-- The actual readiness signal is successful execution of a read-only query.
-- ============================================================================


-- ============================================================================
-- CORRELATION
-- ============================================================================
--
-- Compare this file against:
--
--   diagnostics/activity.sql
--   diagnostics/subtransactions.sql
--   diagnostics/snapshots.sql
--   diagnostics/slru.sql
--   diagnostics/waits.sql
--
-- The strongest evidence for the standby hypothesis is a controlled
-- relationship between:
--
--   subtransaction overflow
--          |
--          v
--   overflowed transaction-state WAL
--          |
--          v
--   standby snapshot/recovery state
--          |
--          v
--   delayed read availability
--
-- The experiment must include a negative control without subtransaction
-- overflow.
-- ============================================================================

