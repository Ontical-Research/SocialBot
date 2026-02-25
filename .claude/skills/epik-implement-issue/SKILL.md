---
name: epik-implement-issue
description: Implement a GitHub issue in an isolated worktree with TDD.
---

Implement GitHub issue $ARGUMENTS in a feature branch using test-driven
development, then open a pull request.

---

## Step 1 — Read the issue

```
gh issue view $ARGUMENTS --json number,title,body,labels
```

Parse the issue body for:
- **Acceptance criteria** — the checklist of what "done" means.
- **Dependencies** — confirm all blocking issues are merged. Check both the
  issue body and the GitHub API:
  ```
  .claude/skills/lib/gh-read-dependencies.sh <owner> <repo> $ARGUMENTS blocked_by
  ```
  If any blocker is still open, stop and report which blockers remain.
- **Integration tests** — look for a `## Integration Tests` section. Save
  these steps for later.

---

## Step 2 — Create a worktree

Create an isolated working copy on a new branch:

```
git worktree add ../<issue-number>-<short-description> -b <issue-number>-<short-description>
cd ../<issue-number>-<short-description>
```

Branch naming: issue number + kebab-case summary, e.g. `42-add-health-endpoint`.

---

## Step 3 — Sync with main

```
git fetch origin main
git rebase origin/main
```

If the rebase has conflicts, resolve them before proceeding.

---

## Step 4 — Plan the implementation

Enter Claude Code planning mode. Read the codebase. Produce a plan that covers:
- Which files to create or modify.
- What tests to write (name them).
- What the implementation looks like at a high level.

Exit planning mode and begin implementation only after the plan is clear.

---

## Step 5 — TDD loop

For each piece of functionality:

1. Write a failing test.
2. Run the test suite. Confirm the new test fails for the right reason.
3. Write the minimum code to make the test pass.
4. Run the test suite. Confirm all tests pass.
5. Refactor if needed. Run tests again.

Repeat until all acceptance criteria are covered by tests.

After all new tests are written and passing, run the full project test suite:

```
pnpm test:run
```

(Or the project's equivalent — check `package.json`, `Makefile`, `Cargo.toml`,
`pyproject.toml`, etc. for the test command.)

Do not proceed until the full test suite is green.

---

## Step 6 — Integration tests

**General rule:** Always run integration tests. Even if the issue body doesn't
specify them, look for an existing integration test suite in the project (e.g.
`tests/integration/`, `test:integration` script, `cypress/`, `playwright/`) and
run it. New code should not break existing integration tests.

**Issue-specific tests:** If the issue body contains a `## Integration Tests`
section, execute those steps now. This may involve:
- Hitting a live URL or local dev server with `curl`.
- Running a specific integration test file or suite.
- Checking CLI output against expected values.
- Inspecting a deployed preview for expected content.

If integration tests require a running server, start one. If they require a
preview deployment, push the branch first (move step 7 before this step) and
wait for the preview to deploy.

If integration tests fail, fix the issue and re-run all tests before continuing.
The issue is not done until both unit tests AND integration tests pass.

If the issue body has no `## Integration Tests` section and no integration test
suite exists in the project, skip this step.

---

## Step 7 — Commit and push

Stage all changes and commit with a conventional commit message:

```
git add -A
git commit -m "feat(#<number>): <short description>"
```

Use the appropriate prefix: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`.

Push the branch:

```
git push -u origin <branch-name>
```

---

## Step 8 — Create a pull request

```
gh pr create --title "<conventional commit message>" --body "Closes #<number>"
```

---

## Step 9 — Clean up worktree

Return to the main working directory and remove the worktree:

```
cd ../<original-directory>
git worktree remove ../<issue-number>-<short-description>
```

---

## Done condition

The issue is done when:
- All acceptance criteria have corresponding passing tests.
- The full project test suite is green.
- Integration tests pass (if specified in the issue or present in the project).
- A pull request is open and linked to the issue.
- The worktree is removed.

---

## If you get stuck

If the same "almost there" framing has persisted across three or more attempts
at the same problem, stop. Ask: "Is the approach correct, or am I patching
around a structural problem?" Consider whether a different design would make the
problem disappear rather than require another workaround.
