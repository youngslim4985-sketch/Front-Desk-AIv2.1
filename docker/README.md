# Research PostgreSQL Environment

This environment provides an isolated PostgreSQL instance for experiments.

## Start

```bash
docker compose up -d
```

## Verify

```bash
docker compose ps
```

## Connect

```bash
psql postgresql://research:research@localhost:5432/research
```

## Stop

```bash
docker compose down
```

## Delete experimental database state

```bash
docker compose down -v
```

The `-v` option permanently removes the Docker volume containing the experimental PostgreSQL data.

## Safety

This environment is intended for research only.

Do not point the experiment scripts at production infrastructure.
