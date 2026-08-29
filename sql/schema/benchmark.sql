-- ============================================================================
-- benchmark.sql
-- ============================================================================
-- Benchmark metadata and workload-run schema
--
-- Purpose:
--   Provide a consistent structure for recording every experiment run,
--   configuration, workload, and outcome.
--
-- This schema is intentionally separate from results.sql:
--
--   benchmark.sql → what was run and under what conditions
--   results.sql   → measurements and observations
-- ============================================================================


-- ============================================================================
-- 1. Benchmark runs
-- ============================================================================

CREATE TABLE IF NOT EXISTS benchmark_runs (
    run_id              BIGSERIAL PRIMARY KEY,

    experiment_name     TEXT NOT NULL,
    experiment_version  TEXT NOT NULL DEFAULT '1.0',

    run_type            TEXT NOT NULL
        CHECK (
            run_type IN (
                'baseline',
                'control',
                'test',
                'stress',
                'ab'
            )
        ),

    status              TEXT NOT NULL DEFAULT 'planned'
        CHECK (
            status IN (
                'planned',
                'running',
                'completed',
                'failed',
                'inconclusive'
            )
        ),

    started_at          TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,

    notes               TEXT,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);


-- ============================================================================
-- 2. PostgreSQL environment
-- ============================================================================

CREATE TABLE IF NOT EXISTS benchmark_environment (
    environment_id      BIGSERIAL PRIMARY KEY,

    run_id              BIGINT NOT NULL
        REFERENCES benchmark_runs(run_id)
        ON DELETE CASCADE,

    postgres_version    TEXT NOT NULL,

    database_name       TEXT,

    server_role         TEXT
        CHECK (
            server_role IN (
                'primary',
                'standby',
                'unknown'
            )
        ),

    shared_buffers      TEXT,

    subtransaction_buffers TEXT,

    transaction_buffers TEXT,

    multixact_member_buffers TEXT,

    multixact_offset_buffers TEXT,

    max_connections     INTEGER,

    synchronous_commit  TEXT,

    wal_level           TEXT,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);


-- ============================================================================
-- 3. Workload definition
-- ============================================================================

CREATE TABLE IF NOT EXISTS benchmark_workloads (
    workload_id         BIGSERIAL PRIMARY KEY,

    run_id              BIGINT NOT NULL
        REFERENCES benchmark_runs(run_id)
        ON DELETE CASCADE,

    workload_name       TEXT NOT NULL,

    worker_count        INTEGER,

    duration_seconds    NUMERIC,

    operations_target   BIGINT,

    operations_completed BIGINT,

    transaction_pattern TEXT,

    subtransaction_pattern TEXT,

    multixact_pattern   TEXT,

    description         TEXT,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);


-- ============================================================================
-- 4. Benchmark timing
-- ============================================================================

CREATE TABLE IF NOT EXISTS benchmark_timing (
    timing_id           BIGSERIAL PRIMARY KEY,

    run_id              BIGINT NOT NULL
        REFERENCES benchmark_runs(run_id)
        ON DELETE CASCADE,

    event_name          TEXT NOT NULL,

    event_time          TIMESTAMPTZ NOT NULL,

    elapsed_ms          NUMERIC,

    notes               TEXT
);


-- ============================================================================
-- 5. WAL measurements
-- ============================================================================

CREATE TABLE IF NOT EXISTS benchmark_wal (
    wal_measurement_id  BIGSERIAL PRIMARY KEY,

    run_id              BIGINT NOT NULL
        REFERENCES benchmark_runs(run_id)
        ON DELETE CASCADE,

    captured_at         TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

    wal_lsn             PG_LSN,

    wal_bytes_generated NUMERIC,

    receive_lag_bytes   NUMERIC,

    replay_lag_bytes    NUMERIC
);


-- ============================================================================
-- 6. SLRU measurements
-- ============================================================================

CREATE TABLE IF NOT EXISTS benchmark_slru (
    slru_measurement_id BIGSERIAL PRIMARY KEY,

    run_id              BIGINT NOT NULL
        REFERENCES benchmark_runs(run_id)
        ON DELETE CASCADE,

    captured_at         TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

    slru_name           TEXT NOT NULL,

    blks_hit            BIGINT,

    blks_read           BIGINT,

    blks_written        BIGINT,

    hit_delta           BIGINT,

    read_delta          BIGINT,

    write_delta         BIGINT
);


-- ============================================================================
-- 7. Wait observations
-- ============================================================================

CREATE TABLE IF NOT EXISTS benchmark_waits (
    wait_id             BIGSERIAL PRIMARY KEY,

    run_id              BIGINT NOT NULL
        REFERENCES benchmark_runs(run_id)
        ON DELETE CASCADE,

    captured_at         TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

    wait_event_type     TEXT,

    wait_event          TEXT,

    waiting_sessions    INTEGER,

    observed_duration_ms NUMERIC,

    notes               TEXT
);


-- ============================================================================
-- 8. Query performance
-- ============================================================================

CREATE TABLE IF NOT EXISTS benchmark_latency (
    latency_id          BIGSERIAL PRIMARY KEY,

    run_id              BIGINT NOT NULL
        REFERENCES benchmark_runs(run_id)
        ON DELETE CASCADE,

    captured_at         TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

    operation_name      TEXT NOT NULL,

    operation_count     BIGINT,

    latency_min_ms      NUMERIC,

    latency_avg_ms      NUMERIC,

    latency_p50_ms      NUMERIC,

    latency_p95_ms      NUMERIC,

    latency_p99_ms      NUMERIC,

    latency_max_ms      NUMERIC,

    throughput_ops_sec  NUMERIC
);


-- ============================================================================
-- 9. Subtransaction state
-- ============================================================================

CREATE TABLE IF NOT EXISTS benchmark_subtransactions (
    subtransaction_measurement_id BIGSERIAL PRIMARY KEY,

    run_id              BIGINT NOT NULL
        REFERENCES benchmark_runs(run_id)
        ON DELETE CASCADE,

    captured_at         TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

    backend_pid         INTEGER,

    backend_xid         TEXT,

    backend_xmin        TEXT,

    subxact_count       INTEGER,

    subxact_overflow    BOOLEAN,

    transaction_age_ms  NUMERIC
);


-- ============================================================================
-- 10. Standby measurements
-- ============================================================================

CREATE TABLE IF NOT EXISTS benchmark_standby (
    standby_measurement_id BIGSERIAL PRIMARY KEY,

    run_id              BIGINT NOT NULL
        REFERENCES benchmark_runs(run_id)
        ON DELETE CASCADE,

    captured_at         TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

    receive_lsn         PG_LSN,

    replay_lsn          PG_LSN,

    replay_timestamp    TIMESTAMPTZ,

    receive_lag_bytes   NUMERIC,

    replay_lag_bytes    NUMERIC,

    read_query_success  BOOLEAN,

    read_query_latency_ms NUMERIC,

    notes               TEXT
);


-- ============================================================================
-- 11. Experiment observations
-- ============================================================================

CREATE TABLE IF NOT EXISTS benchmark_observations (
    observation_id      BIGSERIAL PRIMARY KEY,

    run_id              BIGINT NOT NULL
        REFERENCES benchmark_runs(run_id)
        ON DELETE CASCADE,

    observation_type    TEXT NOT NULL,

    observed_value      TEXT,

    expected_value      TEXT,

    result              TEXT
        CHECK (
            result IN (
                'pass',
                'fail',
                'unknown',
                'inconclusive'
            )
        ),

    notes               TEXT,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);


-- ============================================================================
-- 12. Useful indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_benchmark_runs_experiment
    ON benchmark_runs (experiment_name);

CREATE INDEX IF NOT EXISTS idx_benchmark_runs_status
    ON benchmark_runs (status);

CREATE INDEX IF NOT EXISTS idx_benchmark_slru_run_time
    ON benchmark_slru (run_id, captured_at);

CREATE INDEX IF NOT EXISTS idx_benchmark_waits_run_time
    ON benchmark_waits (run_id, captured_at);

CREATE INDEX IF NOT EXISTS idx_benchmark_latency_run_time
    ON benchmark_latency (run_id, captured_at);

CREATE INDEX IF NOT EXISTS idx_benchmark_standby_run_time
    ON benchmark_standby (run_id, captured_at);

CREATE INDEX IF NOT EXISTS idx_benchmark_subxact_run_time
    ON benchmark_subtransactions (run_id, captured_at);


-- ============================================================================
-- 13. Experiment summary view
-- ============================================================================

CREATE OR REPLACE VIEW benchmark_run_summary AS
SELECT
    br.run_id,
    br.experiment_name,
    br.run_type,
    br.status,
    br.started_at,
    br.completed_at,

    EXTRACT(
        EPOCH FROM (
            br.completed_at - br.started_at
        )
    ) AS duration_seconds,

    bw.worker_count,
    bw.operations_target,
    bw.operations_completed

FROM benchmark_runs br

LEFT JOIN benchmark_workloads bw
    ON bw.run_id = br.run_id;


-- ============================================================================
-- 14. SLRU delta view
-- ============================================================================

CREATE OR REPLACE VIEW benchmark_slru_deltas AS
SELECT
    run_id,
    slru_name,

    MAX(blks_hit) -
        MIN(blks_hit) AS total_hit_delta,

    MAX(blks_read) -
        MIN(blks_read) AS total_read_delta,

    MAX(blks_written) -
        MIN(blks_written) AS total_write_delta

FROM benchmark_slru

GROUP BY
    run_id,
    slru_name;


-- ============================================================================
-- 15. Wait summary view
-- ============================================================================

CREATE OR REPLACE VIEW benchmark_wait_summary AS
SELECT
    run_id,
    wait_event_type,
    wait_event,
    MAX(waiting_sessions) AS peak_waiting_sessions,
    SUM(
        COALESCE(observed_duration_ms, 0)
    ) AS observed_wait_ms

FROM benchmark_waits

GROUP BY
    run_id,
    wait_event_type,
    wait_event;


-- ============================================================================
-- 16. Documentation
-- ============================================================================

COMMENT ON TABLE benchmark_runs IS
    'One record for each controlled experiment execution.';

COMMENT ON TABLE benchmark_environment IS
    'PostgreSQL version and server configuration used by a benchmark run.';

COMMENT ON TABLE benchmark_slru IS
    'Time-series measurements from pg_stat_slru.';

COMMENT ON TABLE benchmark_waits IS
    'Observed PostgreSQL wait events during benchmark execution.';

COMMENT ON TABLE benchmark_subtransactions IS
    'Observed backend subtransaction state, including overflow status.';

COMMENT ON TABLE benchmark_standby IS
    'Physical-standby replay and read-availability measurements.';


-- ============================================================================
-- END
-- ============================================================================
