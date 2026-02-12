#!/usr/bin/env bash
set -euo pipefail

json=false
while (($#)); do
  case "$1" in
    --json|-Json)
      json=true
      shift
      ;;
    *)
      shift
      ;;
  esac
done

branch=$(git rev-parse --abbrev-ref HEAD)
specs_dir="specs/${branch}"
feature_spec="${specs_dir}/spec.md"
impl_plan="${specs_dir}/plan.md"

if [[ ! -f "$feature_spec" ]]; then
  echo "Feature spec not found at ${feature_spec}" >&2
  exit 1
fi

mkdir -p "$specs_dir"
if [[ ! -f "$impl_plan" ]]; then
  cp .specify/templates/plan-template.md "$impl_plan"
fi

if $json; then
  printf '{"FEATURE_SPEC":"%s","IMPL_PLAN":"%s","SPECS_DIR":"%s","BRANCH":"%s"}\n' \
    "$feature_spec" "$impl_plan" "$specs_dir" "$branch"
else
  echo "FEATURE_SPEC=$feature_spec"
  echo "IMPL_PLAN=$impl_plan"
  echo "SPECS_DIR=$specs_dir"
  echo "BRANCH=$branch"
fi
