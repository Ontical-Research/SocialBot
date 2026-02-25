#!/usr/bin/env bash
# Add a blocked-by dependency between two issues.
# Usage: gh-add-dependency.sh <owner> <repo> <blocked-issue-number> <blocker-issue-number>
#
# Makes <blocked-issue> blocked by <blocker-issue>.

set -euo pipefail

OWNER="$1"
REPO="$2"
BLOCKED="$3"
BLOCKER="$4"

# Use the REST API for issue dependencies.
# This creates a "blocked by" relationship visible on the GitHub UI.
gh api \
  --method POST \
  "repos/${OWNER}/${REPO}/issues/${BLOCKED}/dependencies/blocked_by" \
  -f depends_on="$BLOCKER" \
  --silent 2>/dev/null || {
    echo "Warning: could not add dependency (${BLOCKED} blocked by ${BLOCKER}). The REST API for issue dependencies may not be available." >&2
    echo "Falling back to noting dependency in issue body." >&2
    exit 1
  }

echo "Issue #${BLOCKED} is now blocked by #${BLOCKER}"
