# Benchmarks

Benchmark workloads used by the PostgreSQL internals experiments.

Each benchmark should document:

- PostgreSQL version
- hardware/environment
- configuration
- dataset size
- concurrency
- transaction size
- number of subtransactions
- MultiXact workload characteristics
- measurement interval
- control workload
- expected observations

Benchmarks must be reproducible and must run only against dedicated
experimental infrastructure.
