# Contributing

Thank you for contributing to this PostgreSQL research project.

The primary objective is reproducible, evidence-driven investigation rather
than speculation.

## Research principles

Contributions should:

1. Clearly distinguish observation from interpretation.
2. Identify the PostgreSQL version tested.
3. Include reproducible SQL where practical.
4. Avoid presenting workload-specific benchmark results as universal behavior.
5. Separate independent PostgreSQL mechanisms.
6. Cite PostgreSQL source or authoritative documentation for implementation
   claims.
7. Include negative controls when making causal claims.

## Code changes

Prefer:

- deterministic SQL
- small experimental workloads
- explicit transaction boundaries
- version-aware diagnostics
- machine-readable result output

Avoid:

- hidden environment dependencies
- destructive production operations
- hard-coded credentials
- benchmark results without methodology
- unexplained configuration changes

## Experiment changes

Every new experiment should document:

```text
Hypothesis
Independent variable
Dependent variables
Control
Treatment
Concurrency
Dataset size
Duration
PostgreSQL version
Expected observation
Interpretation criteria
```

Example:

```text
Hypothesis:
Per-row exception handling increases subtransaction and SLRU overhead.

Control:
Set-based processing without per-row exception blocks.

Treatment:
One top-level transaction containing repeated XID-bearing
exception subtransactions.

Measurements:
transaction duration
subtransaction count
pg_stat_slru deltas
wait events
WAL volume
query latency
```

## Results

Do not manually overwrite previous raw benchmark results.

Prefer timestamped or uniquely identified result files.

Record the configuration used to generate each result.

## Source verification

Implementation claims should identify:

- PostgreSQL version
- source file
- function or symbol
- relevant behavior
- source URL or commit when available

## Pull requests

A useful pull request should explain:

1. What changed?
2. Why was it necessary?
3. How was it tested?
4. What PostgreSQL version was tested?
5. Does it change any research conclusions?

## Security

Never submit:

- database passwords
- connection strings
- API keys
- cloud credentials
- production data
- personally identifiable information

See SECURITY.md.
