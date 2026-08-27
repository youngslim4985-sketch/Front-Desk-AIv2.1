#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must be set}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

for file in "$ROOT"/sql/diagnostics/*.sql; do
  echo "Checking $file"

  psql "$DATABASE_URL" \
    -v ON_ERROR_STOP=1 \
    -f "$file" \
    >/dev/null
done

echo "PASS: diagnostic SQL"
