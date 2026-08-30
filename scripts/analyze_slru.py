#!/usr/bin/env python3

"""
===============================================================================
analyze_slru.py
===============================================================================

PostgreSQL Subtransaction / MultiXact Investigation

Purpose:
    Analyze SLRU interval measurements produced by collect_slru.sh.

Input:
    results/<experiment>/<run>/slru_delta.csv

Output:
    results/<experiment>/<run>/slru_analysis.csv
    results/<experiment>/<run>/slru_analysis.txt

Analyzes:

    Subtrans
    MultiXactMember
    MultiXactOffset

The script reports:

    hit delta
    read delta
    write delta
    interval hit percentage
    read share
    cache-pressure signal

IMPORTANT:

    This script does NOT diagnose root cause by itself.

    SLRU reads must be correlated with:

        wait events
        workload latency
        concurrency
        transaction behavior
        experiment controls

===============================================================================
"""

from __future__ import annotations

import csv
import sys
from pathlib import Path


# =============================================================================
# Configuration
# =============================================================================

EXPECTED_SLRUS = {
    "Subtrans",
    "MultiXactMember",
    "MultiXactOffset",
}


# =============================================================================
# Arguments
# =============================================================================

if len(sys.argv) != 2:
    print(
        "Usage:\n"
        "  ./scripts/analyze_slru.py <results-directory>"
    )
    sys.exit(1)


RUN_DIR = Path(sys.argv[1])

if not RUN_DIR.is_dir():
    print(f"ERROR: results directory does not exist: {RUN_DIR}")
    sys.exit(1)


INPUT_FILE = RUN_DIR / "slru_delta.csv"
OUTPUT_CSV = RUN_DIR / "slru_analysis.csv"
OUTPUT_REPORT = RUN_DIR / "slru_analysis.txt"


if not INPUT_FILE.is_file():
    print(f"ERROR: missing input file: {INPUT_FILE}")
    sys.exit(1)


# =============================================================================
# Load measurements
# =============================================================================

with INPUT_FILE.open(
    "r",
    newline="",
    encoding="utf-8",
) as file:

    reader = csv.DictReader(file)

    rows = list(reader)


if not rows:
    print("ERROR: slru_delta.csv contains no measurements.")
    sys.exit(1)


# =============================================================================
# Analyze
# =============================================================================

analysis = []


for row in rows:

    name = row["name"]

    hit_delta = int(row["hit_delta"])
    read_delta = int(row["read_delta"])
    write_delta = int(row["write_delta"])

    total_accesses = hit_delta + read_delta

    if total_accesses > 0:

        hit_pct = (
            100.0 * hit_delta / total_accesses
        )

        read_pct = (
            100.0 * read_delta / total_accesses
        )

    else:

        hit_pct = None
        read_pct = None


    # -------------------------------------------------------------------------
    # Signal classification
    # -------------------------------------------------------------------------
    #
    # These are intentionally descriptive rather than diagnostic.
    #
    # READ_ACTIVITY:
    #     At least one SLRU page read occurred.
    #
    # ELEVATED_READ_ACTIVITY:
    #     Reads represent a substantial fraction of SLRU accesses.
    #
    # NO_READ_ACTIVITY:
    #     No interval reads observed.
    #
    # The threshold is a screening heuristic, not a PostgreSQL correctness
    # threshold.
    # -------------------------------------------------------------------------

    if read_delta == 0:

        signal = "NO_READ_ACTIVITY"

    elif total_accesses > 0 and read_pct >= 10.0:

        signal = "ELEVATED_READ_ACTIVITY"

    else:

        signal = "READ_ACTIVITY"


    analysis.append(
        {
            "name": name,
            "hit_delta": hit_delta,
            "read_delta": read_delta,
            "write_delta": write_delta,
            "interval_hit_pct": (
                round(hit_pct, 2)
                if hit_pct is not None
                else ""
            ),
            "read_pct": (
                round(read_pct, 2)
                if read_pct is not None
                else ""
            ),
            "signal": signal,
        }
    )


# =============================================================================
# Check expected SLRUs
# =============================================================================

observed_slrus = {
    row["name"]
    for row in analysis
}


missing = EXPECTED_SLRUS - observed_slrus


# =============================================================================
# Write CSV analysis
# =============================================================================

fieldnames = [
    "name",
    "hit_delta",
    "read_delta",
    "write_delta",
    "interval_hit_pct",
    "read_pct",
    "signal",
]


with OUTPUT_CSV.open(
    "w",
    newline="",
    encoding="utf-8",
) as file:

    writer = csv.DictWriter(
        file,
        fieldnames=fieldnames,
    )

    writer.writeheader()

    writer.writerows(analysis)


# =============================================================================
# Determine dominant cache
# =============================================================================

read_rows = sorted(
    analysis,
    key=lambda row: row["read_delta"],
    reverse=True,
)


dominant = (
    read_rows[0]
    if read_rows and read_rows[0]["read_delta"] > 0
    else None
)


# =============================================================================
# Write human-readable report
# =============================================================================

with OUTPUT_REPORT.open(
    "w",
    encoding="utf-8",
) as file:

    file.write(
        "PostgreSQL SLRU Analysis\n"
        "========================\n\n"
    )

    file.write(
        f"Run directory: {RUN_DIR}\n"
        f"Input: {INPUT_FILE.name}\n\n"
    )


    # -------------------------------------------------------------------------
    # Measurements
    # -------------------------------------------------------------------------

    file.write("Measurements\n")
    file.write("------------\n\n")


    for row in analysis:

        file.write(
            f"SLRU: {row['name']}\n"
        )

        file.write(
            f"  hit_delta: {row['hit_delta']}\n"
        )

        file.write(
            f"  read_delta: {row['read_delta']}\n"
        )

        file.write(
            f"  write_delta: {row['write_delta']}\n"
        )

        file.write(
            f"  interval_hit_pct: "
            f"{row['interval_hit_pct']}\n"
        )

        file.write(
            f"  read_pct: "
            f"{row['read_pct']}\n"
        )

        file.write(
            f"  signal: "
            f"{row['signal']}\n\n"
        )


    # -------------------------------------------------------------------------
    # Dominant SLRU
    # -------------------------------------------------------------------------

    file.write("Dominant Read Activity\n")
    file.write("----------------------\n\n")


    if dominant is None:

        file.write(
            "No SLRU reads were observed during the interval.\n\n"
        )

    else:

        file.write(
            f"{dominant['name']} produced the highest "
            f"interval read delta: "
            f"{dominant['read_delta']}.\n\n"
        )


    # -------------------------------------------------------------------------
    # Missing SLRUs
    # -------------------------------------------------------------------------

    if missing:

        file.write(
            "Missing expected SLRUs\n"
            "----------------------\n\n"
        )

        for name in sorted(missing):

            file.write(
                f"  {name}\n"
            )

        file.write("\n")


    # -------------------------------------------------------------------------
    # Interpretation
    # -------------------------------------------------------------------------

    file.write(
        "Interpretation\n"
        "--------------\n\n"
    )

    file.write(
        "This report identifies interval SLRU read activity. "
        "It does not establish root cause.\n\n"
    )

    file.write(
        "A positive read_delta means SLRU pages were read during "
        "the measured interval. Correlate that activity with "
        "IO:SLRURead, MultiXact-related LWLock waits, workload "
        "latency, and concurrency before drawing causal conclusions.\n\n"
    )

    file.write(
        "A high hit percentage indicates that most observed SLRU "
        "accesses were satisfied from the SLRU cache during this "
        "interval. It does not prove that the system is free from "
        "other forms of contention.\n\n"
    )

    file.write(
        "The ELEVATED_READ_ACTIVITY label is a screening signal only. "
        "It is not a PostgreSQL-defined threshold and must not be "
        "treated as proof of cache exhaustion.\n"
    )


# =============================================================================
# Console output
# =============================================================================

print()
print("============================================================")
print(" SLRU ANALYSIS")
print("============================================================")
print()

for row in analysis:

    print(
        f"{row['name']}: "
        f"hits={row['hit_delta']} "
        f"reads={row['read_delta']} "
        f"writes={row['write_delta']} "
        f"hit_pct={row['interval_hit_pct']} "
        f"signal={row['signal']}"
    )


print()

if dominant:

    print(
        f"Dominant read activity: "
        f"{dominant['name']} "
        f"({dominant['read_delta']} reads)"
    )

else:

    print("No SLRU reads observed.")


print()
print(f"CSV analysis:    {OUTPUT_CSV}")
print(f"Text report:     {OUTPUT_REPORT}")
print()


# =============================================================================
# END
# =============================================================================
