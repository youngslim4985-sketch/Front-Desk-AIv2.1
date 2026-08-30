#!/usr/bin/env python3

"""
===============================================================================
analyze_waits.py
===============================================================================

PostgreSQL Subtransaction / MultiXact Investigation

Purpose:
    Analyze sampled wait-event observations produced by collect_waits.sh
    and run_benchmark.sh.

Input:
    results/<experiment>/<run>/waits_*.csv
    results/<experiment>/<run>/wait_summary_*.csv
    results/<experiment>/<run>/final_wait_snapshot.csv

Output:
    results/<experiment>/<run>/wait_analysis.csv
    results/<experiment>/<run>/wait_analysis.txt

Analyzes:
    SLRURead
    MultiXactMemberBuffer / MultiXactMemberSLRU
    MultiXactOffsetBuffer / MultiXactOffsetSLRU
    Subtrans-related SLRU waits
    General LWLock and IO wait events

===============================================================================
"""

from __future__ import annotations

import csv
import sys
from collections import defaultdict
from pathlib import Path


def categorize_wait_event(wait_type: str, wait_event: str) -> str:
    if wait_event == "SLRURead":
        return "SLRU Storage"
    elif "MultiXact" in wait_event:
        return "MultiXact Lock"
    elif "Subtrans" in wait_event:
        return "Subtransaction SLRU"
    elif wait_type == "IO":
        return "Storage I/O"
    elif wait_type == "LWLock":
        return "Lightweight Lock"
    elif wait_type == "Lock":
        return "Heavyweight Lock"
    return "Other"


def main():
    if len(sys.argv) != 2:
        print("Usage:\n  ./scripts/analyze_waits.py <results-directory>")
        sys.exit(1)

    run_dir = Path(sys.argv[1])
    if not run_dir.is_dir():
        print(f"ERROR: results directory does not exist: {run_dir}")
        sys.exit(1)

    output_csv = run_dir / "wait_analysis.csv"
    output_report = run_dir / "wait_analysis.txt"

    # Aggregation containers: (wait_event_type, wait_event) -> count
    counts: dict[tuple[str, str], int] = defaultdict(int)
    peak_sessions: dict[tuple[str, str], int] = defaultdict(int)

    # 1. Try reading detailed wait records
    detailed_files = list(run_dir.glob("waits_*.csv"))
    summary_files = list(run_dir.glob("wait_summary_*.csv"))
    snapshot_file = run_dir / "final_wait_snapshot.csv"

    parsed_any = False

    for file_path in detailed_files:
        if not file_path.is_file() or file_path.stat().st_size == 0:
            continue
        with file_path.open("r", newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            timestamp_counts: dict[tuple[str, tuple[str, str]], int] = defaultdict(int)
            for row in reader:
                w_type = row.get("wait_event_type", "").strip()
                w_event = row.get("wait_event", "").strip()
                ts = row.get("captured_at", "").strip()
                if not w_event:
                    continue
                key = (w_type, w_event)
                counts[key] += 1
                timestamp_counts[(ts, key)] += 1
                parsed_any = True

            for (ts, key), count in timestamp_counts.items():
                if count > peak_sessions[key]:
                    peak_sessions[key] = count

    # 2. If detailed records yielded nothing or were empty, check summary files
    if not parsed_any:
        for file_path in summary_files:
            if not file_path.is_file() or file_path.stat().st_size == 0:
                continue
            with file_path.open("r", newline="", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    w_type = row.get("wait_event_type", "").strip()
                    w_event = row.get("wait_event", "").strip()
                    sessions_str = row.get("waiting_sessions", "1").strip()
                    if not w_event:
                        continue
                    try:
                        sessions = int(sessions_str)
                    except ValueError:
                        sessions = 1
                    key = (w_type, w_event)
                    counts[key] += sessions
                    if sessions > peak_sessions[key]:
                        peak_sessions[key] = sessions
                    parsed_any = True

    # 3. If still empty, check final_wait_snapshot.csv
    if not parsed_any and snapshot_file.is_file() and snapshot_file.stat().st_size > 0:
        with snapshot_file.open("r", newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                w_type = row.get("wait_event_type", "").strip()
                w_event = row.get("wait_event", "").strip()
                sessions_str = row.get("waiting_sessions", "1").strip()
                if not w_event:
                    continue
                try:
                    sessions = int(sessions_str)
                except ValueError:
                    sessions = 1
                key = (w_type, w_event)
                counts[key] += sessions
                if sessions > peak_sessions[key]:
                    peak_sessions[key] = sessions
                parsed_any = True

    # Prepare rows
    analysis_rows = []
    for (w_type, w_event), obs in sorted(counts.items(), key=lambda item: item[1], reverse=True):
        category = categorize_wait_event(w_type, w_event)
        peak = peak_sessions.get((w_type, w_event), 1)
        analysis_rows.append({
            "wait_event_type": w_type,
            "wait_event": w_event,
            "category": category,
            "observations": obs,
            "peak_simultaneous_sessions": peak,
        })

    # Write CSV
    fieldnames = [
        "wait_event_type",
        "wait_event",
        "category",
        "observations",
        "peak_simultaneous_sessions",
    ]

    with output_csv.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(analysis_rows)

    # Write TXT report
    with output_report.open("w", encoding="utf-8") as f:
        f.write("PostgreSQL Wait-Event Analysis\n")
        f.write("==============================\n\n")
        f.write(f"Run directory: {run_dir}\n")
        f.write(f"Total distinct wait events observed: {len(analysis_rows)}\n\n")

        if not analysis_rows:
            f.write("No matching SLRU or MultiXact wait events were recorded during the sample window.\n\n")
        else:
            f.write("Observed Wait Events\n")
            f.write("--------------------\n\n")
            for row in analysis_rows:
                f.write(f"Event: {row['wait_event']} ({row['wait_event_type']})\n")
                f.write(f"  Category: {row['category']}\n")
                f.write(f"  Observations: {row['observations']}\n")
                f.write(f"  Peak simultaneous sessions: {row['peak_simultaneous_sessions']}\n\n")

        f.write("Interpretation\n")
        f.write("--------------\n\n")
        f.write("Sampled wait events represent active backend wait states during execution.\n")
        f.write("IO:SLRURead indicates blocking on page fetch from disk.\n")
        f.write("LWLock events (e.g. MultiXactMemberSLRU, SubtransSLRU) indicate lock contention.\n")

    print()
    print("============================================================")
    print(" WAIT EVENT ANALYSIS")
    print("============================================================")
    print()
    if analysis_rows:
        for row in analysis_rows:
            print(f"{row['wait_event']} ({row['wait_event_type']}): observations={row['observations']} peak={row['peak_simultaneous_sessions']}")
    else:
        print("No matching wait events recorded.")
    print()
    print(f"CSV analysis: {output_csv}")
    print(f"Text report:  {output_report}")
    print()


if __name__ == "__main__":
    main()
