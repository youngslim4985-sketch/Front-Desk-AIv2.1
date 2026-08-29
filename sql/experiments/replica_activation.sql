-- ============================================================================
-- replica_activation.sql
-- ============================================================================
-- Purpose:
--   Measure whether an overflowed subtransaction state on the primary delays
--   hot-standby query availability during standby recovery.
--
-- IMPORTANT:
--   This experiment requires TWO PostgreSQL instances:
--
--       PRIMARY
--       STANDBY
--
--   It cannot be reproduced accurately using a single SQL session.
--
-- Run only against authorized test infrastructure.
-- ============================================================================


-- ============================================================================
-- 1. PRIMARY: experiment metadata
-- ============================================================================

SELECT
    current_database() AS database_name,
    current_user AS database_user,
    version() AS postgres_version,
    now() AS experiment_start;


-- ============================================================================
-- 2. PRIMARY: verify replication configuration
-- ============================================================================

SHOW wal_level;
SHOW max_wal_senders;
SHOW max_replication_slots;
SHOW hot_standby;


-- ============================================================================
-- 3. PRIMARY: inspect existing replication state
-- ============================================================================

SELECT
    pid,
    application_name,
    client_addr,
    state,
    sync_state,
    sent_lsn,
    write_lsn,
    flush_lsn,
    replay_lsn,
    write_lag,
    flush_lag,
    replay_lag
FROM pg_stat_replication;


-- ============================================================================
-- 4. PRIMARY: create workload table
-- ============================================================================

DROP TABLE IF EXISTS replica_activation_workload;

CREATE TABLE replica_activation_workload (
    id bigint PRIMARY KEY,
    payload text NOT NULL
);


-- ============================================================================
-- 5. PRIMARY: create an overflow transaction
-- ============================================================================
--
-- SESSION A:
--
-- BEGIN;
--
-- Generate >64 XID-bearing subtransactions and KEEP THE TOP-LEVEL
-- TRANSACTION OPEN.
--
-- ============================================================================

-- BEGIN;

-- DO $$
-- DECLARE
--     i integer;
-- BEGIN
--     FOR i IN 1..256 LOOP
--         BEGIN
--             INSERT INTO replica_activation_workload (id, payload)
--             VALUES (
--                 i,
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
-- 6. PRIMARY: verify subtransaction overflow
-- ============================================================================

-- SELECT
--     a.pid,
--     a.xact_start,
--     now() - a.xact_start AS transaction_age,
--     s.subxact_count,
--     s.subxact_overflow
-- FROM pg_stat_activity AS a
-- CROSS JOIN LATERAL pg_stat_get_backend_subxact(a.pid) AS s
-- WHERE a.pid = pg_backend_pid();


-- ============================================================================
-- 7. PRIMARY: generate WAL while overflow transaction remains active
-- ============================================================================
--
-- Additional WAL activity gives the standby recovery process transaction-state
-- records to replay.
-- ============================================================================

INSERT INTO replica_activation_workload (id, payload)
SELECT
    100000 + g,
    md5(g::text)
FROM generate_series(1, 1000) AS g;


-- ============================================================================
-- 8. STANDBY: determine recovery state
-- ============================================================================
--
-- Run these queries against the standby repeatedly during recovery.
-- ============================================================================

SELECT
    now() AS observed_at,
    pg_is_in_recovery() AS in_recovery;


-- ============================================================================
-- 9. STANDBY: inspect recovery progress
-- ============================================================================

SELECT
    pg_last_wal_receive_lsn() AS receive_lsn,
    pg_last_wal_replay_lsn() AS replay_lsn,
    pg_last_xact_replay_timestamp() AS last_replayed_xact;


-- ============================================================================
-- 10. STANDBY: test read availability
-- ============================================================================
--
-- The important measurement is whether this query succeeds.
--
-- A standby can be:
--
--     replaying WAL
--     AND still unable to accept read-only queries.
--
-- ============================================================================

SELECT
    now() AS read_test_time,
    count(*) AS visible_rows
FROM replica_activation_workload;


-- ============================================================================
-- 11. STANDBY: record first successful read
-- ============================================================================
--
-- Run repeatedly until the query succeeds.
--
-- Record:
--
--     timestamp
--     recovery state
--     replay LSN
--     replay timestamp
--
-- ============================================================================

SELECT
    clock_timestamp() AS first_read_check,
    pg_is_in_recovery() AS in_recovery,
    pg_last_wal_replay_lsn() AS replay_lsn;


-- ============================================================================
-- 12. PRIMARY: release the overflowing transaction
-- ============================================================================
--
-- SESSION A:
--
-- COMMIT;
--
-- Record the exact commit timestamp.
-- ============================================================================

-- COMMIT;


-- ============================================================================
-- 13. STANDBY: continue polling after primary COMMIT
-- ============================================================================

SELECT
    clock_timestamp() AS observation_time,
    pg_is_in_recovery() AS in_recovery,
    pg_last_wal_replay_lsn() AS replay_lsn,
    pg_last_xact_replay_timestamp() AS replay_timestamp;


-- ============================================================================
-- 14. STANDBY: repeat read test
-- ============================================================================

SELECT
    clock_timestamp() AS read_test_time,
    count(*) AS visible_rows
FROM replica_activation_workload;


-- ============================================================================
-- 15. PRIMARY: final replication state
-- ============================================================================

SELECT
    pid,
    application_name,
    state,
    sent_lsn,
    write_lsn,
    flush_lsn,
    replay_lsn,
    replay_lag
FROM pg_stat_replication;


-- ============================================================================
-- Required measurements
-- ============================================================================
--
-- Record at minimum:
--
--   T0 = standby recovery begins
--   T1 = standby begins replaying relevant WAL
--   T2 = standby first accepts a read query
--   T3 = overflowing transaction commits
--   T4 = standby receives/replays transaction completion state
--
-- Calculate:
--
--   T2 - T0
--   T2 - T3
--
-- Also record WAL LSN at each observation.
--
-- ============================================================================
-- Critical distinction
-- ============================================================================
--
-- Do NOT use:
--
--     pg_is_in_recovery() = false
--
-- as the sole definition of read availability.
--
-- A physical standby normally accepts read-only queries while
-- pg_is_in_recovery() is TRUE once hot standby has been activated.
--
-- The actual availability test is whether a read-only query succeeds.
--
-- ============================================================================
-- Negative control
-- ============================================================================
--
-- Repeat the experiment with an equivalent long-running transaction that
-- DOES NOT create >64 XID-bearing subtransactions.
--
-- Compare:
--
--     standby activation time
--     first successful read timestamp
--     replay LSN
--     WAL volume
--
-- ============================================================================
-- Expected interpretation
-- ============================================================================
--
-- POSSIBLE RESULT A
--
-- Overflow causes a measurable delay before hot standby accepts reads.
--
-- This supports the replica-availability hypothesis.
--
--
-- POSSIBLE RESULT B
--
-- WAL replay continues but read availability is unaffected.
--
-- The claimed availability impact is not reproduced under this workload.
--
--
-- POSSIBLE RESULT C
--
-- A delay occurs, but the negative control shows the same delay.
--
-- The cause may be general recovery/replay behavior rather than subtransaction
-- overflow.
--
-- ============================================================================
-- Research boundary
-- ============================================================================
--
-- This experiment tests:
--
--     subtransaction overflow
--             |
--             v
--     standby snapshot construction
--             |
--             v
--     hot-standby read availability
--
-- It does NOT test:
--
--     psql width calculation
--     pg_wcswidth()
--     pg_wcssize()
--     pg_wcsformat()
--     MultiXact pressure
--
-- Those remain independent mechanisms unless a later combined workload
-- demonstrates a causal connection.
-- ============================================================================
