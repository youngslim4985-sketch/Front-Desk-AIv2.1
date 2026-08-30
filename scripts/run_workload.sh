#!/usr/bin/env bash

# ============================================================================
# run_workload.sh
# ============================================================================
# PostgreSQL Subtransaction / MultiXact Investigation
#
# Purpose:
#   Execute the configured PostgreSQL workload.
#
# This script intentionally does NOT contain experiment-specific conclusions.
# It only executes the workload and returns its exit status.
#
# Environment variables:
#
#   PGHOST
#   PGPORT
#   PGDATABASE
#   PGUSER
#   PGPASSWORD / .pgpass
#
# Optional:
#
#   WORKLOAD_SQL
#       SQL file to execute.
#
#   WORKLOAD_TRANSACTIONS
#       Number of workload iterations.
#
#   WORKLOAD_CLIENTS
#       Number of concurrent clients when using the generated workload.
#
# ============================================================================

set -Eeuo pipefail


# ============================================================================
# Configuration
# ============================================================================

ROOT_DIR="$(
    cd "$(dirname "${BASH_SOURCE[0]}")/.."
    pwd
)"


WORKLOAD_SQL="${WORKLOAD_SQL:-}"

WORKLOAD_TRANSACTIONS="${WORKLOAD_TRANSACTIONS:-100}"

WORKLOAD_CLIENTS="${WORKLOAD_CLIENTS:-1}"


# ============================================================================
# PostgreSQL command validation
# ============================================================================

if ! command -v psql >/dev/null 2>&1; then

    echo "ERROR: psql is not installed or not in PATH."

    exit 1

fi


# ============================================================================
# Connection validation
# ============================================================================

if [[ -z "${PGDATABASE:-}" ]]; then

    echo "ERROR: PGDATABASE is not configured."

    exit 1

fi


# ============================================================================
# PostgreSQL connectivity test
# ============================================================================

echo "Testing PostgreSQL connection..."

if ! psql \
    -X \
    -v ON_ERROR_STOP=1 \
    -Atqc "SELECT 1;" \
    >/dev/null; then

    echo "ERROR: unable to connect to PostgreSQL."

    exit 1

fi


echo "PostgreSQL connection OK."


# ============================================================================
# Print environment information
# ============================================================================

echo
echo "============================================================"
echo " WORKLOAD CONFIGURATION"
echo "============================================================"
echo

echo "Database:"
echo "  ${PGDATABASE}"

echo

echo "Host:"
echo "  ${PGHOST:-local}"

echo

echo "Port:"
echo "  ${PGPORT:-5432}"

echo

echo "Transactions:"
echo "  ${WORKLOAD_TRANSACTIONS}"

echo

echo "Clients:"
echo "  ${WORKLOAD_CLIENTS}"

echo


# ============================================================================
# SQL file mode
# ============================================================================

if [[ -n "${WORKLOAD_SQL}" ]]; then

    if [[ ! -f "${WORKLOAD_SQL}" ]]; then

        echo "ERROR: workload SQL file does not exist:"
        echo "  ${WORKLOAD_SQL}"

        exit 1

    fi


    echo "SQL workload:"
    echo "  ${WORKLOAD_SQL}"

    echo

    echo "Executing SQL workload..."

    psql \
        -X \
        -v ON_ERROR_STOP=1 \
        -f "${WORKLOAD_SQL}"

    EXIT_CODE=$?

    echo

    echo "SQL workload finished with exit code ${EXIT_CODE}."

    exit "${EXIT_CODE}"

fi


# ============================================================================
# Generated transaction workload
# ============================================================================
#
# This default workload is deliberately conservative.
#
# It creates transactions that establish a repeatable baseline without
# pretending to reproduce a particular production workload.
#
# Experiment-specific SQL should be supplied through WORKLOAD_SQL.
#
# ============================================================================

echo "No WORKLOAD_SQL supplied."
echo "Running default transaction workload."
echo


for ((i=1; i<=WORKLOAD_TRANSACTIONS; i++)); do

    psql \
        -X \
        -v ON_ERROR_STOP=1 \
        -v iteration="${i}" \
        -c "
            BEGIN;

            SELECT txid_current();

            SELECT 1;

            COMMIT;
        " \
        >/dev/null


    if (( i % 100 == 0 )); then

        echo "Completed ${i} transactions."

    fi

done


echo
echo "Default workload completed successfully."
echo

exit 0
