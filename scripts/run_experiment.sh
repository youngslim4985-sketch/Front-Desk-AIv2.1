#!/usr/bin/env bash

# ============================================================================
# run_experiment.sh
# ============================================================================
# PostgreSQL Subtransaction / MultiXact Investigation
#
# Purpose:
#   Execute one experiment SQL file consistently and preserve its output.
#
# Usage:
#
#   ./scripts/run_experiment.sh sql/experiments/concurrent_waits.sql
#
# Optional:
#
#   DATABASE_URL="postgresql://..." \
#   ./scripts/run_experiment.sh sql/experiments/concurrent_waits.sql
#
# Environment:
#
#   DATABASE_URL   PostgreSQL connection string
#   PGHOST         PostgreSQL host
#   PGPORT         PostgreSQL port
#   PGDATABASE     PostgreSQL database
#   PGUSER         PostgreSQL user
#
# SECURITY:
#   Never commit DATABASE_URL, passwords, certificates, or credentials.
# ============================================================================

set -Eeuo pipefail


# ============================================================================
# Configuration
# ============================================================================

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

RESULTS_DIR="${PROJECT_ROOT}/results"

TIMESTAMP="$(date -u +"%Y%m%dT%H%M%SZ")"

EXPERIMENT="${1:-}"

PGOPTIONS="${PGOPTIONS:-}"


# ============================================================================
# Validation
# ============================================================================

if [[ -z "${EXPERIMENT}" ]]; then
    echo "ERROR: experiment SQL file is required."
    echo
    echo "Usage:"
    echo "  ./scripts/run_experiment.sh <experiment.sql>"
    echo
    exit 1
fi


if [[ ! -f "${PROJECT_ROOT}/${EXPERIMENT}" ]]; then
    echo "ERROR: experiment file does not exist:"
    echo "  ${PROJECT_ROOT}/${EXPERIMENT}"
    exit 1
fi


if ! command -v psql >/dev/null 2>&1; then
    echo "ERROR: psql is not installed or not in PATH."
    exit 1
fi


# ============================================================================
# Database connection validation
# ============================================================================

if [[ -z "${DATABASE_URL:-}" ]] && [[ -z "${PGHOST:-}" ]]; then
    echo "ERROR: PostgreSQL connection information is missing."
    echo
    echo "Set DATABASE_URL or the standard PG* environment variables."
    exit 1
fi


# ============================================================================
# Safety confirmation
# ============================================================================

echo
echo "============================================================"
echo " PostgreSQL Experiment Runner"
echo "============================================================"
echo
echo "Experiment:"
echo "  ${EXPERIMENT}"
echo
echo "Timestamp:"
echo "  ${TIMESTAMP}"
echo
echo "Results:"
echo "  ${RESULTS_DIR}"
echo
echo "WARNING:"
echo "  This script executes database experiment SQL."
echo "  Use only dedicated/authorized test infrastructure."
echo
read -r -p "Type RUN-EXPERIMENT to continue: " CONFIRM

if [[ "${CONFIRM}" != "RUN-EXPERIMENT" ]]; then
    echo "Experiment cancelled."
    exit 0
fi


# ============================================================================
# Result directory
# ============================================================================

EXPERIMENT_NAME="$(basename "${EXPERIMENT}" .sql)"

RUN_DIR="${RESULTS_DIR}/${EXPERIMENT_NAME}/${TIMESTAMP}"

mkdir -p "${RUN_DIR}"


# ============================================================================
# Metadata
# ============================================================================

METADATA_FILE="${RUN_DIR}/metadata.txt"

{
    echo "experiment=${EXPERIMENT_NAME}"
    echo "experiment_file=${EXPERIMENT}"
    echo "timestamp=${TIMESTAMP}"
    echo "hostname=$(hostname)"
    echo "user=$(whoami)"
    echo "working_directory=$(pwd)"
} > "${METADATA_FILE}"


# ============================================================================
# Capture PostgreSQL version
# ============================================================================

echo
echo "Capturing PostgreSQL environment..."

psql \
    "${DATABASE_URL:-}" \
    -X \
    -v ON_ERROR_STOP=1 \
    -Atc "
        SELECT
            'postgres_version=' || version();

        SELECT
            'database=' || current_database();

        SELECT
            'user=' || current_user;

        SELECT
            'in_recovery=' || pg_is_in_recovery();
    " \
    >> "${METADATA_FILE}"


# ============================================================================
# Record start time
# ============================================================================

START_EPOCH="$(date +%s)"

echo "started_epoch=${START_EPOCH}" >> "${METADATA_FILE}"


# ============================================================================
# Execute experiment
# ============================================================================

OUTPUT_FILE="${RUN_DIR}/experiment.log"

echo
echo "Running experiment..."
echo

set +e

psql \
    "${DATABASE_URL:-}" \
    -X \
    -v ON_ERROR_STOP=1 \
    -v VERBOSITY=verbose \
    -f "${PROJECT_ROOT}/${EXPERIMENT}" \
    2>&1 | tee "${OUTPUT_FILE}"

EXIT_CODE="${PIPESTATUS[0]}"

set -e


# ============================================================================
# Record completion
# ============================================================================

END_EPOCH="$(date +%s)"

DURATION_SECONDS="$((END_EPOCH - START_EPOCH))"

{
    echo "completed_epoch=${END_EPOCH}"
    echo "duration_seconds=${DURATION_SECONDS}"
    echo "exit_code=${EXIT_CODE}"
} >> "${METADATA_FILE}"


# ============================================================================
# Generate final status
# ============================================================================

if [[ "${EXIT_CODE}" -eq 0 ]]; then

    echo
    echo "============================================================"
    echo " EXPERIMENT COMPLETED"
    echo "============================================================"
    echo
    echo "Experiment:"
    echo "  ${EXPERIMENT_NAME}"
    echo
    echo "Duration:"
    echo "  ${DURATION_SECONDS}s"
    echo
    echo "Results:"
    echo "  ${RUN_DIR}"
    echo

else

    echo
    echo "============================================================"
    echo " EXPERIMENT FAILED"
    echo "============================================================"
    echo
    echo "Experiment:"
    echo "  ${EXPERIMENT_NAME}"
    echo
    echo "Exit code:"
    echo "  ${EXIT_CODE}"
    echo
    echo "Log:"
    echo "  ${OUTPUT_FILE}"
    echo

fi


# ============================================================================
# Exit with experiment status
# ============================================================================

exit "${EXIT_CODE}"
