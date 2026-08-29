-- ============================================================================
-- multixact_pressure.sql
-- ============================================================================
-- Experiment: MultiXact Member/Offset SLRU pressure
--
-- Purpose:
--   Generate concurrent row-lock activity that can create MultiXacts and
--   measure MultiXactMember / MultiXactOffset cache activity.
--
-- IMPORTANT:
--   This workload requires MULTIPLE PostgreSQL sessions.
--   Run the setup section once, then execute the worker workload concurrently
--   from several dedicated sessions.
--
-- DO NOT run against production infrastructure.
-- ============================================================================


-- ============================================================================
-- 1. Experiment metadata
-- ============================================================================

SELECT
    clock_timestamp() AS experiment_started,
    current_database() AS database_name,
    current_user AS database_user,
    version() AS postgres_version;


-- ============================================================================
-- 2. Test table
-- ============================================================================

CREATE TABLE IF NOT EXISTS pg_multixact_pressure_test (
    id integer PRIMARY KEY,
    payload text NOT NULL
);


-- ============================================================================
-- 3. Populate hot-row workload
-- ============================================================================

INSERT INTO pg_multixact_pressure_test (id, payload)
VALUES
    (1, 'hot-row-1'),
    (2, 'hot-row-2'),
    (3, 'hot-row-3'),
    (4, 'hot-row-4'),
    (5, 'hot-row-5')
ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- 4. Capture initial MultiXact SLRU state
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
    'MultiXactMember',
    'MultiXactOffset'
)
ORDER BY name;


-- ============================================================================
-- 5. Capture initial wait-event state
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
-- 6. WORKER SESSION
-- ============================================================================
--
-- Run this section simultaneously from multiple PostgreSQL sessions.
--
-- Recommended initial test:
--
--     8–16 concurrent sessions
--
-- Each session repeatedly obtains compatible row locks on the same small set
-- of rows.
--
-- SELECT ... FOR KEY SHARE is particularly useful for generating compatible
-- row-lock combinations.
-- ============================================================================

BEGIN;

SELECT
    id,
    payload
FROM pg_multixact_pressure_test
WHERE id = 1
FOR KEY SHARE;

-- Keep the transaction open briefly so other sessions can acquire compatible
-- locks against the same tuple.

SELECT pg_sleep(5);

COMMIT;


-- ============================================================================
-- 7. OPTIONAL REPEATED WORKER LOOP
-- ============================================================================
--
-- Run concurrently from multiple sessions.
--
-- The loop intentionally targets a small number of rows to create contention
-- and increase the probability of MultiXact formation.
-- ============================================================================

DO $$
DECLARE
    i integer;
    target_id integer;
BEGIN
    FOR i IN 1..100 LOOP

        target_id := ((i - 1) % 5) + 1;

        BEGIN
            PERFORM
                id
            FROM pg_multixact_pressure_test
            WHERE id = target_id
            FOR KEY SHARE;

            PERFORM pg_sleep(0.01);

        EXCEPTION
            WHEN OTHERS THEN
                NULL;
        END;

    END LOOP;
END
$$;


-- ============================================================================
-- 8. Capture MultiXact SLRU state after workload
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
    'MultiXactMember',
    'MultiXactOffset'
)
ORDER BY name;


-- ============================================================================
-- 9. Calculate current SLRU hit percentages
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
-- 10. Capture MultiXact-related waits
-- ============================================================================

SELECT
    wait_event_type,
    wait_event,
    count(*) AS waiting_sessions
FROM pg_stat_activity
WHERE wait_event_type = 'LWLock'
  AND (
       wait_event LIKE 'MultiXact%'
       OR wait_event = 'SLRURead'
  )
GROUP BY
    wait_event_type,
    wait_event
ORDER BY waiting_sessions DESC;


-- ============================================================================
-- 11. Capture active sessions participating in the workload
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
-- 12. Final SLRU snapshot
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
-- EXPECTED ANALYSIS
-- ============================================================================
--
-- Compare:
--
--     baseline MultiXactMember blks_read
--     baseline MultiXactOffset blks_read
--
-- against:
--
--     post-workload values
--
-- Calculate:
--
--     member_read_delta
--     offset_read_delta
--     member_hit_delta
--     offset_hit_delta
--
-- Then correlate those deltas with:
--
--     MultiXactMember* waits
--     MultiXactOffset* waits
--     SLRURead waits
--     query latency
--
--
-- IMPORTANT:
--
-- Increased MultiXact activity alone does NOT prove cache pressure.
--
-- Stronger evidence requires:
--
--     rising blks_read
--          +
--     measurable waits and/or latency
--          +
--     reproducibility under the same concurrency level
--
-- ============================================================================


-- ============================================================================
-- CONTROL
-- ============================================================================
--
-- Repeat the workload against a larger, distributed key space:
--
--     many different row IDs
--
-- rather than repeatedly targeting five hot rows.
--
-- This provides a comparison between:
--
--     HOT-ROW MULTIXACT WORKLOAD
--              vs.
--     DISTRIBUTED-ROW WORKLOAD
--
-- The purpose is to separate MultiXact cache effects from ordinary application
-- row-lock contention.
-- ============================================================================
