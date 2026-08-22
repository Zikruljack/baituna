# Contributing to Baituna

Thank you for contributing. Baituna is an open-source project and welcomes
bug reports, documentation improvements, tests, and focused feature proposals.

## Branch workflow

Read [docs/BRANCHING.md](docs/BRANCHING.md) before creating a branch. `main` is
final code and is never a working branch. Every GitHub Issue must be implemented
on a branch named `feature/<issue-number>-<short-kebab-name>` created from `dev`.
Open its pull request into `dev`; promotions then proceed through `staging`,
`prod`, and finally `main`.

## Before opening a pull request

1. Open or find an Issue and create its required `feature/**` branch from `dev`.
2. Keep changes focused; do not mix refactors with product behaviour changes.
3. Preserve the MVP decisions in `docs/baituna-prd.md` and `docs/baituna-erd.md`.
4. Run the applicable checks:

   ```bash
   npm run lint
   npm run typecheck
   npm run build
   ```

   For mobile changes, also run `flutter analyze` from `apps/mobile`.

5. Use Conventional Commit messages, for example `feat(web): add mosque service`.

## Pull requests

Describe the problem, solution, testing performed, and any follow-up work. Link
the Issue with `Closes #<number>`. Feature pull requests target `dev` only; do
not commit secrets, local `.env` files, generated build output, or unrelated
formatting changes.

## Code of conduct

By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
