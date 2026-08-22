# Contributing to Baituna

Thank you for contributing. Baituna is an open-source project and welcomes
bug reports, documentation improvements, tests, and focused feature proposals.

## Before opening a pull request

1. Open or find an issue for non-trivial changes and explain the intended scope.
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

Describe the problem, solution, testing performed, and any follow-up work. Do
not commit secrets, local `.env` files, generated build output, or unrelated
formatting changes.

## Code of conduct

By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
