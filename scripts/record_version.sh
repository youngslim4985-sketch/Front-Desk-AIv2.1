#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must be set}"

psql "$DATABASE_URL" \
  -v ON_ERROR_STOP=1 \
  -c "
    SELECT
        version(),
        current_setting('server_version') AS server_version,
        current_setting('server_version_num') AS server_version_num;
  "
