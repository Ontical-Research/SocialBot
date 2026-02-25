---
name: epik-planner
description: Plan a feature as GitHub issues with dependencies and integration tests.
---

Plan the next feature for a GitHub Project. Discussion in, issues out.

$ARGUMENTS is a GitHub Project URL (e.g.
`https://github.com/orgs/epik-agent/projects/5`). If no URL is given, ask for
one.

A **feature** is a set of issues worked on as a group, ordered by dependency.

---

## Phase 1 — Understand the current state

1. Extract the project number and owner from the URL.
2. Read the project board:
   ```
   .claude/skills/lib/gh-project-read.sh <owner> <project-number>
   ```
3. For each open issue, read it:
   ```
   gh issue view <number> --repo <repo> --json title,body,state,labels
   ```
4. Read the repo's top-level structure (`ls`, `README.md`, `package.json` or
   equivalent) to understand what's already built.
5. Summarize the current state to the human: what's done, what's in progress,
   what's planned but not started.

---

## Phase 2 — Discuss what to build next

Engage in conversation with the human about the next feature. Ask questions.
Challenge assumptions. Understand:

- What the feature does from a user's perspective.
- What the deployment target is (web app, CLI tool, library, API, etc.).
- What "working" looks like — how will we know the deployed thing is correct?
- What can be built incrementally vs. what needs to land together.

Do not create issues until the human says the direction is clear.

---

## Phase 3 — Design the feature

Break the feature into issues. Each issue is a unit of work that can be
implemented, tested, and merged independently (within dependency constraints).

### Wave 1 foundations: CI, build environment, and deployment

Before any feature work starts, the project must have three things in place.
If they don't already exist, the very first issue (or first two issues) in any
feature MUST establish them. These often collapse into a single "project
bootstrap" issue:

**1. Build environment.** The project needs a proper build configuration for its
language and toolchain. This is the `pyproject.toml`, `package.json`,
`Cargo.toml`, `go.mod`, etc. that defines dependencies, scripts, and project
metadata. If the repo is empty or missing this, the first issue creates it.

**2. GitHub Actions CI.** Set up a CI workflow (`.github/workflows/ci.yml` or
equivalent) that runs on every push and PR. Use standard GitHub Actions from the
marketplace — don't hand-roll what `actions/setup-node`, `actions/setup-python`,
etc. already provide. The workflow must include tests, linting, and formatting
for the language:

- **TypeScript/JavaScript:** `actions/setup-node` with `cache: 'npm'` (or
  `cache: 'pnpm'`). Steps: `npm test` (or `pnpm test:run`), `eslint .`,
  `prettier --check .`
- **Python:** `actions/setup-python` with `cache: 'pip'`. Steps: `pytest`,
  `ruff check .`, `ruff format --check .`
- **Rust:** `actions/cache` on `~/.cargo` and `target/`, `dtolnay/rust-toolchain`
  for toolchain setup. Steps: `cargo test`, `cargo clippy`, `cargo fmt --check`
- **Go:** `actions/setup-go` with `cache: true`. Steps: `go test ./...`,
  `golangci-lint run`

Always add dependency caching — it dramatically speeds up CI. The `actions/setup-*`
actions often have built-in `cache` parameters; use those first. For cases where
built-in caching isn't available, use `actions/cache` directly on the dependency
and build artifact directories.

The specifics vary, but the principle doesn't: tests, linting, and formatting
run on every PR before merge. `epik-resolve-pull-request` depends on CI passing,
so this must exist before any real work begins.

**3. Deployment target (ABD — Always Be Deploying).** When the project type
allows it, configure a live deployment with GitHub Deployment environments:

- **Web app:** Deploy a minimal page to Vercel/Fly/Netlify. Configure a
  "Preview" environment for PR deploys and a "Production" environment for main.
- **CLI tool:** Set up CI to produce a downloadable binary artifact, or publish
  to a package registry at version 0.0.1.
- **Library:** Publish to npm/PyPI/crates.io at 0.0.1. Set up a "Release"
  environment.
- **API:** Deploy a health-check endpoint to a live URL.

These provide passive visibility — the human can inspect the deployed state at
any time without running anything.

If CI, build environment, and deployment already exist, the first issue should
verify they work and extend them to cover the new feature area.

### Integration tests

Every issue includes a `## Integration Tests` section in its body. This section
contains specific, executable steps that confirm the running application
reflects the issue's changes. These go beyond unit tests — they test the
integrated system. Examples:

- `curl https://app.example.com/api/health` returns 200 with `{"status":"ok"}`
- `curl https://app.example.com/api/users` returns a JSON array
- `npx my-cli --version` prints `0.2.0`
- The Vercel Preview deployment for this PR shows the new dashboard page
- `python -m pytest tests/integration/` passes

Be specific. "Verify it works" is not acceptable. Name the URL, the command,
the expected output. These steps are what `epik-implement-issue` will execute
after unit tests pass.

### Issue structure

Each issue body follows this template:

```markdown
## Description

[What this issue does, in 2–3 sentences.]

## Acceptance Criteria

- [ ] [Specific, testable criterion]
- [ ] [Another criterion]
- [ ] All project tests pass

## Dependencies

Blocked by #N, #M [if any]

## Integration Tests

[Specific commands and expected outputs to verify the integrated system.]
```

### Issue labels

When a feature has enough issues to benefit from categorization, create labels
for broad functional areas and apply them to issues. These add color to the
Kanban board and make it easy to filter. Choose labels that reflect the feature's
structure, e.g.:

- `infra` — CI, build environment, deployment setup
- `api` — backend routes and data models
- `ui` — frontend components and pages
- `auth` — authentication and authorization
- `data` — database, migrations, seed data

Create labels with `gh label create <name> --repo <repo> --color <hex>`. Pick
distinct colors so the board is visually scannable. Don't over-label — 3–5
categories is usually right.

### Dependency rules

- An issue that depends on another must say `Blocked by #N` in its body.
- Wave 1 issues have no blockers. Wave 2 issues are blocked only by Wave 1
  issues. And so on.
- Prefer narrow dependency chains over wide ones. Deep is fine; tangled is not.
- If two issues have no dependency relationship, they belong in the same wave.

---

## Phase 4 — Create the issues

1. Create labels for functional categories (if they don't already exist):
   ```
   gh label create <name> --repo <repo> --color <hex>
   ```

2. Create each issue on the repo with its label:
   ```
   gh issue create --repo <repo> --title "<title>" --body "<body>" --label <label>
   ```

3. Set up formal dependency relationships using the GitHub API:
   ```
   .claude/skills/lib/gh-add-dependency.sh <owner> <repo> <blocked-issue> <blocker-issue>
   ```
   If the REST dependency API is not available, the `Blocked by #N` text in the
   issue body serves as fallback.

4. Add each issue to the GitHub Project:
   ```
   ITEM_ID=$(.claude/skills/lib/gh-project-add-issue.sh <owner> <project-number> <issue-url>)
   ```

5. Set each issue's status to "Todo":
   ```
   .claude/skills/lib/gh-project-set-status.sh <owner> <project-number> "$ITEM_ID" "Todo"
   ```

---

## Phase 5 — Present the wave plan

Print the wave plan as a numbered list:

```
Wave 1 (no blockers):
  #31 — Set up Vercel deployment with health endpoint
  #32 — Initialize project with TypeScript + Vitest

Wave 2 (blocked by Wave 1):
  #33 — Implement user model and API routes (blocked by #31, #32)
  #34 — Add authentication middleware (blocked by #32)

Wave 3 (blocked by Wave 2):
  #35 — Build dashboard page (blocked by #33, #34)
```

Then print the dependency graph:
```
.claude/skills/lib/gh-feature-dependency-graph.sh <owner> <repo> 31 32 33 34 35
```

Ask the human to confirm the plan before considering the planner's job done.

---

## Done condition

The planner is done when:
- All issues are created on the repo with dependency relationships.
- All issues are added to the GitHub Project with status "Todo".
- The human has confirmed the wave plan.
