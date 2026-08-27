# Changelog

All notable changes to this research repository will be documented here.

## [Unreleased]

### Added

- Initial research repository structure.
- Research boundary separating display-width processing,
  subtransactions, SLRU behavior, MultiXact behavior, and hot-standby
  snapshot availability.
- Initial reproducibility and safety requirements.
- Initial documentation and experiment architecture.

### Research status

Source-level research is substantially complete.

Empirical validation remains pending.

Planned validation includes:

- controlled subtransaction overflow
- `pg_subtrans` SLRU measurements
- MultiXact cache-pressure experiments
- SLRU wait-event correlation
- concurrent-session measurements
- hot-standby readiness experiments
- negative controls

## [0.1.0] — Initial Scaffold

Initial research scaffold containing:

- documentation structure
- diagnostic SQL structure
- experiment structure
- result schema
- benchmark configuration
- test structure
- Docker development environment
- Makefile orchestration
