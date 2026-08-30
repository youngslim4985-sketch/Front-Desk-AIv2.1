#!/usr/bin/env bash

# ============================================================================
# validate_results.sh
# ============================================================================
# PostgreSQL Subtransaction / MultiXact Investigation
#
# Purpose:
#   Validate the completeness of a benchmark result directory.
#
# Usage:
#
#   ./scripts/validate_results.sh results/<experiment>/<run>
#
# Exit codes:
#
#   0 = valid / complete
#   1 = validation failure
#
# ============================================================================

set -Eeuo pipefail


# ============================================================================
# Arguments
# ============================================================================

RUN_DIR="${1:-}"


if [[ -z "${RUN_DIR}" ]]; then
    echo "ERROR: result directory is required."
    echo
    echo "Usage:"
    echo "  $0 <results-directory>"
    exit 1
fi


if [[ ! -d "${RUN_DIR}" ]]; then
    echo "ERROR: result directory does not exist:"
    echo "  ${RUN_DIR}"
    exit 1
fi


# ============================================================================
# State
# ============================================================================

ERRORS=0
WARNINGS=0


pass() {
    echo "  [PASS] $*"
}


warn() {
    echo "  [WARN] $*"
    WARNINGS=$((WARNINGS + 1))
}


fail() {
    echo "  [FAIL] $*"
    ERRORS=$((ERRORS + 1))
}


# ============================================================================
# Header
# ============================================================================

echo
echo "============================================================"
echo " BENCHMARK RESULT VALIDATION"
echo "============================================================"
echo
echo "Directory:"
echo "  ${RUN_DIR}"
echo


# ============================================================================
# Required artifacts
# ============================================================================

echo "Checking required artifacts..."
echo


REQUIRED_FILES=(
    "metadata.txt"
    "benchmark.log"
    "workload.log"
    "slru_baseline.csv"
    "slru_final.csv"
    "slru_delta.csv"
    "final_wait_snapshot.csv"
    "final_activity.csv"
)


for file in "${REQUIRED_FILES[@]}"; do

    if [[ -f "${RUN_DIR}/${file}" ]]; then
        pass "${file}"
    else
        fail "Missing ${file}"
    fi

done


# ============================================================================
# Wait collector
# ============================================================================

echo
echo "Checking wait collector artifacts..."
echo


WAIT_FILES=(
    "${RUN_DIR}"/waits_*.csv
)

WAIT_FOUND=false

for file in "${WAIT_FILES[@]}"; do

    if [[ -f "${file}" ]]; then
        WAIT_FOUND=true
        pass "$(basename "${file}")"
    fi

done


if [[ "${WAIT_FOUND}" == false ]]; then
    fail "No detailed wait-event CSV was produced."
fi


SUMMARY_FILES=(
    "${RUN_DIR}"/wait_summary_*.csv
)

SUMMARY_FOUND=false

for file in "${SUMMARY_FILES[@]}"; do

    if [[ -f "${file}" ]]; then
        SUMMARY_FOUND=true
        pass "$(basename "${file}")"
    fi

done


if [[ "${SUMMARY_FOUND}" == false ]]; then
    warn "No aggregate wait summary was produced."
fi


# ============================================================================
# Metadata validation
# ============================================================================

echo
echo "Checking metadata..."
echo


METADATA="${RUN_DIR}/metadata.txt"


if [[ -f "${METADATA}" ]]; then

    REQUIRED_METADATA=(
        "experiment="
        "experiment_file="
        "timestamp="
        "postgres_version="
        "database="
        "user="
        "in_recovery="
        "workload_start_epoch="
        "workload_end_epoch="
        "workload_duration_seconds="
        "workload_exit_code="
        "status="
    )


    for field in "${REQUIRED_METADATA[@]}"; do

        if grep -q "^${field}" "${METADATA}"; then
            pass "${field}"
        else
            fail "Missing metadata field: ${field}"
        fi

    done

fi


# ============================================================================
# Workload status
# ============================================================================

echo
echo "Checking workload status..."
echo


if [[ -f "${METADATA}" ]]; then

    EXIT_CODE="$(
        grep '^workload_exit_code=' "${METADATA}" \
        | tail -1 \
        | cut -d= -f2
    )"


    STATUS="$(
        grep '^status=' "${METADATA}" \
        | tail -1 \
        | cut -d= -f2
    )"


    if [[ "${EXIT_CODE}" == "0" ]]; then
        pass "Workload exit code is 0"
    else
        fail "Workload exit code is ${EXIT_CODE}"
    fi


    if [[ "${STATUS}" == "completed" ]]; then
        pass "Benchmark status is completed"
    else
        fail "Benchmark status is ${STATUS}"
    fi

fi


# ============================================================================
# CSV validation
# ============================================================================

echo
echo "Checking CSV files..."
echo


CSV_FILES=(
    "${RUN_DIR}"/*.csv
)


for file in "${CSV_FILES[@]}"; do

    [[ -f "${file}" ]] || continue

    if [[ -s "${file}" ]]; then
        pass "$(basename "${file}") is non-empty"
    else
        warn "$(basename "${file}") is empty"
    fi

done


# ============================================================================
# SLRU validation
# ============================================================================

echo
echo "Checking SLRU measurements..."
echo


DELTA_FILE="${RUN_DIR}/slru_delta.csv"


if [[ -f "${DELTA_FILE}" ]]; then

    EXPECTED_SLRUS=(
        "Subtrans"
        "MultiXactMember"
        "MultiXactOffset"
    )


    for slru in "${EXPECTED_SLRUS[@]}"; do

        if grep -q "^${slru}," "${DELTA_FILE}"; then
            pass "${slru} measurement present"
        else
            fail "${slru} measurement missing"
        fi

    done

fi


# ============================================================================
# Numeric sanity checks
# ============================================================================

echo
echo "Checking SLRU delta sanity..."
echo


if [[ -f "${DELTA_FILE}" ]]; then

    python3 - "${DELTA_FILE}" <<'PY'
import csv
import sys

path = sys.argv[1]

with open(path, newline="", encoding="utf-8") as f:
    rows = list(csv.DictReader(f))

for row in rows:
    name = row["name"]

    for field in ("hit_delta", "read_delta", "write_delta"):
        value = int(row[field])

        if value < 0:
            print(
                f"ERROR: negative {field} for {name}: {value}"
            )
            sys.exit(1)

print("SLRU deltas are numerically sane.")
PY

    if [[ "$?" -eq 0 ]]; then
        pass "SLRU deltas are non-negative"
    else
        fail "SLRU delta sanity check failed"
    fi

fi


# ============================================================================
# Detect incomplete experiment
# ============================================================================

echo
echo "Checking for incomplete execution..."
echo


if [[ -f "${RUN_DIR}/workload.log" ]]; then

    if grep -Eqi \
        "ERROR:|FATAL:|PANIC:" \
        "${RUN_DIR}/workload.log"; then

        warn "Database errors were detected in workload.log."

    else

        pass "No ERROR/FATAL/PANIC markers detected"

    fi

fi


# ============================================================================
# Check for obvious credentials
# ============================================================================

echo
echo "Checking artifacts for obvious credential leakage..."
echo


if grep -RniE \
    "password=|passwd=|secret=|api[_-]?key=|BEGIN PRIVATE KEY" \
    "${RUN_DIR}" \
    >/dev/null 2>&1; then

    fail "Potential credential material detected in result artifacts."

else

    pass "No obvious credential patterns detected"

fi


# ============================================================================
# Summary
# ============================================================================

echo
echo "============================================================"
echo " VALIDATION SUMMARY"
echo "============================================================"
echo
echo "Errors:"
echo "  ${ERRORS}"
echo
echo "Warnings:"
echo "  ${WARNINGS}"
echo


if [[ "${ERRORS}" -gt 0 ]]; then

    echo "RESULT: INVALID"
    echo
    echo "This benchmark should not be used as final empirical evidence."
    exit 1

fi


if [[ "${WARNINGS}" -gt 0 ]]; then

    echo "RESULT: VALID WITH WARNINGS"
    exit 0

fi


echo "RESULT: VALID"
exit 0
