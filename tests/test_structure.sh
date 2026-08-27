#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

required=(
  "README.md"
  "Makefile"
  "docker-compose.yml"
  "sql/diagnostics/slru.sql"
  "sql/diagnostics/waits.sql"
  "sql/diagnostics/subtransactions.sql"
  "sql/diagnostics/replication.sql"
  "sql/experiments/00-baseline.sql"
  "sql/experiments/01-subxact-overflow.sql"
  "sql/schema/results.sql"
)

for file in "${required[@]}"; do
  if [[ ! -f "$ROOT/$file" ]]; then
    echo "FAIL: missing $file"
    exit 1
  fi
done

echo "PASS: repository structure"
