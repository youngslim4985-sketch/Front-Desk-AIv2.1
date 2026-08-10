# Front Desk AI — RLS Security Status

Status: Security architecture complete; live database validation pending
Last Updated: 2026-08-10

## Executive Summary

Front Desk AI uses PostgreSQL Row-Level Security (RLS) as the database-level tenant isolation boundary.

The security architecture has been designed around:

- A shared non-owner application database role
- PostgreSQL RLS
- "FORCE ROW LEVEL SECURITY"
- Transaction-local tenant context
- Canonical "app.current_company_id"
- "frontdeskai_current_company_id()" helper
- "USING" and "WITH CHECK" policies
- Composite tenant-aware foreign keys
- SECURITY DEFINER hardening
- Explicit "search_path" / "pg_temp" security requirements
- Two-tenant isolation testing

The conceptual security design is complete.

Important: live PostgreSQL execution has not yet been completed in this environment. Therefore, database-dependent checks remain pending until the target database is tested.

---

## Completed Security Design

### 1. Tenant Context

Tenant identity is not derived from "current_user" or "session_user".

The database role establishes database capabilities.

The tenant context establishes the company boundary.

The canonical runtime setting is:

`app.current_company_id`

Tenant context is intended to be transaction-local.

Example:

```sql
BEGIN;

SELECT pg_catalog.set_config(
  'app.current_company_id',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  true
);

-- Tenant-scoped database operations.

COMMIT;
```

The final "true" argument makes the setting transaction-local.

This prevents tenant context from persisting across pooled application connections.

---

### 2. Canonical Tenant Helper

The canonical helper is designed as:

```sql
CREATE OR REPLACE FUNCTION frontdeskai.frontdeskai_current_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(
    pg_catalog.current_setting('app.current_company_id', true),
    ''
  )::uuid;
$$;
```

Expected behavior:

| Context | Result |
| :--- | :--- |
| Valid UUID | UUID |
| Missing setting | "NULL" |
| Empty setting | "NULL" |
| Malformed UUID | "22P02" error |

Malformed tenant context must not silently become "NULL".

---

### 3. "current_user" / "session_user" Model

The application tenant boundary does not depend on either database identity.

"current_user" represents the active PostgreSQL role.

"session_user" represents the original login role.

The intended production application role must:

- Not be superuser
- Not have "BYPASSRLS"
- Not own tenant tables
- Be subject to RLS

Role validation remains a live-database verification step.

---

### 4. RLS Policy Model

Tenant-scoped tables use the canonical tenant helper.

Representative policy:

```sql
CREATE POLICY customers_tenant_isolation
ON frontdeskai.customers
FOR ALL
TO frontdeskai_app
USING (
  company_id = frontdeskai.frontdeskai_current_company_id()
)
WITH CHECK (
  company_id = frontdeskai.frontdeskai_current_company_id()
);
```

The policy separates responsibilities:

- "TO frontdeskai_app" controls the database role to which the policy applies.
- "USING" controls visible/targetable rows.
- "WITH CHECK" prevents writes from creating or changing rows outside the active tenant.
- "frontdeskai_current_company_id()" provides the tenant boundary.

---

### 5. "SECURITY DEFINER" Security Model

SECURITY DEFINER functions have been reviewed conceptually for:

- Privilege escalation
- "search_path" hijacking
- "pg_temp" shadowing
- Function/operator shadowing
- Role identity changes
- Excessive "EXECUTE" privileges
- PUBLIC execution
- Definer-owner privileges

SECURITY DEFINER functions should use a pinned search path.

Recommended pattern:

```sql
SET search_path = pg_catalog, public, pg_temp;
```

or, where practical:

```sql
SET search_path = pg_catalog, pg_temp;
```

The strictest approach is an empty search path combined with fully qualified object names.

---

### 6. "pg_temp" Security

Temporary schemas are treated as an explicit SECURITY DEFINER threat surface.

For privileged functions:

- "pg_temp" must not precede trusted schemas.
- "pg_temp" should be last when included.
- Unqualified relation references must be reviewed.
- Permanent writable schemas must not precede "pg_catalog" in privileged functions.

The repository includes the conceptual security model for preventing temporary-object shadowing.

---

### 7. SECURITY DEFINER Function Requirements

Every SECURITY DEFINER function must ultimately satisfy:

- Appropriate owner
- Explicit/pinned "search_path"
- "pg_catalog" first where applicable
- "pg_temp" last
- Fully qualified security-sensitive object references
- Minimal "EXECUTE" privileges
- No unnecessary PUBLIC execution
- No reliance on "current_user" as tenant identity

Actual database inventory and privilege verification remain pending.

---

## RLS Test Specification

The RLS test suite is designed around two tenants:

**Company A**  
`aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`

**Company B**  
`bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb`

Tests must execute under the real non-owner application role.

### Required Tests

#### Tenant visibility

- Company A sees Company A rows.
- Company A cannot see Company B rows.
- Company B sees Company B rows.
- Company B cannot see Company A rows.

#### Unfiltered queries

Tenant isolation must remain enforced even when application queries omit an explicit:

`WHERE company_id = ...`

#### INSERT

- Own-tenant insert succeeds.
- Cross-tenant insert fails.

#### UPDATE

- Own-tenant update succeeds.
- Cross-tenant update cannot target another tenant.
- Changing a row from Company A to Company B is rejected.

#### DELETE

- Own-tenant delete succeeds.
- Cross-tenant delete cannot affect another tenant.

#### Tenant context

- Valid context works.
- Missing context fails closed.
- Empty context fails closed.
- Malformed context raises "22P02".

#### Relationship isolation

Composite tenant-aware relationships must prevent:

```
Company A parent
        ↓
Company B child
```

from being created.

This includes "calls" and "appointments" relationships to "customers".

#### JOIN isolation

Queries involving:

- "calls JOIN customers"
- "appointments JOIN customers"

must remain tenant isolated.

---

## Four-Table RLS Scope

The intended RLS boundary covers:

1. "phone_configs"
2. "customers"
3. "calls"
4. "appointments"

Each table must ultimately be verified for:

- RLS enabled
- FORCE RLS
- Correct tenant policy
- Correct "USING"
- Correct "WITH CHECK"
- Correct application-role scope
- Cross-tenant isolation

---

## Current Validation Status

| Area | Status |
| :--- | :--- |
| RLS architecture | 🟢 Complete |
| Tenant-context architecture | 🟢 Complete |
| Canonical helper design | 🟢 Complete |
| "current_user" / "session_user" model | 🟢 Complete |
| SECURITY DEFINER threat model | 🟢 Complete |
| "search_path" security model | 🟢 Complete |
| "pg_temp" threat model | 🟢 Complete |
| RLS test specification | 🟢 Complete |
| SECURITY DEFINER live inventory | 🔴 Pending DB |
| Function privilege audit | 🔴 Pending DB |
| PUBLIC EXECUTE audit | 🔴 Pending DB |
| Schema CREATE audit | 🔴 Pending DB |
| Role/BYPASSRLS validation | 🔴 Pending DB |
| FORCE RLS verification | 🔴 Pending DB |
| "db/test_rls.sql" execution | 🔴 Hard gate |
| Four-table live verification | ⏸️ Blocked |
| Two-tenant live verification | ⏸️ Blocked |
| Application integration verification | ⏸️ Blocked |
| Production hardening | ⏸️ Blocked |

---

## Production Gate

The system must not be declared production-ready solely because the SQL and architecture are correct.

Production readiness requires successful execution against the real PostgreSQL environment.

Required sequence:

```
SECURITY DEFINER inventory
        ↓
Privilege audit
        ↓
Role / BYPASSRLS validation
        ↓
FORCE RLS verification
        ↓
db/test_rls.sql
        ↓
Four-table RLS verification
        ↓
Two-tenant isolation
        ↓
Application integration
        ↓
Production hardening
        ↓
Production
```

Until the live database tests pass, the RLS security gate remains open.
