# RLS Tenant Isolation Test Plan

## Tenant A
UUID: `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`

## Tenant B
UUID: `bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb`

## Required Tables
- `phone_configs`
- `customers`
- `calls`
- `appointments`

## Test Categories

### Identity
- `current_user`
- `session_user`
- `rolsuper`
- `rolbypassrls`
- ownership

### Context
- valid
- missing
- empty
- malformed

### SELECT
- own tenant
- other tenant
- unfiltered

### INSERT
- own tenant
- other tenant

### UPDATE
- own tenant
- other tenant
- tenant reassignment

### DELETE
- own tenant
- other tenant

### Relationships
- composite FK
- JOIN isolation

### Symmetry
- A → B
- B → A
