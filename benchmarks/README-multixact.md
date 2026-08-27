# MultiXact Benchmark

## Objective

Measure MultiXact metadata/cache behavior under concurrent row locking.

## Variables

- number of clients
- target rows
- lock type
- transaction duration
- iterations
- PostgreSQL version
- SLRU cache configuration

## Measurements

- `MultiXactMember.blks_read`
- `MultiXactMember.blks_hit`
- `MultiXactOffset.blks_read`
- `MultiXactOffset.blks_hit`
- MultiXact LWLock waits
- query latency
- throughput
