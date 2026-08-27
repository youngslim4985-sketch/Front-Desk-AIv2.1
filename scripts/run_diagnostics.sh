#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must be set}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Running PostgreSQL diagnostics..."

psql "$DATABASE_URL" \
  -v ON_ERROR_STOP=1 \
  -f "$ROOT/sql/diagnostics/slru.sql"

psql "$DATABASE_URL" \
  -v ON_ERROR_STOP=1 \
  -f "$ROOT/sql/diagnostics/waits.sql"

psql "$DATABASE_URL" \
  -v ON_ERROR_STOP=1 \
  -f "$ROOT/sql/diagnostics/subtransactions.sql"

psql "$DATABASE_URL" \
  -v ON_ERROR_STOP=1 \
  -f "$ROOT/sql/diagnostics/replication.sql"
