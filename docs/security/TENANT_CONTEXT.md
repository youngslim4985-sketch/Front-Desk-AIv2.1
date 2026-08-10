# Tenant Context

Canonical setting:

`app.current_company_id`

Canonical helper:

`frontdeskai.frontdeskai_current_company_id()`

The application establishes tenant context from trusted authentication/authorization state.

Tenant context is transaction-local.

Preferred:

```sql
SELECT pg_catalog.set_config(
  'app.current_company_id',
  $1::uuid::text,
  true
);
```

Equivalent:

```sql
SET LOCAL app.current_company_id = '...';
```

Never rely on a persistent session-level tenant setting for pooled application connections.

The frontend must not be treated as the authoritative source of tenant authorization.
