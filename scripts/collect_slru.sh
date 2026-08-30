#!/usr/bin/env bash

# ============================================================================
# collect_slru.sh
# ============================================================================
# PostgreSQL Subtransaction / MultiXact Investigation
#
# Purpose:
#   Capture pg_stat_slru measurements for:
#
#       Subtrans
#       MultiXactMember
#       MultiXactOffset
#
#   The script supports:
#
#       baseline capture
#       post-workload capture
#       interval delta calculation
#
# Usage:
#
#   ./scripts/collect_slru.sh baseline results/run
#
#   ./scripts/collect_slru.sh final results/run
#
#   ./scripts/collect_slru.sh delta results/run
#
# Environment:
#
#   DATABASE_URL
#   or standard PostgreSQL PG* variables
#
# SECURITY:
#   Never place database credentials directly in this script.
# ============================================================================

set -Eeuo pipefail


# ============================================================================
# Configuration
# ============================================================================

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

MODE="${1:-}"

RUN_DIR="${2:-}"


# ============================================================================
# Validation
# ============================================================================

if [[ -z "${MODE}" ]]; then
    echo "ERROR: capture mode is required."
    echo
    echo "Usage:"
    echo "  $0 baseline <results-directory>"
    echo "  $0 final <results-directory>"
    echo "  $0 delta <results-directory>"
    exit 1
fi


case "${MODE}" in
    baseline|final|delta)
        ;;
    *)
        echo "ERROR: invalid mode: ${MODE}"
        echo
        echo "Valid modes:"
        echo "  baseline"
        echo "  final"
        echo "  delta"
        exit 1
        ;;
esac


if [[ -z "${RUN_DIR}" ]]; then
    echo "ERROR: results directory is required."
    exit 1
fi


if [[ ! -d "${RUN_DIR}" ]]; then
    echo "ERROR: results directory does not exist:"
    echo "  ${RUN_DIR}"
    exit 1
fi


if ! command -v psql >/dev/null 2>&1; then
    echo "ERROR: psql is not installed or not in PATH."
    exit 1
fi


if [[ -z "${DATABASE_URL:-}" ]] && [[ -z "${PGHOST:-}" ]]; then
    echo "ERROR: PostgreSQL connection information is missing."
    echo
    echo "Set DATABASE_URL or standard PG* variables."
    exit 1
fi


# ============================================================================
# Output files
# ============================================================================

BASELINE_FILE="${RUN_DIR}/slru_baseline.csv"
FINAL_FILE="${RUN_DIR}/slru_final.csv"
DELTA_FILE="${RUN_DIR}/slru_delta.csv"


# ============================================================================
# SLRU query
# ============================================================================

SLRU_QUERY="
SELECT
    clock_timestamp() AS captured_at,
    name,
    blks_hit,
    blks_read,
    blks_written,
    stats_reset
FROM pg_stat_slru
WHERE name IN (
    'Subtrans',
    'MultiXactMember',
    'MultiXactOffset'
)
ORDER BY name;
"


# ============================================================================
# Baseline
# ============================================================================

if [[ "${MODE}" == "baseline" ]]; then

    echo "Capturing baseline SLRU statistics..."

    psql \
        "${DATABASE_URL:-}" \
        -X \
        -v ON_ERROR_STOP=1 \
        --csv \
        -c "${SLRU_QUERY}" \
        > "${BASELINE_FILE}"

    echo
    echo "Baseline saved:"
    echo "  ${BASELINE_FILE}"

    exit 0
fi


# ============================================================================
# Final
# ============================================================================

if [[ "${MODE}" == "final" ]]; then

    echo "Capturing final SLRU statistics..."

    psql \
        "${DATABASE_URL:-}" \
        -X \
        -v ON_ERROR_STOP=1 \
        --csv \
        -c "${SLRU_QUERY}" \
        > "${FINAL_FILE}"

    echo
    echo "Final statistics saved:"
    echo "  ${FINAL_FILE}"

    exit 0
fi


# ============================================================================
# Delta calculation
# ============================================================================

if [[ "${MODE}" == "delta" ]]; then

    if [[ ! -f "${BASELINE_FILE}" ]]; then
        echo "ERROR: baseline file not found:"
        echo "  ${BASELINE_FILE}"
        exit 1
    fi

    if [[ ! -f "${FINAL_FILE}" ]]; then
        echo "ERROR: final file not found:"
        echo "  ${FINAL_FILE}"
        exit 1
    fi

    echo "Calculating SLRU interval deltas..."


    python3 - \
        "${BASELINE_FILE}" \
        "${FINAL_FILE}" \
        "${DELTA_FILE}" <<'PY'

import csv
import sys


baseline_path = sys.argv[1]
final_path = sys.argv[2]
output_path = sys.argv[3]


def load_csv(path):
    with open(path, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    return {
        row["name"]: row
        for row in rows
    }


baseline = load_csv(baseline_path)
final = load_csv(final_path)


slru_names = [
    "Subtrans",
    "MultiXactMember",
    "MultiXactOffset",
]


output_fields = [
    "name",
    "hit_delta",
    "read_delta",
    "write_delta",
    "interval_hit_pct",
]


with open(
    output_path,
    "w",
    newline="",
    encoding="utf-8",
) as f:

    writer = csv.DictWriter(
        f,
        fieldnames=output_fields,
    )

    writer.writeheader()

    for name in slru_names:

        if name not in baseline:
            continue

        if name not in final:
            continue

        base = baseline[name]
        cur = final[name]

        base_hit = int(base["blks_hit"])
        base_read = int(base["blks_read"])
        base_write = int(base["blks_written"])

        cur_hit = int(cur["blks_hit"])
        cur_read = int(cur["blks_read"])
        cur_write = int(cur["blks_written"])

        hit_delta = cur_hit - base_hit
        read_delta = cur_read - base_read
        write_delta = cur_write - base_write

        total = hit_delta + read_delta

        if total > 0:
            hit_pct = round(
                100.0 * hit_delta / total,
                2,
            )
        else:
            hit_pct = None

        writer.writerow({
            "name": name,
            "hit_delta": hit_delta,
            "read_delta": read_delta,
            "write_delta": write_delta,
            "interval_hit_pct": hit_pct,
        })


print(f"Delta results written to {output_path}")

PY

    echo
    echo "SLRU delta results:"
    echo

    cat "${DELTA_FILE}"

    echo
    echo "Saved:"
    echo "  ${DELTA_FILE}"

fi
