#!/usr/bin/env bash
set -euo pipefail

agent="${1:-codex}"
context_file="AGENTS.md"
start='<!-- AUTO-GENERATED:START -->'
end='<!-- AUTO-GENERATED:END -->'

if [[ ! -f "$context_file" ]]; then
  cat > "$context_file" <<CTX
# Agent Context

${start}
${end}
CTX
fi

if ! rg -q "^${start}$" "$context_file"; then
  printf "\n%s\n%s\n" "$start" "$end" >> "$context_file"
fi

tmp=$(mktemp)
awk -v start="$start" -v end="$end" -v agent="$agent" '
  BEGIN { in_block=0 }
  {
    if ($0==start) {
      print $0
      print "- Agent: " agent
      print "- Planned feature: React Web SDK package"
      print "- Tooling constraints: align with Web SDK; prioritize bundle size and perf"
      print "- Testing constraint: use MSW handlers from lib/mocks/src/*-handlers.ts"
      in_block=1
      next
    }
    if ($0==end) {
      in_block=0
      print $0
      next
    }
    if (!in_block) print $0
  }
' "$context_file" > "$tmp"
mv "$tmp" "$context_file"

printf '{"agent":"%s","updated":"%s"}\n' "$agent" "$context_file"
