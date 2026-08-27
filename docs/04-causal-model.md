# Causal Model

## Independent Mechanisms

The investigation currently models the system as several independent causal chains.

### Width Processing

```text
input
  |
  v
encoding handling
  |
  v
character decoding
  |
  v
Unicode width calculation
  |
  v
line measurement
  |
  v
formatting
  |
  v
aligned output
```

### Exception/Subtransaction Processing

```text
PL/pgSQL EXCEPTION
  |
  v
subtransaction
  |
  v
XID-bearing subtransaction
  |
  v
cached subtransaction ID
  |
  v
cache overflow
  |
  v
pg_subtrans lookup pressure
```

### MultiXact Processing

```text
concurrent compatible row locks
  |
  v
MultiXact creation
  |
  v
MultiXact ID
  |
  +--> offsets
  |
  +--> members
  |
  v
SLRU cache access
  |
  v
possible SLRU reads / LWLock waits
```

### Standby Processing

```text
primary transaction state
  |
  v
RUNNING_XACTS WAL state
  |
  v
standby snapshot construction
  |
  v
STANDBY_SNAPSHOT_READY
  |
  v
hot-standby queries
```

### Hypothesized Interaction

The only currently hypothesized cross-mechanism path is:

```text
application workload
      |
      +--------------------+
      |                    |
      v                    v
string processing     exception-driven loop
                           |
                           v
                    subtransactions
                           |
                           v
                     cache overflow
                           |
                           v
                  pg_subtrans / SLRU
                           |
                           v
                concurrent performance
                           |
                           v
                 possible standby effect
```

This interaction remains an experimental hypothesis.

No direct causal arrow should be added between width functions and subtransaction behavior without evidence.
