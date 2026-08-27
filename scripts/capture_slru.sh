#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must be set}"

INTERVAL="${1:-10}"
COUNT="${2:-6}"

for ((i=1; i<=COUNT; i++)); do
  echo "=== SLRU sample $i/$COUNT ==="

  psql "$DATABASE_URL" \
    -v ON_ERROR_STOP=1 \
    -c "
      SELECT
          now() AS captured_at,
          name,
          blks_hit,
          blks_read,
          blks_written
      FROM pg_stat_slru
      WHERE name IN (
          'Subtrans',
          'MultiXactMember',
          'MultiXactOffset'
      )
      ORDER BY name;
    "

  sleep "$INTERVAL"
done
