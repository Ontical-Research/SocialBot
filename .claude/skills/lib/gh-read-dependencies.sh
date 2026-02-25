#!/usr/bin/env bash
# Read blocking/blocked-by relationships for an issue.
# Usage: gh-read-dependencies.sh <owner> <repo> <issue-number> [blocking|blocked_by]
#
# Direction defaults to "blocked_by" (issues that block this one).
# Output: JSON array of issue numbers.

set -euo pipefail

OWNER="$1"
REPO="$2"
ISSUE_NUMBER="$3"
DIRECTION="${4:-blocked_by}"

gh api "repos/${OWNER}/${REPO}/issues/${ISSUE_NUMBER}/dependencies/${DIRECTION}" \
  --jq '.[].number' 2>/dev/null || {
    # REST API may not be available — fall back to parsing issue body.
    echo "Warning: REST dependency API not available. Parse issue body instead." >&2
    exit 1
  }
