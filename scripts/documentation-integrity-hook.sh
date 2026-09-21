#!/usr/bin/env bash
# Advisory Stop hook for Claude and Codex: surface documentation integrity failures without
# blocking the agent. The first argument selects the client's JSON output envelope.
set -uo pipefail

client="${1:-}"

# The hook receives the Stop event JSON on stdin; cwd tells us where the session is running.
input="$(cat)"
cwd="$(printf '%s' "$input" | sed -n 's/.*"cwd"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
[ -n "$cwd" ] && cd "$cwd" 2>/dev/null || true

# Only spend time when something the validators inspect changed in this working tree.
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  changed="$(git status --porcelain -- documentation/internal/sdk-knowledge documentation/internal/migration-knowledge documentation/authoring documentation/guides documentation/concepts documentation/fern-slugs.lock.json skills scripts/validate-guide-authoring.ts scripts/validate-sdk-knowledge.ts scripts/validate-fern-export.ts scripts/fern 'packages/**/src/**' 2>/dev/null)"
  [ -z "$changed" ] && exit 0
fi

# Run every validator even when an earlier one fails so the agent receives the complete status.
# `fern:check` is here because the publishing contract it enforces — a document listed in its group
# README `children:`, a recorded slug, resolvable links, safe MDX — is what decides whether an edit
# reaches the public site at all, and the ways it breaks are silent rather than loud.
knowledge_status=0
guide_status=0
fern_status=0
knowledge_output="$(pnpm --silent knowledge:check 2>&1)" || knowledge_status=$?
guide_output="$(pnpm --silent guides:check 2>&1)" || guide_status=$?
fern_output="$(pnpm --silent fern:check 2>&1)" || fern_status=$?
if [ "$knowledge_status" -eq 0 ] && [ "$guide_status" -eq 0 ] && [ "$fern_status" -eq 0 ]; then
  exit 0
fi

# Cap the report so a large failure cannot flood the context window.
max_lines=40
capped="$(printf '%s\n%s\n%s\n' "$knowledge_output" "$guide_output" "$fern_output" | head -n "$max_lines")"
[ "$(printf '%s\n%s\n%s\n' "$knowledge_output" "$guide_output" "$fern_output" | wc -l)" -gt "$max_lines" ] &&
  capped="${capped}
… (truncated; run \`pnpm knowledge:check\`, \`pnpm guides:check\`, and \`pnpm fern:check\` to see all problems)"

reason="Documentation integrity checks are failing. Fix these before finishing:

${capped}"

# jq if present, else Python's standard-library encoder. Both clients treat this as advisory.
if command -v jq >/dev/null 2>&1; then
  case "$client" in
    claude)
      jq -n --arg ctx "$reason" \
        '{hookSpecificOutput: {hookEventName: "Stop", additionalContext: $ctx}}'
      ;;
    codex)
      jq -n --arg ctx "$reason" '{systemMessage: $ctx}'
      ;;
    *)
      printf '%s\n' "$reason" >&2
      ;;
  esac
else
  escaped="$(printf '%s' "$reason" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))' 2>/dev/null)"
  if [ -n "$escaped" ]; then
    case "$client" in
      claude)
        printf '{"hookSpecificOutput":{"hookEventName":"Stop","additionalContext":%s}}\n' "$escaped"
        ;;
      codex)
        printf '{"systemMessage":%s}\n' "$escaped"
        ;;
      *)
        printf '%s\n' "$reason" >&2
        ;;
    esac
  else
    printf '%s\n' "$reason" >&2
  fi
fi

exit 0
