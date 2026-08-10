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

## ElevenLabs Voice Integration

Front Desk AI supports high-fidelity text-to-speech rendering powered by ElevenLabs:

- **Server-Side Key Protection:** The `ELEVENLABS_API_KEY` is maintained exclusively on the server and is never exposed to the client.
- **Dynamic Voice Selection & Preview:** Voice options are fetched via `/api/voice/voices` and can be previewed directly in the Company Profile settings (`VoiceSelector`).
- **Real-Time Call Synthesis:** Spoken call turns synthesize speech via `/api/voice/synthesize` with graceful fallback to browser speech synthesis if the API key is not configured.
- **Environment Configuration:** Set `ELEVENLABS_API_KEY` in your environment (see `.env.example`).

