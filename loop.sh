#!/usr/bin/env bash
# Ralph loop: ./loop.sh [plan|build] [max_iterations]   (0 = until <ralph>DONE</ralph>)
# ponytail: tool allowlist, not --dangerously-skip-permissions. npx still runs arbitrary code — prefer a container/VM.
set -uo pipefail
cd "$(dirname "$0")"
mode=${1:-build}; max=${2:-0}; prompt="PROMPT_${mode}.md"
[ -f "$prompt" ] || { echo "No $prompt" >&2; exit 1; }
tools="Read,Edit,Write,Glob,Grep,Agent,Bash(npm:*),Bash(npx:*),Bash(node:*),Bash(mv:*),Bash(cp:*),Bash(rm:*),Bash(ls:*),Bash(mkdir:*),Bash(git status:*),Bash(git diff:*),Bash(git log:*),Bash(git add:*),Bash(git commit:*),Bash(git checkout:*)"
# taste skill screenshots need a Chrome; Playwright's Chromium will do.
export CHROME_PATH=${CHROME_PATH:-$(ls -d ~/.cache/ms-playwright/chromium-*/chrome-linux*/chrome 2>/dev/null | tail -1)}

for ((i = 1; max == 0 || i <= max; i++)); do
  echo "=== $mode #$i  $(date '+%F %T') ===" >&2
  if ! out=$(claude -p --allowedTools "$tools" --model "${MODEL:-opus}" < "$prompt" | tee /dev/stderr); then
    echo "claude failed (usage limit?), retrying in 60 s" >&2; sleep 60; ((i--)); continue
  fi
  grep -q '<ralph>DONE</ralph>' <<<"$out" && { echo "All done." >&2; break; }
done
