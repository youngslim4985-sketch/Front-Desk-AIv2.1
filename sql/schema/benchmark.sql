-- Benchmark data-generation schema
-- Dedicated experimental database only.

CREATE TABLE IF NOT EXISTS benchmark_rows (
    id          BIGSERIAL PRIMARY KEY,
    payload     TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_benchmark_rows_created
    ON benchmark_rows(created_at);

-- Data generation belongs in the individual experiment files.
