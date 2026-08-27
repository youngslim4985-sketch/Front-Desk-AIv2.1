#!/usr/bin/env bash
set -euo pipefail

if [[ "${ALLOW_EXPERIMENTS:-}" != "YES_I_AM_USING_DEDICATED_INFRASTRUCTURE" ]]; then
  echo "REFUSED: experimental workloads require dedicated/authorized infrastructure."
  echo
  echo "Set:"
  echo "  ALLOW_EXPERIMENTS=YES_I_AM_USING_DEDICATED_INFRASTRUCTURE"
  echo
  echo "Do not run stress experiments against production."
  exit 1
fi

echo "Safety gate passed."
