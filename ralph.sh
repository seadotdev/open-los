#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: ./ralph.sh <prompt-file> [--max <n>]"
  echo ""
  echo "Example:"
  echo "  ./ralph.sh prompts/phase-3.md --max 25"
  exit 1
}

[[ $# -lt 1 ]] && usage

PROMPT_FILE="$1"
MAX=25

shift 1
while [[ $# -gt 0 ]]; do
  case "$1" in
    --max) MAX="$2"; shift 2 ;;
    *) usage ;;
  esac
done

[[ ! -f "$PROMPT_FILE" ]] && echo "Prompt file not found: $PROMPT_FILE" && exit 1

PROMPT="$(cat "$PROMPT_FILE")"

for i in $(seq 1 "$MAX"); do
  echo ""
  echo "==============================="
  echo "  Iteration $i / $MAX"
  echo "==============================="
  echo ""

  claude -p "$PROMPT"

  echo ""
  echo "--- Running tests ---"
  TEST_OUTPUT=$(npx vitest run 2>&1)
  echo "$TEST_OUTPUT"

  # Check for failures - vitest shows "X failed" only when there are failures
  if echo "$TEST_OUTPUT" | grep -qE "[0-9]+ failed"; then
    echo ""
    echo "Tests still failing, looping..."
  else
    echo ""
    echo "ALL TESTS PASSING — done after $i iterations."
    exit 0
  fi
done

echo ""
echo "Hit max iterations ($MAX) without all tests passing."
exit 1
