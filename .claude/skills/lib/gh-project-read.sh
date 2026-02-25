#!/usr/bin/env bash
# Read all items from a GitHub Project, including status field values.
# Usage: gh-project-read.sh <owner> <project-number>
#
# Output: JSON with items, field definitions, and project metadata.
# Each item includes: issue number, repo, title, status, and node IDs needed
# for later updates.

set -euo pipefail

OWNER="$1"
PROJECT_NUMBER="$2"

echo "=== Project field definitions ===" >&2
FIELDS=$(gh project field-list "$PROJECT_NUMBER" --owner "$OWNER" --format json)
echo "$FIELDS" | jq -r '.fields[] | select(.name == "Status") | "Status field: \(.id)\nOptions: \(.options | map(.name + " = " + .id) | join(", "))"' >&2

echo "=== Project items ===" >&2
ITEMS=$(gh project item-list "$PROJECT_NUMBER" --owner "$OWNER" --format json --limit 200)
echo "$ITEMS" | jq -r '.items[] | "  \(.content.type // "draft") \(.content.number // "—") \(.status // "—") \(.content.title // .title)"' >&2

# Output full JSON for programmatic use.
jq -n \
  --argjson fields "$FIELDS" \
  --argjson items "$ITEMS" \
  '{ fields: $fields, items: $items }'
