# Security Policy

## Purpose

This repository contains PostgreSQL research, diagnostic queries, benchmarks,
and controlled experiments involving:

- subtransactions
- MultiXacts
- SLRU caches
- MVCC visibility
- WAL and `RUNNING_XACTS`
- hot-standby recovery
- replication behavior
- concurrency and performance

Some experiments intentionally generate high transaction, lock, WAL, or SLRU
activity.

These experiments can place significant load on PostgreSQL.

## Authorized testing only

All experiments must be performed only against:

- a local PostgreSQL installation
- a disposable test database
- dedicated research infrastructure
- infrastructure for which explicit authorization has been obtained

**Do not run stress experiments against production systems without explicit
authorization.**

## No credentials in the repository

Never commit:

- database passwords
- connection strings containing credentials
- API keys
- cloud credentials
- SSH keys
- certificates containing private keys
- production configuration
- private customer data

Use environment variables or local configuration files that are excluded
from Git.

Example:

```bash
export PGHOST=localhost
export PGPORT=5432
export PGDATABASE=postgres
export PGUSER=postgres
```

Do not place passwords directly into scripts.

## Experiment safety

Before running an experiment, verify:

1. The PostgreSQL instance is authorized for testing.
2. The database is not a production workload.
3. Sufficient disk space is available.
4. Sufficient memory is available.
5. WAL growth is understood.
6. Replication impact is understood if a standby is involved.
7. Connection limits are appropriate.
8. The experiment has a defined stopping condition.

Experiments involving large transactions or subtransaction storms should have an explicit transaction-size limit and timeout.

## Replication experiments

Replication experiments may generate substantial WAL and can affect standby recovery behavior.

Before testing:

- confirm the primary and standby are dedicated to the experiment
- monitor WAL generation
- monitor replication lag
- monitor disk usage
- monitor recovery state
- stop the experiment if resource exhaustion becomes likely

Do not intentionally exhaust storage or other shared infrastructure.

## Reporting a security issue

If research performed with this repository identifies a genuine PostgreSQL security vulnerability rather than a performance or availability concern, do not immediately publish exploit details.

First determine whether the behavior is:

- already documented
- already fixed
- configuration-dependent
- version-specific
- an expected operational limitation
- a genuine security boundary violation

For suspected PostgreSQL vulnerabilities, follow the PostgreSQL project's responsible disclosure process.

## Research classification

Findings should be classified conservatively.

### Source verified
The behavior is established by PostgreSQL source inspection.

### Experimentally verified
The behavior has been reproduced under documented conditions.

### Performance issue
The behavior affects latency, throughput, resource consumption, or concurrency but does not cross a security boundary.

### Availability issue
The behavior can prevent or delay service availability under specific conditions.

### Security vulnerability
The behavior violates a security boundary or permits unauthorized access, modification, disclosure, or execution.

Do not classify a performance characteristic as a security vulnerability without evidence supporting that classification.

## Data handling

Do not use confidential, personal, proprietary, or production customer data for experiments.

Synthetic datasets should be used whenever possible.

## Responsible research

The objective of this project is to understand PostgreSQL behavior accurately and reproducibly.

Claims should be supported by:

- PostgreSQL source
- official PostgreSQL documentation
- controlled experiments
- measured system behavior

Speculation should be clearly identified as speculation.
