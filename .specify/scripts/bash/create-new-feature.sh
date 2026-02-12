#!/usr/bin/env bash
set -euo pipefail

json_output=false
number=""
short_name=""

declare -a positional=()

while (($#)); do
  case "$1" in
    --json)
      json_output=true
      shift
      ;;
    --number)
      number="${2:-}"
      shift 2
      ;;
    --short-name)
      short_name="${2:-}"
      shift 2
      ;;
    --)
      shift
      while (($#)); do positional+=("$1"); shift; done
      ;;
    *)
      positional+=("$1")
      shift
      ;;
  esac
done

if [[ -z "$number" || -z "$short_name" ]]; then
  echo "Missing required --number and/or --short-name" >&2
  exit 1
fi

if ((${#positional[@]} == 0)); then
  echo "Missing feature description" >&2
  exit 1
fi

feature_desc="${positional[*]}"
branch_name="${number}-${short_name}"
feature_dir="specs/${branch_name}"
spec_file="${feature_dir}/spec.md"

if ! git rev-parse --verify "$branch_name" >/dev/null 2>&1; then
  git checkout -b "$branch_name" >/dev/null
else
  git checkout "$branch_name" >/dev/null
fi

mkdir -p "$feature_dir"

if [[ -f ".specify/templates/spec-template.md" ]]; then
  cp ".specify/templates/spec-template.md" "$spec_file"
else
  cat > "$spec_file" <<'SPEC'
# Feature Specification: <feature>

## Problem Statement

## Scope

## Functional Requirements

## Success Criteria
SPEC
fi

if $json_output; then
  escaped_desc=$(printf '%s' "$feature_desc" | sed 's/\\/\\\\/g; s/"/\\"/g')
  printf '{"BRANCH_NAME":"%s","FEATURE_DIR":"%s","SPEC_FILE":"%s","FEATURE_DESCRIPTION":"%s"}\n' \
    "$branch_name" "$feature_dir" "$spec_file" "$escaped_desc"
else
  echo "BRANCH_NAME=$branch_name"
  echo "FEATURE_DIR=$feature_dir"
  echo "SPEC_FILE=$spec_file"
fi
