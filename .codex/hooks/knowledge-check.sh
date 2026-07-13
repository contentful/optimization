#!/usr/bin/env bash
# Stop hook: nudge (never block) when the documentation integrity checks are currently failing.
#
# This is the in-session half of the source→KB sync loop. CI is the hard gate; this hook just
# surfaces drift in the same turn it was introduced, so an agent can fix it before finishing rather
# than discovering it on the PR. It is intentionally advisory: it emits a system message and always
# exits 0, so it can never trap the agent in a stop loop.
set -uo pipefail

# The hook receives the Stop event JSON on stdin; cwd tells us where the session is running.
input="$(cat)"
cwd="$(printf '%s' "$input" | sed -n 's/.*"cwd"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
[ -n "$cwd" ] && cd "$cwd" 2>/dev/null || true

# Only spend time when something the validator inspects changed in this working tree: the knowledge
# base, authoring inputs, package source, or a guide. A session touching none of these cannot have
# introduced drift the validators would catch.
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  changed="$(git status --porcelain -- documentation/internal/sdk-knowledge documentation/authoring documentation/guides skills scripts/validate-guide-authoring.ts scripts/validate-sdk-knowledge.ts 'packages/**/src/**' 2>/dev/null)"
  [ -z "$changed" ] && exit 0
fi

# Run both deterministic validators. On success, stay silent and let the turn end.
knowledge_status=0
guide_status=0
knowledge_output="$(pnpm --silent knowledge:check 2>&1)" || knowledge_status=$?
guide_output="$(pnpm --silent guides:check 2>&1)" || guide_status=$?
if [ "$knowledge_status" -eq 0 ] && [ "$guide_status" -eq 0 ]; then
  exit 0
fi

# On failure, surface the report as a warning (not a block). Cap it so a large failure cannot flood
# the context window; the agent can always re-run the checks for the rest.
max_lines=40
capped="$(printf '%s\n%s\n' "$knowledge_output" "$guide_output" | head -n "$max_lines")"
[ "$(printf '%s\n%s\n' "$knowledge_output" "$guide_output" | wc -l)" -gt "$max_lines" ] &&
  capped="${capped}
… (truncated; run \`pnpm knowledge:check\` and \`pnpm guides:check\` to see all problems)"

# jq if present, else a minimal hand-built JSON payload — the hook must not depend on jq.
reason="Documentation integrity checks are failing. Fix these before finishing:

${capped}"

if command -v jq >/dev/null 2>&1; then
  jq -n --arg ctx "$reason" \
    '{systemMessage: $ctx}'
else
  escaped="$(printf '%s' "$reason" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))' 2>/dev/null)"
  if [ -n "$escaped" ]; then
    printf '{"systemMessage":%s}\n' "$escaped"
  else
    # Last resort: print to stderr so the user at least sees it. Still non-blocking.
    printf '%s\n' "$reason" >&2
  fi
fi

exit 0
