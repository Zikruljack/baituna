# Branching and release workflow

`main` is the immutable, final-code branch for Baituna. Never push directly to
it, force-push it, or use it for day-to-day work.

## Shared branches

```text
feature/<issue-number>-<short-kebab-name> -> dev -> staging -> prod -> main
```

| Branch    | Purpose                                      | Allowed incoming pull request |
| --------- | -------------------------------------------- | ----------------------------- |
| `main`    | Final, production-ready source of truth      | `prod` only                   |
| `prod`    | Production release candidate                 | `staging` only                |
| `staging` | Staging verification and release preparation | `dev` only                    |
| `dev`     | Shared integration branch                    | `feature/**` only             |

All contributors must use a `feature/**` branch for every Issue, including bug
reports, documentation, chores, and enhancements. Do not create a direct
`fix/**`, `docs/**`, or personal branch for Issue work.

## Start work from an Issue

Replace `123` and `short-description` with the GitHub Issue number and a short
kebab-case description.

```bash
git switch dev
git pull --ff-only origin dev
git switch -c feature/123-short-description
git push -u origin feature/123-short-description
```

Make focused commits using Conventional Commits. Open a pull request from the
feature branch into `dev`, link the Issue with `Closes #123`, and delete the
feature branch after merge. The Issue must not be merged directly into `dev`,
`staging`, `prod`, or `main` without its feature branch pull request.

## Promotion

After feature pull requests have been reviewed and merged into `dev`, promote
the exact branch through separate pull requests:

1. `dev` to `staging` for integration and staging verification.
2. `staging` to `prod` for release approval.
3. `prod` to `main` for the final release merge.

Do not skip a promotion stage or merge a feature branch directly to `staging`,
`prod`, or `main`.

## Required GitHub protection

Repository administrators should configure GitHub branch protection rules for
all four shared branches. For `main`, require a pull request, at least one
approval, resolved review conversations, passing `CI / Web quality checks` and
`CI / Mobile analysis`, and linear history. Disable force pushes and branch
deletion, and restrict direct pushes to maintainers or an automation account.

Apply the same no-force-push/no-deletion policy to `prod`, `staging`, and `dev`.
Require pull requests on these shared branches as well; their allowed source
branch is defined in the table above. GitHub protection must be enabled in the
repository settings by an administrator because it cannot be enforced by local
Git configuration alone.
