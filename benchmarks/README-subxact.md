# Subtransaction Benchmark

## Objective

Measure the performance and system-level effects of creating many
XID-bearing subtransactions inside one top-level transaction.

## Variables

- subtransaction count
- rows processed
- transaction duration
- concurrency
- PostgreSQL version
- SLRU configuration

## Compare

### Control

Set-based operation without per-row exception handling.

### Treatment

Equivalent workload using per-row exception/subtransaction handling.

## Measurements

- elapsed time
- rows/second
- WAL generated
- `Subtrans.blks_read`
- `Subtrans.blks_hit`
- `subxact_overflow`
- wait events
- CPU
- I/O

## Requirement

Run multiple repetitions and report variance rather than relying on one run.
