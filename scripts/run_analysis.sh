#!/usr/bin/env bash

# ============================================================================
# run_analysis.sh
# ============================================================================
# PostgreSQL Subtransaction / MultiXact Investigation
#
# Usage:
#
#   ./scripts/run_analysis.sh results/<experiment>/<run>
#
# Pipeline:
#
#   Raw results
#       ↓
#   SLRU analysis
#       ↓
#   Wait analysis
#       ↓
#   Report generation
#
# ============================================================================

set -Eeuo pipefail

RUN_DIR="${1:-}"

if [[ -z "${RUN_DIR}" ]]; then
    echo "ERROR: result directory is required."
    echo
    echo "Usage:"
    echo "  $0 results/<experiment>/<run>"
    exit 1
fi

if [[ ! -d "${RUN_DIR}" ]]; then
    echo "ERROR: result directory does not exist:"
    echo "  ${RUN_DIR}"
    exit 1
fi


SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"


echo
echo "============================================================"
echo " POSTGRESQL EXPERIMENT ANALYSIS"
echo "============================================================"
echo
echo "Run directory:"
echo "  ${RUN_DIR}"
echo


# ============================================================================
# Stage 1 — SLRU analysis
# ============================================================================

echo "------------------------------------------------------------"
echo "Stage 1: SLRU analysis"
echo "------------------------------------------------------------"
echo

python3 \
    "${SCRIPT_DIR}/analyze_slru.py" \
    "${RUN_DIR}"

echo
echo "[PASS] SLRU analysis completed."
echo


# ============================================================================
# Stage 2 — Wait analysis
# ============================================================================

echo "------------------------------------------------------------"
echo "Stage 2: Wait-event analysis"
echo "------------------------------------------------------------"
echo

python3 \
    "${SCRIPT_DIR}/analyze_waits.py" \
    "${RUN_DIR}"

echo
echo "[PASS] Wait-event analysis completed."
echo


# ============================================================================
# Stage 3 — Report generation
# ============================================================================

echo "------------------------------------------------------------"
echo "Stage 3: Report generation"
echo "------------------------------------------------------------"
echo

python3 \
    "${SCRIPT_DIR}/generate_report.py" \
    "${RUN_DIR}"

echo
echo "[PASS] Experimental report generated."
echo


# ============================================================================
# Artifact verification
# ============================================================================

echo "------------------------------------------------------------"
echo "Stage 4: Artifact verification"
echo "------------------------------------------------------------"
echo

REQUIRED_ARTIFACTS=(
    "slru_analysis.csv"
    "slru_analysis.txt"
    "wait_analysis.csv"
    "wait_analysis.txt"
    "experimental_report.md"
)


ERRORS=0


for artifact in "${REQUIRED_ARTIFACTS[@]}"; do

    if [[ -s "${RUN_DIR}/${artifact}" ]]; then

        echo "[PASS] ${artifact}"

    else

        echo "[FAIL] ${artifact}"
        ERRORS=$((ERRORS + 1))

    fi

done


echo


# ============================================================================
# Final status
# ============================================================================

if [[ "${ERRORS}" -gt 0 ]]; then

    echo "============================================================"
    echo " ANALYSIS FAILED"
    echo "============================================================"
    echo
    echo "${ERRORS} required artifact(s) are missing or empty."
    echo
    exit 1

fi


echo "============================================================"
echo " ANALYSIS COMPLETE"
echo "============================================================"
echo

echo "Generated artifacts:"
echo

for artifact in "${REQUIRED_ARTIFACTS[@]}"; do
    echo "  ${RUN_DIR}/${artifact}"
done

echo
echo "The results are ready for review."
echo
