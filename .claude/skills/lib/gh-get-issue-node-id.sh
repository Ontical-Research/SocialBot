#!/usr/bin/env bash
# Get the GraphQL node ID for a GitHub issue.
# Usage: gh-get-issue-node-id.sh <owner> <repo> <issue-number>
#
# Prints the node ID (e.g., I_kwDOBx...) to stdout.

set -euo pipefail

OWNER="$1"
REPO="$2"
ISSUE_NUMBER="$3"

gh api graphql -f query='
query($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    issue(number: $number) {
      id
    }
  }
}' -f owner="$OWNER" -f repo="$REPO" -F number="$ISSUE_NUMBER" \
  --jq '.data.repository.issue.id'
