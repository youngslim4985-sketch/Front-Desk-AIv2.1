#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must be set}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

EXPERIMENT="${1:-}"

if [[ -z "$EXPERIMENT" ]]; then
  echo "Usage: $0 <experiment.sql>"
  exit 1
fi

if [[ ! -f "$ROOT/sql/experiments/$EXPERIMENT" ]]; then
  echo "ERROR: experiment not found: $EXPERIMENT"
  exit 1
fi

echo "Running experiment: $EXPERIMENT"

psql "$DATABASE_URL" \
  -v ON_ERROR_STOP=1 \
  -f "$ROOT/sql/experiments/$EXPERIMENT"
