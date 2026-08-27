-- Experimental results schema
-- Dedicated research database only.

CREATE TABLE IF NOT EXISTS experiment_runs (
    run_id              BIGSERIAL PRIMARY KEY,
    experiment_name     TEXT NOT NULL,
    started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at         TIMESTAMPTZ,
    postgres_version    TEXT NOT NULL,
    host_info           JSONB,
    configuration      JSONB,
    notes               TEXT
);

CREATE TABLE IF NOT EXISTS measurements (
    measurement_id      BIGSERIAL PRIMARY KEY,
    run_id              BIGINT NOT NULL
                        REFERENCES experiment_runs(run_id)
                        ON DELETE CASCADE,
    captured_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    metric              TEXT NOT NULL,
    value               NUMERIC,
    unit                 TEXT,
    labels               JSONB
);

CREATE TABLE IF NOT EXISTS wait_samples (
    sample_id           BIGSERIAL PRIMARY KEY,
    run_id              BIGINT NOT NULL
                        REFERENCES experiment_runs(run_id)
                        ON DELETE CASCADE,
    captured_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    pid                 INTEGER,
    wait_event_type     TEXT,
    wait_event          TEXT,
    query_age_ms        NUMERIC,
    query               TEXT
);

CREATE TABLE IF NOT EXISTS slru_samples (
    sample_id           BIGSERIAL PRIMARY KEY,
    run_id              BIGINT NOT NULL
                        REFERENCES experiment_runs(run_id)
                        ON DELETE CASCADE,
    captured_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    name                TEXT NOT NULL,
    blks_hit            BIGINT,
    blks_read           BIGINT,
    blks_written        BIGINT,
    flushes             BIGINT,
    truncates           BIGINT
);

CREATE TABLE IF NOT EXISTS replication_samples (
    sample_id           BIGSERIAL PRIMARY KEY,
    run_id              BIGINT NOT NULL
                        REFERENCES experiment_runs(run_id)
                        ON DELETE CASCADE,
    captured_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    application_name    TEXT,
    state               TEXT,
    sync_state          TEXT,
    sent_lsn            PG_LSN,
    write_lsn           PG_LSN,
    flush_lsn           PG_LSN,
    replay_lsn          PG_LSN,
    replay_lag          INTERVAL
);

CREATE INDEX IF NOT EXISTS idx_measurements_run
    ON measurements(run_id, captured_at);

CREATE INDEX IF NOT EXISTS idx_wait_samples_run
    ON wait_samples(run_id, captured_at);

CREATE INDEX IF NOT EXISTS idx_slru_samples_run
    ON slru_samples(run_id, captured_at);

CREATE INDEX IF NOT EXISTS idx_replication_samples_run
    ON replication_samples(run_id, captured_at);
