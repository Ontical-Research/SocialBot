#!/usr/bin/env bash
# Print a Mermaid dependency graph for a feature, color-coded by status.
# Usage: gh-feature-dependency-graph.sh <owner> <repo> <issue-numbers...>
#
# Output: a Mermaid graph definition to stdout.

set -euo pipefail

OWNER="$1"
REPO="$2"
shift 2
ISSUES=("$@")

# Mermaid style classes for issue states.
echo "graph LR"
echo "  classDef open fill:#dbeafe,stroke:#3b82f6,color:#1e40af"
echo "  classDef closed fill:#dcfce7,stroke:#22c55e,color:#166534"
echo "  classDef inprogress fill:#fef9c3,stroke:#eab308,color:#854d0e"
echo ""

for ISSUE_NUM in "${ISSUES[@]}"; do
  ISSUE_JSON=$(gh issue view "$ISSUE_NUM" --repo "${OWNER}/${REPO}" \
    --json number,title,state,body 2>/dev/null || echo '{}')

  TITLE=$(echo "$ISSUE_JSON" | jq -r '.title // "?"' | head -c 40)
  STATE=$(echo "$ISSUE_JSON" | jq -r '.state // "UNKNOWN"')
  BODY=$(echo "$ISSUE_JSON" | jq -r '.body // ""')

  # Determine CSS class.
  case "$STATE" in
    OPEN)   CLASS="open" ;;
    CLOSED) CLASS="closed" ;;
    *)      CLASS="open" ;;
  esac

  # Emit node.
  echo "  ${ISSUE_NUM}[\"#${ISSUE_NUM}: ${TITLE}\"]:::${CLASS}"

  # Parse dependencies from issue body.
  BLOCKERS=$(echo "$BODY" | grep -ioE '(blocked by|depends on) #[0-9]+' | grep -oE '[0-9]+' || true)
  for BLOCKER in $BLOCKERS; do
    echo "  ${BLOCKER} --> ${ISSUE_NUM}"
  done

  # Also try the REST API for dependencies.
  REST_BLOCKERS=$(gh api "repos/${OWNER}/${REPO}/issues/${ISSUE_NUM}/dependencies/blocked_by" \
    --jq '.[].number' 2>/dev/null || true)
  for BLOCKER in $REST_BLOCKERS; do
    # Avoid duplicate edges.
    if ! echo "$BLOCKERS" | grep -qw "$BLOCKER"; then
      echo "  ${BLOCKER} --> ${ISSUE_NUM}"
    fi
  done
done
