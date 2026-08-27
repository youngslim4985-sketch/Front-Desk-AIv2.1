# Subtransactions in PostgreSQL: PL/pgSQL EXCEPTION & Savepoints

## Overview

Subtransactions allow a single top-level PostgreSQL transaction to create nested rollback boundaries.

They are generated either explicitly via SQL `SAVEPOINT` or implicitly whenever a PL/pgSQL block includes an `EXCEPTION` clause.

---

## 1. Mechanism of PL/pgSQL EXCEPTION Blocks

In PL/pgSQL, every block with an `EXCEPTION` section is wrapped in an internal subtransaction:

```sql
BEGIN
    -- Code execution
EXCEPTION
    WHEN others THEN
        -- Rollback handler
END;
```

Internally, the PL/pgSQL execution engine (`src/pl/plpgsql/src/pl_exec.c`) executes:

```c
/*
 * exec_stmt_block in pl_exec.c
 */
if (block->exceptions != NULL)
{
    /* Establish internal savepoint */
    BeginInternalSubTransaction(NULL);
    
    PG_TRY();
    {
        /* Execute statements inside block */
    }
    PG_CATCH();
    {
        /* Rollback subtransaction on error */
        RollbackAndReleaseCurrentSubTransaction();
        /* Re-raise or execute exception handlers */
    }
    PG_END_TRY();
    
    ReleaseCurrentSubTransaction();
}
```

---

## 2. XID Assignment Rules

A subtransaction does **not** immediately consume a 32-bit Transaction ID (`FullTransactionId` / `TransactionId`).

- **Read-Only Subtransaction**: If no catalog changes, table writes, or sequence operations occur inside the subtransaction, it remains virtual (no XID allocated).
- **Write Subtransaction**: As soon as a DML statement (`INSERT`, `UPDATE`, `DELETE`) or explicit `GetNewTransactionId()` call occurs within the subtransaction, the subtransaction is assigned a real XID.

```text
Top-Level Transaction (XID = 1000)
    |
    +---> Subtransaction 1 (Read-only) -> No XID assigned
    |
    +---> Subtransaction 2 (Writes row) -> SubXID = 1001 assigned
          Parent recorded as 1000
```

---

## 3. The PL/pgSQL Loop Anti-Pattern

When PL/pgSQL code processes rows in a loop with an `EXCEPTION` block that performs writes (or catches errors during writes):

```sql
CREATE OR REPLACE FUNCTION ingest_batch(items jsonb[]) RETURNS void AS $$
DECLARE
    item jsonb;
BEGIN
    FOREACH item IN ARRAY items LOOP
        BEGIN
            INSERT INTO records (id, payload)
            VALUES ((item->>'id')::int, item);
        EXCEPTION WHEN unique_violation THEN
            -- Each caught exception creates an XID-bearing subtransaction!
            INSERT INTO record_errors (id, err)
            VALUES ((item->>'id')::int, SQLERRM);
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
```

### Consequences:
1. Every iteration enters `BeginInternalSubTransaction()`.
2. Every exception triggers `RollbackAndReleaseCurrentSubTransaction()`, leaving a rolled-back subXID.
3. Every write in the handler assigns a new SubXID.
4. After 64 subtransactions with XIDs in a single outer transaction, the backend overflows its fixed shared memory array (`PGPROC_MAX_CACHED_SUBXIDS = 64`).

---

## 4. Alternative Architectural Patterns

| Pattern | Subtransactions Generated | SLRU Pressure | Performance Profile |
|---|---|---|---|
| Per-row `EXCEPTION` in loop | $N$ subtransactions | High (SLRU cache thrashing after 64) | Poor (O(N) lock / SLRU overhead) |
| `INSERT ... ON CONFLICT DO NOTHING` | 0 subtransactions | Zero | Maximum (single transaction / set-based) |
| Batch Validation via CTEs | 0 subtransactions | Zero | High (pure relational set evaluation) |
| App-level batching with retries | 1 per batch | Zero | High (isolated transaction boundaries) |
