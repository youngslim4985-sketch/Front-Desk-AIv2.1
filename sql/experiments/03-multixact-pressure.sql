-- MultiXact pressure experiment
-- Purpose: generate concurrent row-lock activity.
--
-- This script is intentionally a setup point.
-- Concurrent sessions should execute the locking workload.

CREATE TABLE IF NOT EXISTS experiment_lock_target (
    id integer PRIMARY KEY,
    value integer NOT NULL DEFAULT 0
);

INSERT INTO experiment_lock_target (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- Session workload:
BEGIN;

SELECT *
FROM experiment_lock_target
WHERE id = 1
FOR KEY SHARE;

-- Keep transaction open while other sessions perform
-- compatible row-lock operations.

-- COMMIT after the observation window.
