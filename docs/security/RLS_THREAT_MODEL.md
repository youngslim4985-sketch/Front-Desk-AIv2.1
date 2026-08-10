# RLS Threat Model

## Threats
- Cross-tenant SELECT
- Cross-tenant INSERT
- Cross-tenant UPDATE
- Cross-tenant DELETE
- Tenant reassignment
- Missing tenant context
- Malformed tenant context
- Connection-pool context leakage
- SECURITY DEFINER privilege escalation
- search_path hijacking
- pg_temp shadowing
- Excessive EXECUTE privileges
- PUBLIC EXECUTE
- Table-owner RLS bypass
- BYPASSRLS
- Superuser bypass

## Security Boundaries

```
Application authentication
        ↓
Trusted tenant resolution
        ↓
Transaction-local GUC
        ↓
PostgreSQL RLS
        ↓
Tenant data
```

## Non-Goals

- Database roles are not tenants.
- current_user is not tenant identity.
- session_user is not tenant identity.
- Frontend-supplied company_id is not trusted.
