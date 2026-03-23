#!/usr/bin/env python3
"""
compare-metrics.py — Compare two metrics.json files (baseline vs current).

Usage:
    python3 compare-metrics.py <baseline.json> <current.json> [--threshold 20]

Exits non-zero if any metric regresses beyond the threshold percentage.
"""

import json
import sys
import argparse


def load_metrics(path: str) -> dict:
    with open(path) as f:
        return json.load(f)


def extract_comparable_values(data: dict) -> dict:
    """Extract flat key-value pairs suitable for comparison."""
    values = {}

    # Extract from perf_results (PERF_RESULT lines)
    for entry in data.get("perf_results", []):
        if isinstance(entry, dict):
            test_name = entry.get("test", "unknown")
            if "timings" in entry:
                timings = entry["timings"]
                if isinstance(timings, dict):
                    for phase, duration in timings.items():
                        if isinstance(duration, (int, float)):
                            values[f"{test_name}/{phase}"] = duration
            # Direct numeric values (e.g., memory measurements)
            for key in ("baselineMemoryMB", "finalMemoryMB", "growthMB"):
                if key in entry and isinstance(entry[key], (int, float)):
                    values[f"{test_name}/{key}"] = entry[key]

    # Extract from xctest_metrics
    for key, metric in data.get("xctest_metrics", {}).items():
        if isinstance(metric, dict) and "average" in metric:
            values[f"xctest/{key}"] = metric["average"]

    return values


def compare(baseline: dict, current: dict, threshold: float) -> list:
    """Compare metrics and return list of regressions."""
    regressions = []
    baseline_vals = extract_comparable_values(baseline)
    current_vals = extract_comparable_values(current)

    all_keys = sorted(set(baseline_vals.keys()) | set(current_vals.keys()))

    print(f"{'Metric':<50} {'Baseline':>12} {'Current':>12} {'Change':>10}")
    print("-" * 88)

    for key in all_keys:
        b_val = baseline_vals.get(key)
        c_val = current_vals.get(key)

        if b_val is None:
            print(f"{key:<50} {'N/A':>12} {c_val:>12.4f} {'NEW':>10}")
            continue
        if c_val is None:
            print(f"{key:<50} {b_val:>12.4f} {'N/A':>12} {'REMOVED':>10}")
            continue

        if b_val == 0:
            pct_change = 0.0 if c_val == 0 else float("inf")
        else:
            pct_change = ((c_val - b_val) / abs(b_val)) * 100

        status = ""
        if pct_change > threshold:
            status = " REGRESSED"
            regressions.append({
                "metric": key,
                "baseline": b_val,
                "current": c_val,
                "change_pct": pct_change,
            })
        elif pct_change < -threshold:
            status = " IMPROVED"

        print(f"{key:<50} {b_val:>12.4f} {c_val:>12.4f} {pct_change:>+9.1f}%{status}")

    return regressions


def main():
    parser = argparse.ArgumentParser(description="Compare performance metrics")
    parser.add_argument("baseline", help="Path to baseline metrics.json")
    parser.add_argument("current", help="Path to current metrics.json")
    parser.add_argument("--threshold", type=float, default=20.0,
                        help="Regression threshold percentage (default: 20)")
    args = parser.parse_args()

    baseline = load_metrics(args.baseline)
    current = load_metrics(args.current)

    print(f"\nComparing: {args.baseline} vs {args.current}")
    print(f"Threshold: {args.threshold}%\n")

    regressions = compare(baseline, current, args.threshold)

    if regressions:
        print(f"\n{len(regressions)} REGRESSION(S) DETECTED:")
        for r in regressions:
            print(f"  - {r['metric']}: {r['baseline']:.4f} -> {r['current']:.4f} ({r['change_pct']:+.1f}%)")
        sys.exit(1)
    else:
        print("\nNo regressions detected.")
        sys.exit(0)


if __name__ == "__main__":
    main()
