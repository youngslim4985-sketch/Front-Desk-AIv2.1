#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must be set}"

psql "$DATABASE_URL" \
  -v ON_ERROR_STOP=1 \
  -c "
    SELECT
        now() AS captured_at,
        application_name,
        state,
        sync_state,
        sent_lsn,
        write_lsn,
        flush_lsn,
        replay_lsn,
        write_lag,
        flush_lag,
        replay_lag
    FROM pg_stat_replication
    ORDER BY application_name;
  "
