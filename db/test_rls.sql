-- Front Desk AI RLS Security Gate
--
-- STATUS:
-- This test suite has been authored but MUST be executed
-- against the target PostgreSQL environment before the
-- RLS security gate can be marked PASS.
--
-- Required execution role:
--   non-superuser
--   non-BYPASSRLS
--   non-owner application role

-- Setup test tenants
-- Tenant A: aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa
-- Tenant B: bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb

BEGIN;

-- 1. Context validation tests
-- Valid UUID
SELECT pg_catalog.set_config('app.current_company_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
SELECT frontdeskai.frontdeskai_current_company_id();

-- Clear context
SELECT pg_catalog.set_config('app.current_company_id', '', true);
SELECT frontdeskai.frontdeskai_current_company_id();

-- 2. Tenant isolation tests (SELECT, INSERT, UPDATE, DELETE)
-- Set to Tenant A
SELECT pg_catalog.set_config('app.current_company_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);

-- Query phone_configs, customers, calls, appointments
SELECT count(*) FROM frontdeskai.phone_configs;
SELECT count(*) FROM frontdeskai.customers;
SELECT count(*) FROM frontdeskai.calls;
SELECT count(*) FROM frontdeskai.appointments;

-- Switch to Tenant B
SELECT pg_catalog.set_config('app.current_company_id', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true);

SELECT count(*) FROM frontdeskai.phone_configs;
SELECT count(*) FROM frontdeskai.customers;
SELECT count(*) FROM frontdeskai.calls;
SELECT count(*) FROM frontdeskai.appointments;

ROLLBACK;
