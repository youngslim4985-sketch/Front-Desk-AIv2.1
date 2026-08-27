-- Verify that PostgreSQL exposes backend subtransaction state.

SELECT
    pid,
    subxact_count,
    subxact_overflow
FROM pg_stat_get_backend_subxact(pg_backend_pid());

-- Expected:
-- query succeeds
-- subxact_count is non-negative
-- subxact_overflow is boolean
