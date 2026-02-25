#!/usr/bin/env bash
# Add an issue to a GitHub Project and return the project item ID.
# Usage: gh-project-add-issue.sh <owner> <project-number> <issue-url>
#
# Output: the project item ID (PVTI_...) on stdout.

set -euo pipefail

OWNER="$1"
PROJECT_NUMBER="$2"
ISSUE_URL="$3"

RESULT=$(gh project item-add "$PROJECT_NUMBER" --owner "$OWNER" --url "$ISSUE_URL" --format json)
ITEM_ID=$(echo "$RESULT" | jq -r '.id')

echo "$ITEM_ID"
