-- ============================================================================
-- standby_snapshot_overflow.sql
-- ============================================================================
-- Experiment: RUNNING_XACTS overflow and hot-standby readiness
--
-- Purpose:
--   Determine whether an XID-bearing subtransaction overflow on the primary
--   can delay a newly recovering standby from reaching a usable hot-standby
--   snapshot.
--
-- IMPORTANT:
--   This experiment requires:
--
--       PRIMARY
--       PHYSICAL STANDBY
--       WAL SHIPPING / STREAMING REPLICATION
--
--   Run only against dedicated test infrastructure.
--
-- ============================================================================


-- ============================================================================
-- PART A — PRIMARY
-- ============================================================================
--
-- Execute from a primary session.
-- ============================================================================


-- 1. Record experiment metadata

SELECT
    clock_timestamp() AS experiment_time,
    current_database() AS database_name,
    current_user AS database_user,
    pg_is_in_recovery() AS in_recovery;


-- 2. Confirm replication state

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


-- 3. Record initial WAL position

SELECT
    clock_timestamp() AS captured_at,
    pg_current_wal_lsn() AS wal_lsn;


-- 4. Record initial Subtrans statistics

SELECT
    clock_timestamp() AS captured_at,
    name,
    blks_hit,
    blks_read,
    blks_written,
    stats_reset
FROM pg_stat_slru
WHERE name = 'Subtrans';


-- ============================================================================
-- 5. Create dedicated test table
-- ============================================================================

CREATE TABLE IF NOT EXISTS standby_overflow_test (
    id integer PRIMARY KEY,
    payload text NOT NULL
);


-- ============================================================================
-- 6. Begin the long-running top-level transaction
-- ============================================================================

BEGIN;


-- ============================================================================
-- 7. Generate >64 XID-bearing subtransactions
-- ============================================================================
--
-- The transaction intentionally remains OPEN after the subtransactions have
-- been generated.
--
-- This is important because the standby experiment needs the potentially
-- problematic transaction state to remain active while recovery progresses.
-- ============================================================================

DO $$
DECLARE
    i integer;
BEGIN
    FOR i IN 1..100 LOOP

        BEGIN

            INSERT INTO standby_overflow_test
            VALUES (
                i,
                'standby-overflow-' || i
            )
            ON CONFLICT (id)
            DO UPDATE SET payload = EXCLUDED.payload;

            RAISE EXCEPTION 'intentional test rollback %', i;

        EXCEPTION
            WHEN OTHERS THEN
                NULL;
        END;

    END LOOP;
END
$$;


-- ============================================================================
-- 8. Verify subtransaction state
-- ============================================================================

SELECT
    a.pid,
    a.xact_start,
    now() - a.xact_start AS transaction_age,
    a.backend_xid,
    a.backend_xmin,
    s.subxact_count,
    s.subxact_overflow
FROM pg_stat_activity AS a
CROSS JOIN LATERAL pg_stat_get_backend_subxact(a.pid) AS s
WHERE a.pid = pg_backend_pid();


-- ============================================================================
-- 9. Generate additional WAL while transaction remains open
-- ============================================================================
--
-- This gives the standby WAL to replay while the top-level transaction
-- remains active.
-- ============================================================================

CREATE TABLE IF NOT EXISTS standby_wal_progress (
    id bigint,
    created_at timestamptz DEFAULT clock_timestamp()
);

INSERT INTO standby_wal_progress (id)
SELECT generate_series(1, 1000);


-- ============================================================================
-- 10. Record WAL after overflow workload
-- ============================================================================

SELECT
    clock_timestamp() AS captured_at,
    pg_current_wal_lsn() AS wal_lsn;


-- ============================================================================
-- 11. Record Subtrans statistics
-- ============================================================================

SELECT
    clock_timestamp() AS captured_at,
    name,
    blks_hit,
    blks_read,
    blks_written
FROM pg_stat_slru
WHERE name = 'Subtrans';


-- ============================================================================
-- IMPORTANT:
--
-- LEAVE THIS TRANSACTION OPEN.
--
-- The standby-side measurements begin now.
--
-- Do NOT execute COMMIT until the standby has been observed.
-- ============================================================================


-- ============================================================================
-- PART B — STANDBY
-- ============================================================================
--
-- Execute these commands from the standby in a SEPARATE session.
-- ============================================================================


-- 12. Determine recovery state

SELECT
    clock_timestamp() AS captured_at,
    pg_is_in_recovery() AS in_recovery;


-- 13. Check whether hot standby is accepting queries

SELECT
    current_setting('transaction_read_only') AS transaction_read_only;


-- 14. Record recovery position

SELECT
    clock_timestamp() AS captured_at,
    pg_last_wal_receive_lsn() AS receive_lsn,
    pg_last_wal_replay_lsn() AS replay_lsn,
    pg_last_xact_replay_timestamp() AS last_replayed_transaction;


-- 15. Inspect recovery conflict / activity state

SELECT
    pid,
    backend_type,
    state,
    wait_event_type,
    wait_event,
    query
FROM pg_stat_activity
WHERE backend_type IS NOT NULL
ORDER BY backend_type, pid;


-- ============================================================================
-- 16. Attempt a read query
-- ============================================================================
--
-- This should be executed repeatedly while the standby is recovering.
-- ============================================================================

SELECT
    clock_timestamp() AS query_time,
    pg_is_in_recovery() AS in_recovery,
    current_setting('transaction_read_only') AS transaction_read_only;


-- ============================================================================
-- 17. Monitor replay progress
-- ============================================================================

SELECT
    clock_timestamp() AS captured_at,
    pg_last_wal_receive_lsn() AS receive_lsn,
    pg_last_wal_replay_lsn() AS replay_lsn,
    pg_last_xact_replay_timestamp() AS replay_timestamp;


-- ============================================================================
-- PART C — RELEASE THE LONG TRANSACTION
-- ============================================================================
--
-- Return to the PRIMARY session.
-- ============================================================================


COMMIT;


-- ============================================================================
-- PART D — PRIMARY POST-COMMIT MEASUREMENT
-- ============================================================================

SELECT
    clock_timestamp() AS commit_time,
    pg_current_wal_lsn() AS wal_lsn;


-- ============================================================================
-- PART E — STANDBY POST-COMMIT MEASUREMENT
-- ============================================================================
--
-- Execute repeatedly on the standby after the primary COMMIT.
-- ============================================================================

SELECT
    clock_timestamp() AS captured_at,
    pg_is_in_recovery() AS in_recovery,
    pg_last_wal_receive_lsn() AS receive_lsn,
    pg_last_wal_replay_lsn() AS replay_lsn,
    pg_last_xact_replay_timestamp() AS replay_timestamp;


-- ============================================================================
-- 18. Confirm read availability
-- ============================================================================

SELECT
    clock_timestamp() AS query_time,
    current_database() AS database_name,
    pg_is_in_recovery() AS in_recovery,
    current_setting('transaction_read_only') AS transaction_read_only;


-- ============================================================================
-- ============================================================================
-- ANALYSIS
-- ============================================================================
--
-- Record these timestamps:
--
--     T0 = overflow transaction begins
--     T1 = >64 subtransactions generated
--     T2 = standby begins/restarts recovery
--     T3 = standby reaches consistent recovery state
--     T4 = standby accepts read-only query
--     T5 = primary commits long-running transaction
--
--
-- Calculate:
--
--     T4 - T2
--
-- and, most importantly:
--
--     T4 - T5
--
--
-- Compare against a control experiment where the primary does NOT generate
-- the >64 XID-bearing subtransactions.
--
-- ============================================================================


-- ============================================================================
-- REQUIRED EVIDENCE
-- ============================================================================
--
-- The experiment is considered useful only if the following are captured:
--
-- [ ] PostgreSQL version
-- [ ] primary WAL position
-- [ ] standby WAL receive position
-- [ ] standby WAL replay position
-- [ ] subxact_count
-- [ ] subxact_overflow
-- [ ] Subtrans blks_hit
-- [ ] Subtrans blks_read
-- [ ] standby recovery timestamps
-- [ ] first successful read timestamp
-- [ ] primary commit timestamp
-- [ ] replication lag
-- [ ] control-run measurements
--
-- ============================================================================


-- ============================================================================
-- INTERPRETATION RULE
-- ============================================================================
--
-- DO NOT conclude:
--
--     "subtransaction overflow causes standby outage"
--
-- merely because standby recovery is slow.
--
-- The control run must establish that the delay is materially different from
-- ordinary recovery/replay time.
--
-- Strong evidence requires:
--
--     overflow condition confirmed
--              +
--     standby snapshot/readiness delay measured
--              +
--     control workload measured
--              +
--     repeatability
--
-- ============================================================================
