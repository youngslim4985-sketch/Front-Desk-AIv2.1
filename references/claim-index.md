# Claim Index

This file connects conclusions in the research to evidence.

## Display-width subsystem

- `ucs_wcwidth`
- `pg_wcswidth`
- `pg_wcssize`
- `pg_wcsformat`

Primary question:

> Can width/alignment processing itself produce transactional side effects?

Current conclusion:

**No.**

The width-processing path and transaction-management path are separate.

---

## Subtransaction subsystem

Primary question:

> Can repeated XID-bearing subtransactions create cache overflow and
> additional `pg_subtrans` work?

Current conclusion:

**Yes, subject to workload and transaction lifetime.**

Required empirical validation:

- subtransaction count
- overflow flag
- SLRU reads
- wait events
- elapsed time

---

## MultiXact subsystem

Primary question:

> Can concurrent row locking create measurable MultiXact SLRU pressure?

Required empirical validation:

- MultiXactMember reads
- MultiXactOffset reads
- LWLock wait events
- query latency

---

## Standby subsystem

Primary question:

> Can overflowed transaction state delay hot-standby query availability?

Required empirical validation:

- recovery state
- snapshot readiness
- first successful read query
- WAL position
- transaction completion time

---

## Final research rule

Do not combine independent mechanisms into a single vulnerability claim unless
an experiment demonstrates a causal connection under a realistic workload.
