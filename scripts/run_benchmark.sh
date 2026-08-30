#!/usr/bin/env bash

# ============================================================================
# run_benchmark.sh
# ============================================================================
# PostgreSQL Subtransaction / MultiXact Investigation
#
# Purpose:
#   Orchestrate a controlled benchmark run:
#
#       1. Create run directory
#       2. Capture environment
#       3. Capture SLRU baseline
#       4. Start wait collection
#       5. Execute workload
#       6. Capture final SLRU statistics
#       7. Calculate SLRU deltas
#       8. Stop monitoring
#       9. Preserve all artifacts
#
# Usage:
#
#   ./scripts/run_benchmark.sh <experiment.sql>
#
# Example:
#
#   ./scripts/run_benchmark.sh sql/experiments/multixact_pressure.sql
#
# Optional:
#
#   WAIT_DURATION=120
#   WAIT_INTERVAL=1
#
# ============================================================================

set -Eeuo pipefail


# ============================================================================
# Configuration
# ============================================================================

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

EXPERIMENT="${1:-}"

WAIT_DURATION="${WAIT_DURATION:-60}"

WAIT_INTERVAL="${WAIT_INTERVAL:-1}"

TIMESTAMP="$(date -u +"%Y%m%dT%H%M%SZ")"


# ============================================================================
# Validation
# ============================================================================

if [[ -z "${EXPERIMENT}" ]]; then
    echo "ERROR: experiment SQL file is required."
    echo
    echo "Usage:"
    echo "  $0 <experiment.sql>"
    exit 1
fi


if [[ ! -f "${PROJECT_ROOT}/${EXPERIMENT}" ]]; then
    echo "ERROR: experiment file does not exist:"
    echo "  ${PROJECT_ROOT}/${EXPERIMENT}"
    exit 1
fi


if ! command -v psql >/dev/null 2>&1; then
    echo "ERROR: psql is not installed."
    exit 1
fi


if [[ -z "${DATABASE_URL:-}" ]] && [[ -z "${PGHOST:-}" ]]; then
    echo "ERROR: PostgreSQL connection information is missing."
    exit 1
fi


# ============================================================================
# Run directory
# ============================================================================

EXPERIMENT_NAME="$(basename "${EXPERIMENT}" .sql)"

RUN_DIR="${PROJECT_ROOT}/results/${EXPERIMENT_NAME}/${TIMESTAMP}"

mkdir -p "${RUN_DIR}"


# ============================================================================
# Log files
# ============================================================================

BENCHMARK_LOG="${RUN_DIR}/benchmark.log"

WAIT_PID=""


# ============================================================================
# Logging
# ============================================================================

log() {
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] $*" \
        | tee -a "${BENCHMARK_LOG}"
}


# ============================================================================
# Cleanup
# ============================================================================

cleanup() {

    if [[ -n "${WAIT_PID}" ]]; then

        if kill -0 "${WAIT_PID}" 2>/dev/null; then
            kill "${WAIT_PID}" 2>/dev/null || true
            wait "${WAIT_PID}" 2>/dev/null || true
        fi

    fi
}

trap cleanup EXIT INT TERM


# ============================================================================
# Safety confirmation
# ============================================================================

echo
echo "============================================================"
echo " CONTROLLED POSTGRESQL BENCHMARK"
echo "============================================================"
echo
echo "Experiment:"
echo "  ${EXPERIMENT}"
echo
echo "Run directory:"
echo "  ${RUN_DIR}"
echo
echo "Wait duration:"
echo "  ${WAIT_DURATION}s"
echo
echo "Wait interval:"
echo "  ${WAIT_INTERVAL}s"
echo
echo "This must only run against dedicated/authorized test systems."
echo

read -r -p "Type RUN-BENCHMARK to continue: " CONFIRM

if [[ "${CONFIRM}" != "RUN-BENCHMARK" ]]; then
    echo "Benchmark cancelled."
    exit 0
fi


# ============================================================================
# Record metadata
# ============================================================================

log "Starting benchmark."

{
    echo "experiment=${EXPERIMENT_NAME}"
    echo "experiment_file=${EXPERIMENT}"
    echo "timestamp=${TIMESTAMP}"
    echo "hostname=$(hostname)"
    echo "user=$(whoami)"
} > "${RUN_DIR}/metadata.txt"


# ============================================================================
# PostgreSQL environment
# ============================================================================

log "Capturing PostgreSQL environment."

psql \
    "${DATABASE_URL:-}" \
    -X \
    -v ON_ERROR_STOP=1 \
    -At \
    -c "
        SELECT 'postgres_version=' || version();
        SELECT 'database=' || current_database();
        SELECT 'user=' || current_user;
        SELECT 'in_recovery=' || pg_is_in_recovery();
    " \
    >> "${RUN_DIR}/metadata.txt"


# ============================================================================
# Baseline SLRU
# ============================================================================

log "Capturing SLRU baseline."

"${PROJECT_ROOT}/scripts/collect_slru.sh" \
    baseline \
    "${RUN_DIR}" \
    >> "${BENCHMARK_LOG}" \
    2>&1


# ============================================================================
# Start wait collector
# ============================================================================

log "Starting wait-event collector."

"${PROJECT_ROOT}/scripts/collect_waits.sh" \
    "${RUN_DIR}" \
    "${WAIT_DURATION}" \
    "${WAIT_INTERVAL}" \
    > "${RUN_DIR}/wait_collector.log" \
    2>&1 &

WAIT_PID="$!"

log "Wait collector PID: ${WAIT_PID}"


# ============================================================================
# Workload start
# ============================================================================

START_TIME="$(date +%s)"

echo "workload_start_epoch=${START_TIME}" \
    >> "${RUN_DIR}/metadata.txt"


log "Executing experiment workload."


# ============================================================================
# Execute SQL experiment
# ============================================================================

set +e

psql \
    "${DATABASE_URL:-}" \
    -X \
    -v ON_ERROR_STOP=1 \
    -v VERBOSITY=verbose \
    -f "${PROJECT_ROOT}/${EXPERIMENT}" \
    > "${RUN_DIR}/workload.log" \
    2>&1

WORKLOAD_EXIT_CODE="$?"

set -e


END_TIME="$(date +%s)"

DURATION_SECONDS="$((END_TIME - START_TIME))"


{
    echo "workload_end_epoch=${END_TIME}"
    echo "workload_duration_seconds=${DURATION_SECONDS}"
    echo "workload_exit_code=${WORKLOAD_EXIT_CODE}"
} >> "${RUN_DIR}/metadata.txt"


# ============================================================================
# Final SLRU
# ============================================================================

log "Capturing final SLRU statistics."

"${PROJECT_ROOT}/scripts/collect_slru.sh" \
    final \
    "${RUN_DIR}" \
    >> "${BENCHMARK_LOG}" \
    2>&1


# ============================================================================
# Calculate SLRU deltas
# ============================================================================

log "Calculating SLRU deltas."

"${PROJECT_ROOT}/scripts/collect_slru.sh" \
    delta \
    "${RUN_DIR}" \
    >> "${BENCHMARK_LOG}" \
    2>&1


# ============================================================================
# Wait collector completion
# ============================================================================

log "Waiting for wait collector."

if [[ -n "${WAIT_PID}" ]]; then

    wait "${WAIT_PID}" || true

    WAIT_PID=""

fi


# ============================================================================
# Capture final wait snapshot
# ============================================================================

log "Capturing final wait snapshot."

psql \
    "${DATABASE_URL:-}" \
    -X \
    -v ON_ERROR_STOP=1 \
    --csv \
    -c "
        SELECT
            clock_timestamp() AS captured_at,
            wait_event_type,
            wait_event,
            count(*) AS waiting_sessions
        FROM pg_stat_activity
        WHERE
            wait_event IS NOT NULL
            AND (
                wait_event LIKE '%SLRU%'
                OR wait_event LIKE '%MultiXact%'
                OR wait_event LIKE '%Subtrans%'
            )
        GROUP BY
            wait_event_type,
            wait_event
        ORDER BY
            waiting_sessions DESC;
    " \
    > "${RUN_DIR}/final_wait_snapshot.csv"


# ============================================================================
# Capture final activity
# ============================================================================

log "Capturing final activity state."

psql \
    "${DATABASE_URL:-}" \
    -X \
    -v ON_ERROR_STOP=1 \
    --csv \
    -c "
        SELECT
            pid,
            usename,
            application_name,
            state,
            xact_start,
            query_start,
            wait_event_type,
            wait_event,
            backend_xid,
            backend_xmin,
            left(query, 200) AS query
        FROM pg_stat_activity
        WHERE
            xact_start IS NOT NULL
        ORDER BY xact_start;
    " \
    > "${RUN_DIR}/final_activity.csv"


# ============================================================================
# Final status
# ============================================================================

if [[ "${WORKLOAD_EXIT_CODE}" -eq 0 ]]; then

    log "Benchmark completed successfully."

    STATUS="completed"

else

    log "Benchmark workload failed."

    STATUS="failed"

fi


echo "status=${STATUS}" \
    >> "${RUN_DIR}/metadata.txt"


# ============================================================================
# Summary
# ============================================================================

log "Benchmark artifacts saved."

echo
echo "============================================================"
echo " BENCHMARK COMPLETE"
echo "============================================================"
echo
echo "Experiment:"
echo "  ${EXPERIMENT_NAME}"
echo
echo "Status:"
echo "  ${STATUS}"
echo
echo "Duration:"
echo "  ${DURATION_SECONDS}s"
echo
echo "Results:"
echo "  ${RUN_DIR}"
echo
echo "Artifacts:"
echo
echo "  metadata.txt"
echo "  benchmark.log"
echo "  workload.log"
echo "  slru_baseline.csv"
echo "  slru_final.csv"
echo "  slru_delta.csv"
echo "  final_wait_snapshot.csv"
echo "  final_activity.csv"
echo "  wait_collector.log"
echo


# ============================================================================
# Exit with workload status
# ============================================================================

exit "${WORKLOAD_EXIT_CODE}"
