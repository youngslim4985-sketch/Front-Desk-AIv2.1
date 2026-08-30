#!/usr/bin/env bash

# ============================================================================
# run_experiment.sh
# ============================================================================
# PostgreSQL Subtransaction / MultiXact Investigation
#
# Usage:
#
#   ./scripts/run_experiment.sh <experiment-name> <workload-command>
#
# Example:
#
#   ./scripts/run_experiment.sh baseline \
#       "./scripts/run_workload.sh"
#
# ============================================================================

set -Eeuo pipefail


# ============================================================================
# Arguments
# ============================================================================

EXPERIMENT="${1:-}"
shift || true

if [[ -z "${EXPERIMENT}" ]]; then
    echo "ERROR: experiment name is required."
    echo
    echo "Usage:"
    echo "  $0 <experiment-name> <workload-command>"
    exit 1
fi


if [[ "$#" -eq 0 ]]; then
    echo "ERROR: workload command is required."
    echo
    echo "Usage:"
    echo "  $0 <experiment-name> <workload-command>"
    exit 1
fi


# ============================================================================
# Paths
# ============================================================================

ROOT_DIR="$(
    cd "$(dirname "${BASH_SOURCE[0]}")/.."
    pwd
)"


RESULTS_DIR="${ROOT_DIR}/results"
EXPERIMENT_DIR="${RESULTS_DIR}/${EXPERIMENT}"


TIMESTAMP="$(
    date -u +"%Y%m%dT%H%M%SZ"
)"


RUN_DIR="${EXPERIMENT_DIR}/${TIMESTAMP}"


mkdir -p "${RUN_DIR}"


# ============================================================================
# Metadata
# ============================================================================

METADATA="${RUN_DIR}/metadata.txt"


{
    echo "experiment=${EXPERIMENT}"
    echo "timestamp=${TIMESTAMP}"
    echo "hostname=$(hostname)"
    echo "postgres_version=$(psql --version 2>/dev/null || echo unknown)"
    echo "database=${PGDATABASE:-unknown}"
    echo "user=${PGUSER:-unknown}"
    echo "host=${PGHOST:-local}"
    echo "port=${PGPORT:-5432}"
    echo "in_recovery=unknown"
    echo "workload_start_epoch="
    echo "workload_end_epoch="
    echo "workload_duration_seconds="
    echo "workload_exit_code="
    echo "status=running"
} > "${METADATA}"


# ============================================================================
# Capture PostgreSQL recovery state
# ============================================================================

if command -v psql >/dev/null 2>&1; then

    RECOVERY_STATE="$(
        psql \
            -X \
            -Atqc \
            "SELECT pg_is_in_recovery();" \
            2>/dev/null \
            || echo "unknown"
    )"

    sed -i \
        "s/^in_recovery=.*/in_recovery=${RECOVERY_STATE}/" \
        "${METADATA}"

fi


# ============================================================================
# Record experiment command
# ============================================================================

printf '%q ' "$@" \
    > "${RUN_DIR}/experiment_command.txt"

printf '\n' \
    >> "${RUN_DIR}/experiment_command.txt"


# ============================================================================
# Start
# ============================================================================

START_EPOCH="$(date +%s)"

sed -i \
    "s/^workload_start_epoch=.*/workload_start_epoch=${START_EPOCH}/" \
    "${METADATA}"


echo
echo "============================================================"
echo " EXPERIMENT START"
echo "============================================================"
echo
echo "Experiment:"
echo "  ${EXPERIMENT}"
echo
echo "Run directory:"
echo "  ${RUN_DIR}"
echo
echo "Command:"
cat "${RUN_DIR}/experiment_command.txt"
echo


# ============================================================================
# Execute workload
# ============================================================================

WORKLOAD_LOG="${RUN_DIR}/workload.log"


set +e

"$@" \
    > "${WORKLOAD_LOG}" \
    2>&1

WORKLOAD_EXIT_CODE=$?

set -e


# ============================================================================
# Finish
# ============================================================================

END_EPOCH="$(date +%s)"

DURATION="$((END_EPOCH - START_EPOCH))"


sed -i \
    "s/^workload_end_epoch=.*/workload_end_epoch=${END_EPOCH}/" \
    "${METADATA}"

sed -i \
    "s/^workload_duration_seconds=.*/workload_duration_seconds=${DURATION}/" \
    "${METADATA}"

sed -i \
    "s/^workload_exit_code=.*/workload_exit_code=${WORKLOAD_EXIT_CODE}/" \
    "${METADATA}"


if [[ "${WORKLOAD_EXIT_CODE}" -eq 0 ]]; then

    STATUS="completed"

else

    STATUS="failed"

fi


sed -i \
    "s/^status=.*/status=${STATUS}/" \
    "${METADATA}"


# ============================================================================
# Final output
# ============================================================================

echo
echo "============================================================"
echo " EXPERIMENT COMPLETE"
echo "============================================================"
echo

echo "Status:"
echo "  ${STATUS}"

echo

echo "Exit code:"
echo "  ${WORKLOAD_EXIT_CODE}"

echo

echo "Duration:"
echo "  ${DURATION} seconds"

echo

echo "Results:"
echo "  ${RUN_DIR}"

echo

echo "Workload log:"
echo "  ${WORKLOAD_LOG}"

echo


# ============================================================================
# Preserve failure semantics
# ============================================================================

if [[ "${WORKLOAD_EXIT_CODE}" -ne 0 ]]; then

    echo "ERROR: experiment workload failed."
    exit "${WORKLOAD_EXIT_CODE}"

fi


exit 0
