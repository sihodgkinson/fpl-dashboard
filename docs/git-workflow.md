# GameweekIQ Git Workflow

Last updated: 2026-02-25
Owner: Engineering

## Purpose
Define a clean, repeatable workflow for Linear + GitHub so issue status automation works and `main` stays stable.

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

## Required Naming and Linking
- Branch format: `feature/GWIQ-<id>-...`
- PR title starts with `GWIQ-<id>`
- PR body includes `Closes GWIQ-<id>`

These conventions ensure Linear auto-transitions (`In Review` on PR open, `Done` on merge) when integration rules are configured.

## Branch Hygiene
- Delete merged feature branches (automated by `--delete-branch`).
- Periodically prune stale refs:
  - `git fetch --prune`
- Keep long-lived branches only when intentionally active (for example: `develop`).

## Rollback Policy
- Use revert PRs for rollback.
  - Revert merge/squash commit in a new branch
  - Open PR and merge through normal review path
- Avoid history-rewrite operations on shared branches (`main`, `develop`).

## Operational Guardrails
- Prefer PR flow even for small copy changes.
- Never force-push to `main`.
- Avoid `git reset --hard` on shared branches.

