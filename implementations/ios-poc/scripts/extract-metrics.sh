#!/bin/bash
# extract-metrics.sh — Extracts performance metrics from an xcresult bundle.
#
# Usage:
#   ./scripts/extract-metrics.sh <path-to.xcresult> [test-output.log]
#
# Outputs JSON to stdout combining:
#   1. XCTest performance metrics from the xcresult bundle
#   2. PERF_RESULT lines from test console output (if log file provided)

set -euo pipefail

if [ $# -lt 1 ]; then
    echo "Usage: $0 <path-to.xcresult> [test-output.log]" >&2
    exit 1
fi

XCRESULT_PATH="$1"
LOG_FILE="${2:-}"

if [ ! -d "$XCRESULT_PATH" ]; then
    echo "Error: xcresult bundle not found at $XCRESULT_PATH" >&2
    exit 1
fi

# Start building JSON output
echo "{"

# Extract XCTest metrics from xcresult bundle
echo '  "xctest_metrics": {'
METRICS_JSON=$(xcrun xcresulttool get test-results metrics --path "$XCRESULT_PATH" 2>/dev/null || echo "{}")
if [ "$METRICS_JSON" != "{}" ] && [ -n "$METRICS_JSON" ]; then
    # Parse the metrics JSON and extract relevant performance data
    echo "$METRICS_JSON" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    metrics = {}

    # Walk the test results structure to find performance metrics
    def extract_metrics(obj, path=''):
        if isinstance(obj, dict):
            # Look for performance metric entries
            if 'performanceMetrics' in obj:
                for metric in obj['performanceMetrics']:
                    name = metric.get('displayName', metric.get('identifier', 'unknown'))
                    measurements = metric.get('measurements', [])
                    if measurements:
                        values = [m.get('value', 0) for m in measurements if 'value' in m]
                        if values:
                            avg = sum(values) / len(values)
                            metrics[f'{path}{name}'] = {
                                'average': avg,
                                'values': values,
                                'unit': metric.get('unitOfMeasurement', '')
                            }
            for key, value in obj.items():
                new_path = f'{path}{key}/' if path else f'{key}/'
                extract_metrics(value, path)
        elif isinstance(obj, list):
            for item in obj:
                extract_metrics(item, path)

    extract_metrics(data)

    entries = []
    for key, val in metrics.items():
        entries.append(f'    \"{key}\": {json.dumps(val)}')
    print(',\\n'.join(entries))
except Exception as e:
    print(f'    \"_error\": \"Failed to parse xcresult metrics: {e}\"', file=sys.stdout)
" 2>/dev/null || echo '    "_note": "xcresulttool metrics extraction not available"'
else
    echo '    "_note": "no xcresult metrics found"'
fi
echo '  },'

# Extract PERF_RESULT lines from test output log
echo '  "perf_results": ['
if [ -n "$LOG_FILE" ] && [ -f "$LOG_FILE" ]; then
    # Extract JSON objects from PERF_RESULT: prefixed lines
    grep -o 'PERF_RESULT:{.*}' "$LOG_FILE" 2>/dev/null | sed 's/^PERF_RESULT://' | \
        awk 'BEGIN{first=1} {if(!first) printf ",\n"; first=0; printf "    %s", $0}' || true
    echo ""
else
    echo '    {"_note": "no test output log provided"}'
fi
echo '  ],'

# Metadata
echo '  "metadata": {'
echo "    \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\","
echo "    \"xcresult_path\": \"$XCRESULT_PATH\","
echo "    \"xcode_version\": \"$(xcodebuild -version 2>/dev/null | head -1 || echo 'unknown')\","
echo "    \"device\": \"$(sw_vers -productName 2>/dev/null || echo 'unknown') $(sw_vers -productVersion 2>/dev/null || echo '')\""
echo '  }'
echo "}"
