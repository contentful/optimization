#!/usr/bin/env bash
set -euo pipefail

json=false
paths_only=false
while (($#)); do
  case "$1" in
    --json|-Json)
      json=true
      shift
      ;;
    --paths-only|-PathsOnly)
      paths_only=true
      shift
      ;;
    *)
      shift
      ;;
  esac
done

branch_name=$(git rev-parse --abbrev-ref HEAD)
feature_dir="specs/${branch_name}"
feature_spec="${feature_dir}/spec.md"
impl_plan="${feature_dir}/plan.md"
tasks="${feature_dir}/tasks.md"

if [[ ! -f "$feature_spec" ]]; then
  echo "Feature spec not found at ${feature_spec}" >&2
  exit 1
fi

if $json; then
  printf '{"FEATURE_DIR":"%s","FEATURE_SPEC":"%s","IMPL_PLAN":"%s","TASKS":"%s"}\n' \
    "$feature_dir" "$feature_spec" "$impl_plan" "$tasks"
else
  echo "FEATURE_DIR=$feature_dir"
  echo "FEATURE_SPEC=$feature_spec"
  echo "IMPL_PLAN=$impl_plan"
  echo "TASKS=$tasks"
fi
