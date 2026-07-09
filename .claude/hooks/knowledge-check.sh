#!/usr/bin/env bash
# Stop hook: nudge (never block) when the SDK knowledge base is currently failing knowledge:check.
#
# This is the in-session half of the source→KB sync loop. CI is the hard gate; this hook just
# surfaces drift in the same turn it was introduced, so an agent can fix it before finishing rather
# than discovering it on the PR. It is intentionally advisory: it emits additionalContext and always
# exits 0, so it can never trap the agent in a stop loop.
set -uo pipefail

# The hook receives the Stop event JSON on stdin; cwd tells us where the session is running.
input="$(cat)"
cwd="$(printf '%s' "$input" | sed -n 's/.*"cwd"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
[ -n "$cwd" ] && cd "$cwd" 2>/dev/null || true

# Only spend time when the knowledge base or package source changed in this working tree — a session
# that never touched either cannot have introduced KB drift.
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  changed="$(git status --porcelain -- documentation/internal/sdk-knowledge 'packages/**/src' 2>/dev/null)"
  [ -z "$changed" ] && exit 0
fi

# Run the deterministic validator. On success, stay silent and let the turn end.
if output="$(pnpm --silent knowledge:check 2>&1)"; then
  exit 0
fi

# On failure, feed the report back to the model as context (not a block). Cap the report so a large
# failure cannot flood the context window; the agent can always re-run knowledge:check for the rest.
max_lines=40
capped="$(printf '%s\n' "$output" | head -n "$max_lines")"
[ "$(printf '%s\n' "$output" | wc -l)" -gt "$max_lines" ] &&
  capped="${capped}
… (truncated; run \`pnpm knowledge:check\` to see all problems)"

# jq if present, else a minimal hand-built JSON payload — the hook must not depend on jq.
reason="Knowledge base check (pnpm knowledge:check) is failing. Fix these before finishing:

${capped}"

if command -v jq >/dev/null 2>&1; then
  jq -n --arg ctx "$reason" \
    '{hookSpecificOutput: {hookEventName: "Stop", additionalContext: $ctx}}'
else
  escaped="$(printf '%s' "$reason" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))' 2>/dev/null)"
  if [ -n "$escaped" ]; then
    printf '{"hookSpecificOutput":{"hookEventName":"Stop","additionalContext":%s}}\n' "$escaped"
  else
    # Last resort: print to stderr so the user at least sees it. Still non-blocking.
    printf '%s\n' "$reason" >&2
  fi
fi

exit 0
