#!/usr/bin/env bash

# ============================================================================
# collect_waits.sh
# ============================================================================
# PostgreSQL Subtransaction / MultiXact Investigation
#
# Purpose:
#   Continuously sample PostgreSQL wait events during an experiment.
#
# Captures:
#
#   IO:SLRURead
#   MultiXactMemberBuffer
#   MultiXactMemberSLRU
#   MultiXactOffsetBuffer
#   MultiXactOffsetSLRU
#   Subtrans-related SLRU waits
#
# Usage:
#
#   ./scripts/collect_waits.sh <results-directory> [duration] [interval]
#
# Example:
#
#   ./scripts/collect_waits.sh results/my-run 60 1
#
# Meaning:
#
#   results/my-run → output directory
#   60             → collect for 60 seconds
#   1              → sample every 1 second
#
# ============================================================================

set -Eeuo pipefail


# ============================================================================
# Arguments
# ============================================================================

RUN_DIR="${1:-}"
DURATION="${2:-60}"
INTERVAL="${3:-1}"


# ============================================================================
# Validation
# ============================================================================

if [[ -z "${RUN_DIR}" ]]; then
    echo "ERROR: results directory is required."
    echo
    echo "Usage:"
    echo "  $0 <results-directory> [duration] [interval]"
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


if ! [[ "${DURATION}" =~ ^[0-9]+$ ]]; then
    echo "ERROR: duration must be an integer."
    exit 1
fi


if ! [[ "${INTERVAL}" =~ ^[0-9]+([.][0-9]+)?$ ]]; then
    echo "ERROR: interval must be a positive number."
    exit 1
fi


if [[ -z "${DATABASE_URL:-}" ]] && [[ -z "${PGHOST:-}" ]]; then
    echo "ERROR: PostgreSQL connection information is missing."
    echo
    echo "Set DATABASE_URL or standard PG* variables."
    exit 1
fi


# ============================================================================
# Output
# ============================================================================

TIMESTAMP="$(date -u +"%Y%m%dT%H%M%SZ")"

WAIT_FILE="${RUN_DIR}/waits_${TIMESTAMP}.csv"

SUMMARY_FILE="${RUN_DIR}/wait_summary_${TIMESTAMP}.csv"


# ============================================================================
# Header
# ============================================================================

echo "captured_at,pid,usename,application_name,state,wait_event_type,wait_event,query_age_seconds,query" \
    > "${WAIT_FILE}"


echo "captured_at,wait_event_type,wait_event,waiting_sessions" \
    > "${SUMMARY_FILE}"


# ============================================================================
# Monitoring query
# ============================================================================

WAIT_QUERY="
SELECT
    clock_timestamp(),
    pid,
    usename,
    replace(coalesce(application_name, ''), ',', ' '),
    state,
    wait_event_type,
    wait_event,
    round(
        extract(
            epoch FROM (now() - query_start)
        )::numeric,
        3
    ),
    replace(
        replace(
            left(coalesce(query, ''), 200),
            E'\\n',
            ' '
        ),
        ',',
        ' '
    )
FROM pg_stat_activity
WHERE
    wait_event_type IN ('IO', 'LWLock')
    AND (
        wait_event = 'SLRURead'
        OR wait_event LIKE 'MultiXact%'
        OR wait_event LIKE '%Subtrans%'
        OR wait_event LIKE '%SLRU%'
    )
ORDER BY pid;
"


# ============================================================================
# Summary query
# ============================================================================

SUMMARY_QUERY="
SELECT
    clock_timestamp(),
    wait_event_type,
    wait_event,
    count(*)
FROM pg_stat_activity
WHERE
    wait_event_type IN ('IO', 'LWLock')
    AND (
        wait_event = 'SLRURead'
        OR wait_event LIKE 'MultiXact%'
        OR wait_event LIKE '%Subtrans%'
        OR wait_event LIKE '%SLRU%'
    )
GROUP BY
    wait_event_type,
    wait_event
ORDER BY
    count(*) DESC;
"


# ============================================================================
# Start
# ============================================================================

echo
echo "============================================================"
echo " PostgreSQL Wait Collector"
echo "============================================================"
echo
echo "Run directory:"
echo "  ${RUN_DIR}"
echo
echo "Duration:"
echo "  ${DURATION}s"
echo
echo "Interval:"
echo "  ${INTERVAL}s"
echo
echo "Output:"
echo "  ${WAIT_FILE}"
echo


START_TIME="$(date +%s)"
END_TIME="$((START_TIME + DURATION))"


# ============================================================================
# Collection loop
# ============================================================================

while [[ "$(date +%s)" -lt "${END_TIME}" ]]; do

    CAPTURE_TIME="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

    # ------------------------------------------------------------------------
    # Detailed wait observations
    # ------------------------------------------------------------------------

    psql \
        "${DATABASE_URL:-}" \
        -X \
        -v ON_ERROR_STOP=1 \
        -At \
        -F ',' \
        -c "${WAIT_QUERY}" \
        >> "${WAIT_FILE}"


    # ------------------------------------------------------------------------
    # Aggregate wait observations
    # ------------------------------------------------------------------------

    psql \
        "${DATABASE_URL:-}" \
        -X \
        -v ON_ERROR_STOP=1 \
        -At \
        -F ',' \
        -c "${SUMMARY_QUERY}" \
        | while IFS= read -r line; do

            if [[ -n "${line}" ]]; then
                echo "${line}" >> "${SUMMARY_FILE}"
            fi

        done


    sleep "${INTERVAL}"

done


# ============================================================================
# Final status
# ============================================================================

echo
echo "============================================================"
echo " WAIT COLLECTION COMPLETE"
echo "============================================================"
echo
echo "Detailed observations:"
echo "  ${WAIT_FILE}"
echo
echo "Aggregate observations:"
echo "  ${SUMMARY_FILE}"
echo


# ============================================================================
# Simple summary
# ============================================================================

echo "Observed wait-event totals:"
echo

if [[ -s "${SUMMARY_FILE}" ]]; then

    awk -F',' '
        NR > 1 {
            key=$2 "," $3;
            count[key]++;
        }
        END {
            for (key in count)
                print key "," count[key];
        }
    ' "${SUMMARY_FILE}" \
    | sort

else

    echo "No matching SLRU/MultiXact waits were observed."

fi


# ============================================================================
# END
# ============================================================================
