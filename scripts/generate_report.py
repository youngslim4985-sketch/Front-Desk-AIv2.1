#!/usr/bin/env python3

"""
===============================================================================
generate_report.py
===============================================================================

PostgreSQL Subtransaction / MultiXact Investigation

Purpose:
    Generate a structured Markdown report from one benchmark run.

Input:
    results/<experiment>/<run>/

Expected artifacts:

    metadata.txt
    slru_delta.csv
    slru_analysis.csv
    wait_analysis.csv
    comparison.csv                  (optional)

Output:

    experimental_report.md

IMPORTANT:

    This script reports observations.

    It does NOT automatically declare a causal relationship.

    Causal conclusions belong in the final research report after:

        controlled experiments
        repeated runs
        negative controls
        source verification
        correlation of measurements
        review of confounding factors

===============================================================================
"""

from __future__ import annotations

import csv
import sys
from pathlib import Path
from datetime import datetime, timezone


# =============================================================================
# Arguments
# =============================================================================

if len(sys.argv) != 2:

    print(
        "Usage:\n"
        "  ./scripts/generate_report.py <results-directory>"
    )

    sys.exit(1)


RUN_DIR = Path(sys.argv[1])


if not RUN_DIR.is_dir():

    print(
        f"ERROR: results directory does not exist: {RUN_DIR}"
    )

    sys.exit(1)


# =============================================================================
# Files
# =============================================================================

METADATA = RUN_DIR / "metadata.txt"

SLRU_ANALYSIS = RUN_DIR / "slru_analysis.csv"

WAIT_ANALYSIS = RUN_DIR / "wait_analysis.csv"

COMPARISON = RUN_DIR / "comparison.csv"

OUTPUT = RUN_DIR / "experimental_report.md"


# =============================================================================
# Helpers
# =============================================================================

def read_metadata(path: Path) -> dict:

    metadata = {}

    if not path.is_file():
        return metadata

    for line in path.read_text(
        encoding="utf-8"
    ).splitlines():

        if "=" not in line:
            continue

        key, value = line.split(
            "=",
            1,
        )

        metadata[key.strip()] = value.strip()

    return metadata


def read_csv(path: Path) -> list[dict]:

    if not path.is_file():
        return []

    with path.open(
        "r",
        newline="",
        encoding="utf-8",
    ) as file:

        return list(
            csv.DictReader(file)
        )


def safe(value):

    if value in (None, ""):
        return "N/A"

    return str(value)


# =============================================================================
# Load data
# =============================================================================

metadata = read_metadata(METADATA)

slru_rows = read_csv(SLRU_ANALYSIS)

wait_rows = read_csv(WAIT_ANALYSIS)

comparison_rows = read_csv(COMPARISON)


# =============================================================================
# Report metadata
# =============================================================================

experiment_name = metadata.get(
    "experiment",
    RUN_DIR.parent.name,
)

timestamp = metadata.get(
    "timestamp",
    "unknown",
)

status = metadata.get(
    "status",
    "unknown",
)

postgres_version = metadata.get(
    "postgres_version",
    "unknown",
)

database = metadata.get(
    "database",
    "unknown",
)

server_role = metadata.get(
    "in_recovery",
    "unknown",
)

duration = metadata.get(
    "workload_duration_seconds",
    "unknown",
)

exit_code = metadata.get(
    "workload_exit_code",
    "unknown",
)


# =============================================================================
# Generate report
# =============================================================================

report = []


report.append(
    "# Experimental Benchmark Report"
)

report.append("")

report.append(
    f"**Experiment:** `{experiment_name}`"
)

report.append(
    f"**Run:** `{timestamp}`"
)

report.append(
    f"**Status:** `{status}`"
)

report.append("")


# =============================================================================
# Environment
# =============================================================================

report.append(
    "## Environment"
)

report.append("")

report.append(
    f"- PostgreSQL: `{postgres_version}`"
)

report.append(
    f"- Database: `{database}`"
)

report.append(
    f"- In recovery: `{server_role}`"
)

report.append(
    f"- Workload duration: `{duration}` seconds"
)

report.append(
    f"- Workload exit code: `{exit_code}`"
)

report.append("")


# =============================================================================
# SLRU observations
# =============================================================================

report.append(
    "## SLRU Measurements"
)

report.append("")

if not slru_rows:

    report.append(
        "No SLRU analysis data was available."
    )

    report.append("")

else:

    report.append(
        "| SLRU | Hits | Reads | Writes | Hit % | Read % | Signal |"
    )

    report.append(
        "|---|---:|---:|---:|---:|---:|---|"
    )

    for row in slru_rows:

        report.append(
            "| "
            f"{safe(row.get('name'))} | "
            f"{safe(row.get('hit_delta'))} | "
            f"{safe(row.get('read_delta'))} | "
            f"{safe(row.get('write_delta'))} | "
            f"{safe(row.get('interval_hit_pct'))} | "
            f"{safe(row.get('read_pct'))} | "
            f"{safe(row.get('signal'))} |"
        )

    report.append("")


# =============================================================================
# Wait observations
# =============================================================================

report.append(
    "## Wait Events"
)

report.append("")

if not wait_rows:

    report.append(
        "No wait-event analysis data was available."
    )

    report.append("")

else:

    report.append(
        "| Wait Type | Wait Event | Category | Observations | Peak Sessions |"
    )

    report.append(
        "|---|---|---|---:|---:|"
    )

    for row in wait_rows:

        report.append(
            "| "
            f"{safe(row.get('wait_event_type'))} | "
            f"{safe(row.get('wait_event'))} | "
            f"{safe(row.get('category'))} | "
            f"{safe(row.get('observations'))} | "
            f"{safe(row.get('peak_simultaneous_sessions'))} |"
        )

    report.append("")


# =============================================================================
# Control comparison
# =============================================================================

report.append(
    "## Control Comparison"
)

report.append("")

if not comparison_rows:

    report.append(
        "No control comparison was supplied for this run."
    )

    report.append(
        ""
    )

else:

    report.append(
        "| Type | Metric | Control | Experiment | Change | % Change |"
    )

    report.append(
        "|---|---|---:|---:|---:|---:|"
    )

    for row in comparison_rows:

        pct = safe(
            row.get("percent_change")
        )

        if pct != "N/A":

            try:
                pct = f"{float(pct):.2f}%"
            except ValueError:
                pass

        report.append(
            "| "
            f"{safe(row.get('metric_type'))} | "
            f"{safe(row.get('name'))} | "
            f"{safe(row.get('control_value'))} | "
            f"{safe(row.get('experiment_value'))} | "
            f"{safe(row.get('absolute_change'))} | "
            f"{pct} |"
        )

    report.append("")


# =============================================================================
# Evidence interpretation
# =============================================================================

report.append(
    "## Evidence Interpretation"
)

report.append("")

report.append(
    "This report summarizes observed measurements from the benchmark run."
)

report.append("")

report.append(
    "Positive SLRU read activity indicates that SLRU pages were read "
    "during the measured interval. It does not independently establish "
    "why those reads occurred or whether they caused application-level "
    "latency."
)

report.append("")

report.append(
    "`IO:SLRURead` observations indicate sampled backend waits for SLRU "
    "page reads. Their absence from a sampled interval does not prove "
    "that no short-lived waits occurred."
)

report.append("")

report.append(
    "MultiXact-related LWLock observations represent synchronization "
    "contention and should not automatically be interpreted as storage "
    "I/O."
)

report.append("")

report.append(
    "Control-versus-experiment differences provide stronger evidence "
    "when the workloads and environments are otherwise comparable, "
    "the experiment is repeated, and the same effect is consistently "
    "observed."
)

report.append("")


# =============================================================================
# Limitations
# =============================================================================

report.append(
    "## Limitations"
)

report.append("")

report.append(
    "- Sampling may miss short-lived wait events."
)

report.append(
    "- Cumulative counters require interval deltas for meaningful comparison."
)

report.append(
    "- A single benchmark run is insufficient to establish generality."
)

report.append(
    "- Host-level storage behavior is not represented solely by PostgreSQL "
    "wait events."
)

report.append(
    "- Correlation does not by itself establish causation."
)

report.append("")


# =============================================================================
# Reproducibility
# =============================================================================

report.append(
    "## Reproducibility"
)

report.append("")

report.append(
    "The benchmark should be rerun using the same experiment SQL, "
    "PostgreSQL configuration, workload parameters, and measurement "
    "procedure before comparing results."
)

report.append("")

report.append(
    "All generated artifacts should remain associated with their "
    "individual run directory."
)

report.append("")


# =============================================================================
# Artifact index
# =============================================================================

report.append(
    "## Artifacts"
)

report.append("")

for path in sorted(RUN_DIR.iterdir()):

    if path.is_file():

        report.append(
            f"- `{path.name}`"
        )

report.append("")


# =============================================================================
# Timestamp
# =============================================================================

report.append(
    "---"
)

report.append("")

report.append(
    "Report generated automatically by `scripts/generate_report.py`."
)

report.append(
    f"Generated: `{datetime.now(timezone.utc).isoformat()}`"
)

report.append("")


# =============================================================================
# Write
# =============================================================================

OUTPUT.write_text(
    "\n".join(report),
    encoding="utf-8",
)


# =============================================================================
# Console
# =============================================================================

print()
print("============================================================")
print(" EXPERIMENTAL REPORT GENERATED")
print("============================================================")
print()
print(f"Experiment: {experiment_name}")
print(f"Run:        {RUN_DIR}")
print()
print(f"Report:     {OUTPUT}")
print()


# =============================================================================
# END
# =============================================================================
