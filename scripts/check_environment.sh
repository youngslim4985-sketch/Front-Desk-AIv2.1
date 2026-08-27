#!/usr/bin/env bash
set -euo pipefail

echo "PostgreSQL research environment"
echo "=============================="

command -v psql >/dev/null || {
  echo "ERROR: psql is not installed"
  exit 1
}

psql --version
echo

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "WARNING: DATABASE_URL is not set"
else
  echo "DATABASE_URL: configured"
fi
