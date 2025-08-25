# Repository Guidelines

## Project Structure & Module Organization
- `src/`: application code grouped by feature (e.g., `src/components`, `src/pages`, `src/lib`).
- `tests/` or `__tests__/`: unit/integration tests mirroring `src/` paths.
- `public/` or `assets/`: static files served as-is.
- `scripts/`: small maintenance scripts and local tooling.
- `.github/workflows/`: CI pipelines and automation.
Prefer small, focused modules; keep feature folders cohesive.

## Build, Test, and Development Commands
- Install deps: use the repo’s lockfile to choose the manager — `npm ci` (or `pnpm i`, `yarn install`).
- Run locally: `npm run dev` (starts the local server with hot reload).
- Build production: `npm run build` (outputs to `dist/`, `.next/`, or similar).
- Run tests: `npm test` (unit/integration), add `--watch` during development.
- Lint/format: `npm run lint` / `npm run format`.
Examples for other stacks when present: Python → `pip install -r requirements.txt`, `pytest -q`; Rust → `cargo build`, `cargo test`.

## Coding Style & Naming Conventions
- Indentation: 2 spaces for JS/TS; 4 spaces for Python.
- Style: Prettier + ESLint for JS/TS; PEP8/ruff for Python.
- Naming: camelCase for variables/functions; PascalCase for components/classes; kebab-case for asset filenames; snake_case for Python modules and tests.
- Keep functions focused (< ~50 lines); extract helpers and reuse utilities in `src/lib`.

## Testing Guidelines
- Tests live in `tests/` (or `__tests__/`) and mirror `src/` structure.
- Naming: `<name>.test.ts|js` or `test_<name>.py`.
- Coverage: target ~80% on changed code; include edge cases and error paths.
- Avoid flaky tests: no real network or time-based randomness.

## Commit & Pull Request Guidelines
- Use Conventional Commits where possible: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`.
- One logical change per commit; keep messages imperative and concise.
- PRs: include a clear description, linked issues (e.g., `#123`), steps to verify, and screenshots for UI changes. Ensure CI is green and docs/tests are updated.

## Security & Configuration Tips
- Never commit secrets. Use `.env.local` and provide `.env.example` with safe defaults.
- Validate inputs at boundaries; handle errors explicitly; keep dependencies updated.

## Agent Notes
- Keep diffs minimal and scoped. When changing behavior, update tests and this guide if relevant. Always run `lint`, `test`, and `build` before opening a PR.

