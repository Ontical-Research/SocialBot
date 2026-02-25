#!/usr/bin/env bash
# Update a project item's status field.
# Usage: gh-project-set-status.sh <owner> <project-number> <item-id> <status-name>
#
# <status-name> is one of: "Todo", "In Progress", "Done"
# (or whatever status names the project uses — the script looks them up.)

set -euo pipefail

OWNER="$1"
PROJECT_NUMBER="$2"
ITEM_ID="$3"
STATUS_NAME="$4"

# Look up field definitions.
FIELDS_JSON=$(gh project field-list "$PROJECT_NUMBER" --owner "$OWNER" --format json)

# Extract the Status field ID.
STATUS_FIELD_ID=$(echo "$FIELDS_JSON" | jq -r '.fields[] | select(.name == "Status") | .id')
if [ -z "$STATUS_FIELD_ID" ] || [ "$STATUS_FIELD_ID" = "null" ]; then
  echo "Error: could not find Status field in project $PROJECT_NUMBER" >&2
  exit 1
fi

# Extract the option ID for the requested status.
OPTION_ID=$(echo "$FIELDS_JSON" | jq -r --arg name "$STATUS_NAME" \
  '.fields[] | select(.name == "Status") | .options[] | select(.name == $name) | .id')
if [ -z "$OPTION_ID" ] || [ "$OPTION_ID" = "null" ]; then
  echo "Error: status '${STATUS_NAME}' not found. Available:" >&2
  echo "$FIELDS_JSON" | jq -r '.fields[] | select(.name == "Status") | .options[].name' >&2
  exit 1
fi

# Get the project node ID (not the project number).
PROJECT_ID=$(gh api graphql -f query='
query($owner: String!, $number: Int!) {
  organization(login: $owner) {
    projectV2(number: $number) { id }
  }
}' -f owner="$OWNER" -F number="$PROJECT_NUMBER" \
  --jq '.data.organization.projectV2.id' 2>/dev/null || \
gh api graphql -f query='
query($owner: String!, $number: Int!) {
  user(login: $owner) {
    projectV2(number: $number) { id }
  }
}' -f owner="$OWNER" -F number="$PROJECT_NUMBER" \
  --jq '.data.user.projectV2.id')

# Update the field.
gh api graphql -f query='
mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
  updateProjectV2ItemFieldValue(input: {
    projectId: $projectId
    itemId: $itemId
    fieldId: $fieldId
    value: { singleSelectOptionId: $optionId }
  }) {
    projectV2Item { id }
  }
}' -f projectId="$PROJECT_ID" -f itemId="$ITEM_ID" -f fieldId="$STATUS_FIELD_ID" -f optionId="$OPTION_ID" \
  --silent

echo "Set item ${ITEM_ID} status to '${STATUS_NAME}'"
