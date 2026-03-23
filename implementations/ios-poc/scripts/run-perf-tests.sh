#!/bin/bash
# run-perf-tests.sh — Orchestrates iOS performance test pipeline.
#
# Usage:
#   ./scripts/run-perf-tests.sh [--baseline]
#
# Options:
#   --baseline   Save results as the new baseline after running
#
# Environment variables:
#   DESTINATION   Xcode destination (default: "platform=iOS Simulator,name=iPhone 16 Pro")
#   PROJECT_DIR   Path to .xcodeproj directory (default: auto-detected)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
IOS_POC_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_DIR="${PROJECT_DIR:-$IOS_POC_DIR/OptimizationPoC}"
RESULTS_DIR="$IOS_POC_DIR/results"
BASELINES_DIR="$IOS_POC_DIR/baselines"
DESTINATION="${DESTINATION:-platform=iOS Simulator,name=iPhone 17 Pro}"
SAVE_BASELINE=false

for arg in "$@"; do
    case "$arg" in
        --baseline) SAVE_BASELINE=true ;;
        *) echo "Unknown argument: $arg"; exit 1 ;;
    esac
done

# Ensure results directory exists
mkdir -p "$RESULTS_DIR"

RESULT_BUNDLE="$RESULTS_DIR/perf-$(date +%Y%m%d-%H%M%S).xcresult"

echo "=== Running Performance Tests ==="
echo "Project:     $PROJECT_DIR"
echo "Destination: $DESTINATION"
echo "Results:     $RESULT_BUNDLE"
echo ""

# Remove any previous result bundle at this path (xcodebuild requires it not to exist)
rm -rf "$RESULT_BUNDLE"

xcodebuild test \
    -project "$PROJECT_DIR/OptimizationPoC.xcodeproj" \
    -scheme OptimizationPoC \
    -only-testing:OptimizationPoCPerfTests \
    -configuration Release \
    -destination "$DESTINATION" \
    -resultBundlePath "$RESULT_BUNDLE" \
    2>&1 | tee "$RESULTS_DIR/test-output.log"

TEST_EXIT=${PIPESTATUS[0]}

if [ $TEST_EXIT -ne 0 ]; then
    echo ""
    echo "ERROR: Tests failed with exit code $TEST_EXIT"
    exit $TEST_EXIT
fi

echo ""
echo "=== Extracting Metrics ==="

METRICS_JSON="$RESULTS_DIR/metrics.json"
"$SCRIPT_DIR/extract-metrics.sh" "$RESULT_BUNDLE" "$RESULTS_DIR/test-output.log" > "$METRICS_JSON"

echo "Metrics saved to: $METRICS_JSON"
cat "$METRICS_JSON"

# Compare with baseline if one exists
BASELINE_FILE="$BASELINES_DIR/metrics_baseline.json"
if [ -f "$BASELINE_FILE" ]; then
    echo ""
    echo "=== Comparing with Baseline ==="
    if python3 "$SCRIPT_DIR/compare-metrics.py" "$BASELINE_FILE" "$METRICS_JSON"; then
        echo "All metrics within threshold."
    else
        echo "WARNING: Some metrics regressed beyond threshold!"
    fi
else
    echo ""
    echo "No baseline found at $BASELINE_FILE — skipping comparison."
    echo "Run with --baseline to save current results as baseline."
fi

# Save as baseline if requested
if [ "$SAVE_BASELINE" = true ]; then
    mkdir -p "$BASELINES_DIR"
    cp "$METRICS_JSON" "$BASELINE_FILE"
    echo ""
    echo "Baseline saved to: $BASELINE_FILE"
fi

echo ""
echo "=== Done ==="
