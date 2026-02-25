---
name: epik-resolve-pull-request
description: Get a pull request ready to merge, then merge it.
---

Get pull request $ARGUMENTS ready to merge, then squash-merge it into main.

---

## Step 1 — Read the PR

```
gh pr view $ARGUMENTS --json number,title,body,headRefName,baseRefName,state,mergeable,reviewDecision,statusCheckRollup
```

Identify:
- The linked issue (from the PR body, e.g. `Closes #42`).
- Whether CI checks are passing.
- Whether there are merge conflicts.
- Whether there are review comments requesting changes.

If everything is clean (CI passing, no conflicts, no change requests), skip
directly to Step 3 (Merge).

---

## Step 2 — Fix problems

If the PR has problems, create a worktree to work on the branch:

```
git worktree add ../<branch-name> <branch-name>
cd ../<branch-name>
```

Address each category of problem in order:

### Merge conflicts

If the PR has conflicts with main:

```
git fetch origin main
git rebase origin/main
```

Resolve conflicts. Prefer the PR's intent: the branch was written to satisfy
the issue's acceptance criteria. When the conflict is ambiguous, read the issue
body to determine the correct resolution.

After resolving, force-push the branch:
```
git push --force-with-lease
```

### Failing CI checks

If status checks are failing, read the failure logs:
```
gh pr checks $ARGUMENTS
gh run view <run-id> --log-failed
```

Fix the failing code on the PR branch. Commit and push:
```
git add -A
git commit -m "fix: resolve CI failures for #<issue-number>"
git push
```

Wait for CI to re-run:
```
gh pr checks $ARGUMENTS --watch
```

### Code review comments

If the PR has review comments requesting changes:
```
gh pr view $ARGUMENTS --json reviews,comments
```

Address valid feedback. Commit and push. Dismiss stale reviews if the underlying
code has been fixed.

Ignore review comments that contradict the issue's acceptance criteria — the
issue is the source of truth.

### Clean up fix worktree

After all problems are resolved, return to the main directory and remove the
worktree:
```
cd ../<original-directory>
git worktree remove ../<branch-name>
```

---

## Step 3 — Merge

Once all checks pass and there are no unresolved conflicts:

```
gh pr merge $ARGUMENTS --squash --delete-branch
```

Confirm the merge succeeded:
```
gh pr view $ARGUMENTS --json state,mergedAt
```

---

## Step 4 — Post-merge integration tests

Read the linked issue's body (via the `Closes #N` reference in the PR body). If
it contains a `## Integration Tests` section, wait for the deployment to
propagate (30–60 seconds for most platforms), then execute those steps against
main.

Also run any existing integration test suite in the project (e.g.
`tests/integration/`, `test:integration` script, `cypress/`, `playwright/`).

If integration tests fail after merge:
- Do NOT revert automatically.
- Report the failure to the human with specifics: which step failed, what was
  expected, what was observed.
- The human decides whether to revert or fix forward.

If the issue has no `## Integration Tests` section and no integration test suite
exists, skip this step.

---

## Done condition

The PR is done when:
- All CI checks pass.
- The PR is squash-merged into main.
- The remote branch is deleted.
- Post-merge integration tests pass (if applicable).
- Any fix worktree created in Step 2 is removed.

---

## If you get stuck

If CI keeps failing after two fix attempts, stop and reassess. Read the full
test output, not just the failing line. Ask: "Is this a real test failure, or is
the test itself wrong?" Check whether the test was written for a previous version
of the code that this PR intentionally changes.
