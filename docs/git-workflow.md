# GameweekIQ Git Workflow

Last updated: 2026-03-01
Owner: Engineering

## Purpose
Define a clean, repeatable workflow for Linear + GitHub so issue status automation works and `main` stays stable.

## One-Time Setup
1. Install GitHub CLI.
   - `brew install gh`
2. Authenticate GitHub CLI.
   - `gh auth login`
3. Confirm auth.
   - `gh auth status`
4. Ensure Linear GitHub integration rules are enabled for:
   - Move issue to `In Review` when PR opens
   - Move issue to `Done` when PR merges

## Default Delivery Flow (Per Issue)
1. Start clean and up to date.
   - `git checkout main`
   - `git pull --ff-only origin main`
2. Create one feature branch per Linear issue.
   - `git checkout -b feature/GWIQ-<id>-<short-slug>`
3. Implement changes and run checks.
   - `npm run lint`
   - `npm run build` (when relevant for risk/scope)
4. Commit with the Linear ID in the message.
   - `git add <files>`
   - `git commit -m "GWIQ-<id> <summary>"`
5. Push branch.
   - `git push -u origin <branch>`
6. Open PR with Linear ID in title and close phrase in body.
   - `gh pr create --base main --head <branch> --title "GWIQ-<id> <title>" --body "Closes GWIQ-<id>"`
7. Merge via PR only (no direct feature pushes to `main`).
   - `gh pr merge <pr-number> --squash --delete-branch`
8. Verify final state.
   - `gh pr view <pr-number> --json number,state,mergedAt,url`
   - `git checkout main && git pull --ff-only origin main`

## Required Naming and Linking
- Branch format: `feature/GWIQ-<id>-...`
- PR title starts with `GWIQ-<id>`
- PR body includes exactly one closing keyword for the issue:
  - `Closes GWIQ-<id>` (preferred)
  - `Fixes GWIQ-<id>`
  - `Resolves GWIQ-<id>`
- Do not use only `Refs GWIQ-<id>` for merge PRs (it links but does not auto-close in Linear)

These conventions ensure Linear auto-transitions (`In Review` on PR open, `Done` on merge) when integration rules are configured.

## Golden Rules (For Linear Automation)
- Never push feature work directly to `main`.
- Always open and merge a PR for issue-linked work.
- Keep exactly one Linear issue key per PR title when possible.
- If the issue does not move automatically, check PR title/body for key/link phrase first.

## Fast Command Template
```bash
ISSUE="GWIQ-123"
SLUG="short-description"
TITLE="Short human title"

git checkout main
git pull --ff-only origin main
git checkout -b "feature/${ISSUE}-${SLUG}"

# ...make changes...
npm run lint
npm run build

git add <files>
git commit -m "${ISSUE} ${TITLE}"
git push -u origin "feature/${ISSUE}-${SLUG}"

gh pr create \
  --base main \
  --head "feature/${ISSUE}-${SLUG}" \
  --title "${ISSUE} ${TITLE}" \
  --body "Closes ${ISSUE}"

PR_NUMBER="$(gh pr view --json number --jq '.number')"
gh pr merge "$PR_NUMBER" --squash --delete-branch
```

## Branch Hygiene
- Delete merged feature branches (automated by `--delete-branch`).
- Periodically prune stale refs:
  - `git fetch --prune`
- Keep long-lived branches only when intentionally active.

## Rollback Policy
- Use revert PRs for rollback.
  - Revert merge/squash commit in a new branch
  - Open PR and merge through normal review path
- Avoid history-rewrite operations on shared branches (`main`).

## Operational Guardrails
- Prefer PR flow even for small copy changes.
- Never force-push to `main`.
- Avoid `git reset --hard` on shared branches.

## Troubleshooting
- Issue stayed in `Backlog` or `In Progress` after merge:
  - Verify PR title starts with `GWIQ-<id>`
  - Verify PR body includes a closing keyword (`Closes`/`Fixes`/`Resolves`), not only `Refs`
  - Verify merge happened via PR (not direct push to `main`)
- Issue stayed in `In Review` after merge:
  - Check merged PR body and confirm it used `Closes GWIQ-<id>` (or `Fixes`/`Resolves`)
  - If the merged PR used only `Refs`, move the issue to `Done` manually in Linear
- `gh` commands fail:
  - Run `gh auth status`
  - Re-auth with `gh auth login` if token expired
