# Security Policy

## Scope

This repository contains PostgreSQL performance and reliability experiments.

The experiments are intended for controlled environments.

## Authorized environments only

Stress workloads must only be executed against:

- local PostgreSQL instances
- disposable Docker containers
- dedicated benchmark servers
- infrastructure explicitly authorized for testing

Do not execute benchmark or stress scripts against production systems without
explicit authorization.

## Sensitive information

Never commit:

- PostgreSQL passwords
- connection strings containing credentials
- cloud credentials
- API keys
- TLS private keys
- production database dumps
- customer information
- personally identifiable information

Use environment variables or local configuration files excluded by `.gitignore`.

## Destructive operations

Some experiments may intentionally generate:

- large transaction volumes
- many subtransactions
- MultiXact activity
- WAL
- concurrent row locks
- replication traffic
- long-running transactions

These can materially affect system performance.

Run them only on disposable or explicitly authorized infrastructure.

## Replication experiments

Standby experiments may intentionally:

- restart PostgreSQL
- create or remove test replicas
- create replication slots
- generate sustained WAL
- delay snapshot availability

Do not point the experiment configuration at an existing production
replication topology.

## Responsible reporting

If an experiment reveals a previously unknown PostgreSQL security or
availability vulnerability, do not immediately publish exploit details.

First establish:

1. A reproducible minimal case
2. Affected PostgreSQL versions
3. Security versus performance classification
4. Whether the behavior is documented
5. Whether coordinated disclosure is appropriate

## Reporting repository issues

For ordinary repository problems, open a GitHub issue.

Do not include credentials or sensitive infrastructure information in issues.

For sensitive reports, use the project's private security-reporting mechanism
if one has been configured.

## Research boundary

A performance degradation is not automatically a security vulnerability.

The project intentionally distinguishes:

```text
performance regression
        |
        +--> availability impact
        |
        +--> reliability impact
        |
        +--> security impact
```

Each classification requires appropriate evidence.
