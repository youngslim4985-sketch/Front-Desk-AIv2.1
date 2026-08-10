# Front Desk AI — Multi-Tenant Receptionist Platform

Front Desk AI is an enterprise AI Receptionist platform featuring document knowledge RAG ingestion, live spoken call interaction logging, appointment scheduling, and telephony routing.

## Security Status

Front Desk AI uses PostgreSQL Row-Level Security (RLS) as the database-level tenant isolation boundary.

Current security architecture includes:

- Transaction-local tenant context
- Canonical tenant-context helper
- FORCE ROW LEVEL SECURITY
- Tenant-aware USING / WITH CHECK policies
- SECURITY DEFINER hardening requirements
- search_path / pg_temp protections
- Composite tenant-aware foreign keys
- Automated tenant-isolation test suite

The RLS test suite must be executed against the target PostgreSQL environment before production security approval.

See:

- [RLS Security Status](docs/security/RLS_SECURITY_STATUS.md)
- [RLS Threat Model](docs/security/RLS_THREAT_MODEL.md)
- [RLS Test Plan](docs/security/RLS_TEST_PLAN.md)
- [SECURITY DEFINER Checklist](docs/security/SECURITY_DEFINER_CHECKLIST.md)
- [Tenant Context Architecture](docs/security/TENANT_CONTEXT.md)
- [RLS Test Suite Script](db/test_rls.sql)
