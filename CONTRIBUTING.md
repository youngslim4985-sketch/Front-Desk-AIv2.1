# Contributing

Thank you for contributing to the PostgreSQL concurrency, subtransaction,
MultiXact, SLRU, and standby-availability investigation.

This repository is a research and reproducibility project. Contributions
should prioritize measurable evidence, source verification, and reproducible
experiments over speculation.

## Research principles

1. Separate confirmed behavior from hypotheses.
2. Cite PostgreSQL source code or official documentation for implementation
   claims whenever possible.
3. Do not label a mechanism as a production vulnerability without empirical
   evidence demonstrating realistic impact.
4. Keep independent mechanisms separate unless an experiment demonstrates
   interaction between them.
5. Record PostgreSQL version, configuration, hardware, workload, and test
   conditions for benchmark results.
6. Prefer controlled experiments with negative controls.
7. Never run stress or failure experiments against infrastructure you do not
   own or have explicit authorization to test.

## Areas of investigation

The repository currently covers:

- PostgreSQL string-width and formatting behavior
- Unicode display-width handling
- Multi-line `psql` alignment
- Control-character expansion
- Subtransaction creation and caching
- `PGPROC_MAX_CACHED_SUBXIDS`
- `pg_subtrans`
- MultiXact metadata
- SLRU caches
- `pg_stat_slru`
- SLRU-related wait events
- `RUNNING_XACTS`
- Hot-standby snapshot construction
- Replica availability during recovery
- PostgreSQL 17+ SLRU cache configuration
- Concurrency and performance effects

## Adding research

When adding a new finding, include:

### 1. Claim

State exactly what is being claimed.

### 2. Evidence

Identify the source, experiment, or measurement supporting the claim.

### 3. Version

Specify the PostgreSQL version tested or inspected.

### 4. Reproduction

Provide the smallest reproducible test possible.

### 5. Expected result

Explain what should happen if the hypothesis is correct.

### 6. Observed result

Record what actually happened.

### 7. Limitations

Document conditions under which the result may not apply.

## Experimental results

Do not overwrite previous benchmark results.

Store experiment output using the repository's results structure and include
metadata such as:

- PostgreSQL version
- operating system
- hardware
- configuration
- dataset size
- connection count
- transaction size
- test duration
- workload description
- timestamp
- relevant PostgreSQL statistics

Where practical, include both:

- a control workload
- the experimental workload

This makes it possible to distinguish the mechanism being investigated from
normal PostgreSQL overhead.

## Source verification

Implementation claims should identify the relevant PostgreSQL source file,
function, constant, or subsystem.

For example:

```text
src/backend/storage/ipc/procarray.c
PGPROC_MAX_CACHED_SUBXIDS
```

Avoid relying on secondary sources when the PostgreSQL source itself can establish the behavior.

Secondary sources may still be useful for:

- explaining the mechanism
- identifying historical behavior
- suggesting experiments
- providing operational context

## Code standards

SQL should be:

- readable
- deterministic where possible
- safe to run against a dedicated test database
- explicit about destructive operations
- compatible with the PostgreSQL version being tested

Shell scripts should fail clearly when required tools or configuration are missing.

Do not hard-code credentials, passwords, API keys, or production connection strings.

## Safety

Experiments involving:

- transaction storms
- large numbers of savepoints
- MultiXact generation
- replication
- WAL generation
- connection saturation
- long-running transactions
- forced recovery conditions

must be performed only against local, disposable, dedicated, or explicitly authorized PostgreSQL infrastructure.

Never point benchmark or stress scripts at an organization's production database unless explicit authorization has been obtained.

## Pull requests

A useful pull request should explain:

- what changed
- why it changed
- which research question it addresses
- how it was tested
- PostgreSQL versions tested
- whether the result is confirmed, inconclusive, or hypothetical

For experimental changes, include the relevant measurements.

## Research status labels

Use these labels consistently:

- **CONFIRMED**: Directly demonstrated by source inspection, official documentation, or a repeatable experiment.
- **EMPIRICALLY CONFIRMED**: Reproduced experimentally under documented conditions.
- **SOURCE VERIFIED**: Supported by PostgreSQL source inspection but not necessarily reproduced under load.
- **HYPOTHESIS**: Plausible but not yet demonstrated.
- **INCONCLUSIVE**: Testing produced insufficient or conflicting evidence.
- **NOT REPRODUCED**: The proposed behavior was specifically tested but did not occur under the documented conditions.

## Goal

The goal of this repository is not to prove that PostgreSQL is unsafe.

The goal is to determine precisely:

> What happens, under what conditions, why it happens, how it can be measured, and whether the behavior creates a meaningful operational risk.

Evidence should determine the conclusion.
