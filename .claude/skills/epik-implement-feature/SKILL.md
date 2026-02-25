---
name: epik-implement-feature
description: Implement a feature (set of GitHub issues) in dependency order.
---

Implement a feature — a set of GitHub issues worked on as a group — in
dependency order, shepherding each one from implementation through merged pull
request before starting the next.

$ARGUMENTS takes two parts:

1. A **GitHub Project URL**, e.g.
   `https://github.com/orgs/epik-agent/projects/5`
2. A **space-separated list of issue numbers**, e.g. `31 32 33 34 35`

Example: `/epik-implement-feature https://github.com/orgs/epik-agent/projects/5 31 32 33 34 35`

---

## Step 0 — Validate inputs

Extract the project number and owner from the Project URL. Determine the repo
from the current git working directory.

Validate that the repo is linked to the project:
```
.claude/skills/lib/gh-project-validate-repo.sh <owner> <project-number> <repo-owner> <repo-name>
```

If the repo has no items on the project, raise an error and stop. The repo must
be linked to the project before Epik can work on it.

---

## Phase 1 — Gather issues and resolve dependencies

Fetch every issue in the list:
```
gh issue view <n> --repo <repo> --json number,title,body,state
```

Read the project board to get item IDs and field definitions:
```
.claude/skills/lib/gh-project-read.sh <owner> <project-number>
```

Save the field/option IDs — you will need them to update issue statuses.

### Dependency analysis

For each issue, read its dependencies from both sources:

1. **GitHub API** (preferred):
   ```
   .claude/skills/lib/gh-read-dependencies.sh <owner> <repo> <issue-number> blocked_by
   ```
2. **Issue body** (fallback): parse for `Blocked by #N`, `blocked by #N`,
   `depends on #N`.

Build a directed dependency graph. Compute BFS waves:
- **Wave 1:** Issues with no unresolved blockers.
- **Wave 2:** Issues whose only blockers are in Wave 1.
- **Wave N:** Issues whose blockers are all in earlier waves.

If there are circular dependencies, stop and report the cycle.

### Expand preconditions

Check whether any issue in the list has a blocker that is NOT in the list and
is still open. If so, add the missing blocker to the feature automatically and
inform the human:

```
Note: Issue #33 is blocked by #29, which is not in the requested list and is
still open. Adding #29 to the feature.
```

### Print the wave plan

```
Feature: 6 issues in 3 waves

Wave 1 (no blockers):
  #29 — Set up database migrations
  #31 — Deploy health endpoint to Vercel
  #32 — Initialize project with TypeScript + Vitest

Wave 2 (blocked by Wave 1):
  #33 — Implement user model (blocked by #29, #31, #32)
  #34 — Add authentication middleware (blocked by #32)

Wave 3 (blocked by Wave 2):
  #35 — Build dashboard page (blocked by #33, #34)
```

### Print dependency graph

```
.claude/skills/lib/gh-feature-dependency-graph.sh <owner> <repo> 29 31 32 33 34 35
```

Display the Mermaid output so the human can see the dependency structure
color-coded by issue status (open/closed).

---

## Phase 2 — Execute waves

Process waves sequentially. Never start a wave until all issues in the previous
wave are merged to main.

For each issue in the current wave:

### Step A — Status report

Print a status table before each issue:
```
.claude/skills/lib/gh-feature-status-report.sh <owner> <repo> 29 31 32 33 34 35
```

Print: `▶ Starting issue #<N>: <title> (Wave <W>)`

### Step B — Update project status to "In Progress"

```
.claude/skills/lib/gh-project-set-status.sh <owner> <project-number> "$ITEM_ID" "In Progress"
```

### Step C — Implement

Run `/epik-implement-issue <issue-number>`.

This creates a feature branch in a worktree, implements with TDD, runs
integration tests if specified, and opens a pull request.

### Step D — Resolve and merge

Run `/epik-resolve-pull-request <PR-number>` for the PR created in Step C.

This fixes any CI failures, merge conflicts, or review comments, then squash-
merges into main and runs post-merge integration tests.

### Step E — Update project status to "Done"

GitHub auto-closes the issue when the PR merges (via `Closes #N`), which
typically moves it to "Done" on the project board automatically. Verify:
```
.claude/skills/lib/gh-project-set-status.sh <owner> <project-number> "$ITEM_ID" "Done"
```

### Step F — Advance

Confirm the PR is merged:
```
gh pr view <PR-number> --json state,mergedAt
```

Print: `✅ Issue #<N> merged.`

Only after confirmed merged, proceed to the next issue or wave.

**Skip rule:** If an issue is already closed or its acceptance criteria are
already met by existing code, note this, close the issue with a comment
explaining why, update its project status to "Done", and move on.

---

## Phase 3 — Final verification

After all issues are merged, run the full test suite on main:

```
git checkout main
git pull origin main
pnpm test:run
```

(Or the project's equivalent test command.)

### Final status report

Print the final status table and dependency graph:
```
.claude/skills/lib/gh-feature-status-report.sh <owner> <repo> 29 31 32 33 34 35
.claude/skills/lib/gh-feature-dependency-graph.sh <owner> <repo> 29 31 32 33 34 35
```

Report the final result:

```
✅ Feature complete: 6 issues implemented and merged.
🧪 Test suite: 42 passed, 0 failed.
```

If any tests fail, investigate and report — but do not open new PRs
automatically. The human decides what to do about regressions at this point.

---

## Rules

- Never start an issue whose blockers are not yet merged to main.
- Never merge a PR until its CI checks all pass.
- Use squash merge (`--squash`) for every PR. Main stays linear.
- Process one issue at a time, never in parallel.
- Print a status report before each issue so the human can see progress.
- If a missing precondition is discovered, add it to the feature and inform the
  human — don't silently skip or fail.
