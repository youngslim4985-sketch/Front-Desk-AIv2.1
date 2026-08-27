# Problem Statement

This project investigates whether specific PostgreSQL internal mechanisms can produce measurable performance or availability consequences under pathological workloads.

The investigation focuses on two primary areas.

## Area A — String and Display Processing

PostgreSQL and psql contain character-width and formatting machinery that must correctly represent:

- multibyte characters;
- wide Unicode characters;
- combining characters;
- embedded newlines;
- tabs;
- carriage returns;
- control characters;
- malformed or incomplete sequences.

The relevant implementation includes:

- `ucs_wcwidth()`
- `pg_wcswidth()`
- `pg_wcssize()`
- `pg_wcsformat()`

## Area B — Transaction Metadata

PostgreSQL supports subtransactions for mechanisms including:

- PL/pgSQL `EXCEPTION` blocks;
- savepoints;
- nested transaction scopes.

A backend can cache only a limited number of subtransaction IDs in its process state.

Once that cache overflows, PostgreSQL may rely more heavily on `pg_subtrans` for transaction-parent resolution.

The investigation examines whether this can produce:

- additional SLRU activity;
- increased wait events;
- concurrent-session performance degradation;
- MultiXact-related pressure where applicable;
- delayed standby snapshot availability;
- measurable replica-read availability effects.

## Core Research Question

Under what realistic workloads do these internal mechanisms become externally measurable performance or availability problems?

## Secondary Question

Can apparently unrelated application behavior combine these mechanisms into a single operational risk?

The project intentionally does not assume that such a connection exists.
