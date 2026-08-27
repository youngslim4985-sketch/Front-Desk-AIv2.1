-- Subtransaction overflow experiment
-- Purpose: create XID-bearing subtransactions and observe
-- subtransaction-cache overflow.
--
-- Run ONLY against an isolated test database.

CREATE TEMP TABLE IF NOT EXISTS subxact_test (
    value integer
);

DO $$
DECLARE
    i integer;
BEGIN
    FOR i IN 1..100 LOOP
        BEGIN
            -- Force transactional work inside the exception block.
            INSERT INTO pg_temp.subxact_test(value)
            VALUES (i);
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END LOOP;
END
$$;

SELECT
    s.subxact_count,
    s.subxact_overflow
FROM pg_stat_get_backend_subxact(pg_backend_pid()) AS s;
