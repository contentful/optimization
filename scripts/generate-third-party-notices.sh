#!/usr/bin/env bash

set -euo pipefail

MODE="${1:-all}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPORT_DIR="$ROOT_DIR/build/reports/third-party-notices"
NPM_REPORT_DIR="$REPORT_DIR/npm"
NPM_NOTICE_TARGETS_SCRIPT="$ROOT_DIR/scripts/list-npm-notice-targets.ts"
NPM_REPORT="$REPORT_DIR/npm-third-party-notices.txt"
JS_BRIDGE_REPORT="$NPM_REPORT_DIR/optimization-js-bridge.txt"
ANDROID_REPORT="$ROOT_DIR/packages/android/ContentfulOptimization/build/reports/dependency-license/android-third-party-notices.json"
NORMALIZED_ANDROID_REPORT="$REPORT_DIR/android-third-party-notices.txt"
PUBLISHED_ANDROID_REPORT="$REPORT_DIR/android-published-third-party-notices.txt"
IOS_RAW_REPORT="$REPORT_DIR/ios-third-party-notices.raw.md"
IOS_REPORT="$REPORT_DIR/ios-third-party-notices.txt"
PUBLISHED_IOS_REPORT="$REPORT_DIR/swift-published-third-party-notices.txt"
OUTPUT_FILE="$ROOT_DIR/THIRD_PARTY_NOTICES.txt"
TSX="$ROOT_DIR/node_modules/.bin/tsx"

mkdir -p "$REPORT_DIR"

cd "$ROOT_DIR"

generate_disclaimer_for_packages() {
  local output_file="$1"
  shift

  if (($# == 0)); then
    echo "No packages provided for $output_file." >&2
    exit 1
  fi

  local -a filter_args=()
  local package_name

  for package_name in "$@"; do
    filter_args+=(--filter "$package_name")
  done

  mkdir -p "$(dirname "$output_file")"
  pnpm "${filter_args[@]}" licenses list --prod --json \
    | pnpm dlx @quantco/pnpm-licenses generate-disclaimer --json-input --output-file "$output_file"
}

generate_npm_report_from_target() {
  local -a closure_package_names=()
  local -a report_target_fields=()
  local report_target="$1"
  local target_package_name
  local target_report_path

  IFS=$'\t' read -r -a report_target_fields <<< "$report_target"
  target_package_name="${report_target_fields[0]:-}"
  target_report_path="${report_target_fields[1]:-}"
  closure_package_names=("${report_target_fields[@]:2}")

  if [[ -z "$target_package_name" || -z "$target_report_path" || ${#closure_package_names[@]} -eq 0 ]]; then
    echo "Invalid npm notice target: $report_target" >&2
    exit 1
  fi

  echo "Generating npm notices for $target_package_name."
  generate_disclaimer_for_packages "$ROOT_DIR/$target_report_path" "${closure_package_names[@]}"
}

generate_npm_reports() {
  local target
  local target_list

  mkdir -p "$NPM_REPORT_DIR"

  target_list="$("$TSX" "$NPM_NOTICE_TARGETS_SCRIPT" npm-report-targets)"

  if [[ -z "$target_list" ]]; then
    echo "No npm notice targets found." >&2
    exit 1
  fi

  while IFS= read -r target; do
    if [[ -z "$target" ]]; then
      continue
    fi

    generate_npm_report_from_target "$target"
  done <<< "$target_list"

  generate_disclaimer_for_packages "$NPM_REPORT" "@contentful/*"
}

generate_js_bridge_report() {
  local target

  target="$("$TSX" "$NPM_NOTICE_TARGETS_SCRIPT" report-target "@contentful/optimization-js-bridge")"
  generate_npm_report_from_target "$target"
}

generate_android_report() {
  (
    cd "$ROOT_DIR/packages/android/ContentfulOptimization"
    ./gradlew --quiet exportLibraryDefinitions
  )
  pnpm exec tsx "$ROOT_DIR/scripts/format-android-third-party-notices.ts" \
    "$ANDROID_REPORT" \
    "$NORMALIZED_ANDROID_REPORT"

  {
    printf 'JavaScript bridge production dependency notices\n\n'
    cat "$JS_BRIDGE_REPORT"
    printf '\n---\n\nAndroid/Kotlin production dependency notices\n\n'
    cat "$NORMALIZED_ANDROID_REPORT"
  } > "$PUBLISHED_ANDROID_REPORT"
}

generate_swift_report() {
  if command -v license-plist >/dev/null 2>&1; then
    license-plist --config-path "$ROOT_DIR/packages/ios/license_plist.yml" --no-color
    pnpm exec tsx "$ROOT_DIR/scripts/format-ios-third-party-notices.ts" \
      "$IOS_RAW_REPORT" \
      "$IOS_REPORT"
  else
    swift_dependencies="$(
      swift package show-dependencies \
        --package-path "$ROOT_DIR/packages/ios/ContentfulOptimization" \
        --format flatlist
    )"

    if [[ -n "$swift_dependencies" ]]; then
      {
        echo "license-plist is required because Swift Package Manager dependencies were found."
        echo "Install it with Homebrew: brew install licenseplist"
      } >&2
      exit 1
    fi

    echo "No Swift Package Manager production dependencies are declared for packages/ios/ContentfulOptimization." > "$IOS_REPORT"
  fi

  {
    printf 'JavaScript bridge production dependency notices\n\n'
    cat "$JS_BRIDGE_REPORT"
    printf '\n---\n\nSwift Package Manager production dependency notices\n\n'
    cat "$IOS_REPORT"
  } > "$PUBLISHED_IOS_REPORT"
}

generate_aggregate_report() {
  {
    cat "$NPM_REPORT"
    printf '\n---\n\nAndroid/Kotlin production dependency notices\n\n'
    cat "$NORMALIZED_ANDROID_REPORT"
    printf '\n---\n\nSwift Package Manager production dependency notices\n\n'
    cat "$IOS_REPORT"
  } > "$OUTPUT_FILE"
}

case "$MODE" in
  all)
    generate_npm_reports
    generate_js_bridge_report
    generate_android_report
    generate_swift_report
    generate_aggregate_report
    ;;
  android)
    generate_js_bridge_report
    generate_android_report
    ;;
  npm)
    generate_npm_reports
    ;;
  swift)
    generate_js_bridge_report
    generate_swift_report
    ;;
  *)
    echo "Usage: $0 [all|npm|android|swift]" >&2
    exit 1
    ;;
esac
