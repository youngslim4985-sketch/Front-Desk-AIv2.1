#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must be set}"

INTERVAL="${1:-1}"
COUNT="${2:-30}"

for ((i=1; i<=COUNT; i++)); do
  psql "$DATABASE_URL" \
    -v ON_ERROR_STOP=1 \
    -c "
      SELECT
          now() AS captured_at,
          pid,
          wait_event_type,
          wait_event,
          state
      FROM pg_stat_activity
      WHERE wait_event IS NOT NULL
      ORDER BY pid;
    "

  sleep "$INTERVAL"
done
