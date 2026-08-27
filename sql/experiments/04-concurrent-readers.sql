-- Concurrent reader experiment
-- Purpose: measure read latency while transaction/subtransaction
-- pressure exists elsewhere.

SELECT
    clock_timestamp() AS started_at;

SELECT
    count(*)
FROM experiment_lock_target;

SELECT
    clock_timestamp() AS finished_at;
