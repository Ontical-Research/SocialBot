#!/usr/bin/env bash
# Print a status report table for a feature (set of issues).
# Usage: gh-feature-status-report.sh <owner> <repo> <issue-numbers...>
#
# Prints a markdown-formatted status table with icons.

set -euo pipefail

OWNER="$1"
REPO="$2"
shift 2
ISSUES=("$@")

# Icon map for issue states.
icon_for_state() {
  case "$1" in
    OPEN)   echo "🔵" ;;
    CLOSED) echo "✅" ;;
    *)      echo "⚪" ;;
  esac
}

icon_for_pr() {
  case "$1" in
    MERGED) echo "🟣" ;;
    OPEN)   echo "🟡" ;;
    CLOSED) echo "🔴" ;;
    NONE)   echo "—"  ;;
    *)      echo "⚪" ;;
  esac
}

echo ""
echo "| # | Status | PR | Title |"
echo "|---|--------|-----|-------|"

for ISSUE_NUM in "${ISSUES[@]}"; do
  # Fetch issue details.
  ISSUE_JSON=$(gh issue view "$ISSUE_NUM" --repo "${OWNER}/${REPO}" \
    --json number,title,state,linkedBranches 2>/dev/null || echo '{}')

  TITLE=$(echo "$ISSUE_JSON" | jq -r '.title // "?"')
  STATE=$(echo "$ISSUE_JSON" | jq -r '.state // "UNKNOWN"')
  ISSUE_ICON=$(icon_for_state "$STATE")

  # Check for linked PR.
  PR_STATE="NONE"
  PR_NUM=""
  BRANCH=$(echo "$ISSUE_JSON" | jq -r '.linkedBranches[0].branchName // empty')
  if [ -n "$BRANCH" ]; then
    PR_JSON=$(gh pr list --repo "${OWNER}/${REPO}" --head "$BRANCH" --json number,state --limit 1 2>/dev/null || echo '[]')
    PR_STATE=$(echo "$PR_JSON" | jq -r '.[0].state // "NONE"')
    PR_NUM=$(echo "$PR_JSON" | jq -r '.[0].number // empty')
  fi
  PR_ICON=$(icon_for_pr "$PR_STATE")
  PR_DISPLAY="${PR_ICON}"
  [ -n "$PR_NUM" ] && PR_DISPLAY="${PR_ICON} #${PR_NUM}"

  echo "| #${ISSUE_NUM} | ${ISSUE_ICON} ${STATE} | ${PR_DISPLAY} | ${TITLE} |"
done

echo ""
echo "Legend: 🔵 Open  ✅ Closed  🟡 PR Open  🟣 PR Merged  🔴 PR Closed"
echo ""
