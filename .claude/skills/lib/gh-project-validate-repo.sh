#!/usr/bin/env bash
# Validate that a repository is linked to a GitHub Project.
# Usage: gh-project-validate-repo.sh <owner> <project-number> <repo-owner> <repo-name>
#
# Exits 0 if the repo has issues on the project, exits 1 otherwise.

set -euo pipefail

OWNER="$1"
PROJECT_NUMBER="$2"
REPO_OWNER="$3"
REPO_NAME="$4"

# List project items and check if any come from the specified repo.
ITEMS=$(gh project item-list "$PROJECT_NUMBER" --owner "$OWNER" --format json --limit 200)

REPO_MATCH=$(echo "$ITEMS" | jq -r --arg repo "${REPO_OWNER}/${REPO_NAME}" \
  '[.items[] | select(.content.repository == $repo)] | length')

if [ "$REPO_MATCH" -gt 0 ]; then
  echo "Repo ${REPO_OWNER}/${REPO_NAME} has ${REPO_MATCH} item(s) on project ${PROJECT_NUMBER}."
  exit 0
else
  echo "Error: repo ${REPO_OWNER}/${REPO_NAME} has no items on project ${PROJECT_NUMBER}." >&2
  echo "Link the repo to the project first, or check the project URL." >&2
  exit 1
fi
