# lib/ — Shared helper scripts for Epik skills

These scripts wrap `gh` CLI and GitHub GraphQL API calls so that Claude Code
skills don't have to figure out the API every time. Each script is a
self-contained bash script with usage documented in its header comment.

## Scripts

| Script                           | Purpose                                             |
|----------------------------------|-----------------------------------------------------|
| `gh-get-issue-node-id.sh`        | Get the GraphQL node ID for an issue                |
| `gh-add-dependency.sh`           | Add a blocked-by relationship between issues        |
| `gh-read-dependencies.sh`        | Read blocking/blocked-by relationships              |
| `gh-project-read.sh`             | Read all items and field definitions from a project |
| `gh-project-set-status.sh`       | Update a project item's status field                |
| `gh-project-add-issue.sh`        | Add an issue to a project, return item ID           |
| `gh-project-validate-repo.sh`    | Check that a repo is linked to a project            |
| `gh-feature-status-report.sh`    | Print a markdown status table with icons            |
| `gh-feature-dependency-graph.sh` | Print a Mermaid dependency graph                    |

## Usage from skills

Skills reference these scripts relative to the skills directory:

```bash
./lib/gh-project-set-status.sh epik-agent 5 "$ITEM_ID" "In Progress"
```

## Requirements

- `gh` CLI authenticated with appropriate scopes
- `jq` for JSON processing
