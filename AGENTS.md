# Repository Guidelines

## Project Structure & Module Organization
- `src/`: application code grouped by feature (e.g., `src/components`, `src/pages`, `src/lib`).
- `pages/`: Next.js route entry points if still used alongside `src/`.
- `public/`: static assets served as-is (icons, images, manifest files).
- `src/__tests__/`: Jest tests mirroring `src/` paths.
- Root-level scripts like `test-*.js` are ad-hoc checks; keep new test code in `src/__tests__/`.

## Build, Test, and Development Commands
- `npm ci`: install dependencies using `package-lock.json`.
- `npm run dev`: start the local Next.js dev server with hot reload.
- `npm run build`: production build.
- `npm run start`: serve the production build.
- `npm run test`: run Jest once.
- `npm run test:watch`: Jest in watch mode.
- `npm run test:coverage` / `npm run test:ci`: coverage reports (CI-friendly settings).

## Coding Style & Naming Conventions
- Indentation: 2 spaces for JS/TS.
- Naming: `camelCase` for functions/variables, `PascalCase` for React components, `kebab-case` for asset filenames.
- Prefer small, focused modules; keep feature folders cohesive in `src/`.
- Linting: use `npx next lint` (ESLint via Next.js) before PRs.

## Testing Guidelines
- Frameworks: Jest + React Testing Library.
- Naming: `*.test.ts` or `*.test.tsx` under `src/__tests__/` mirroring `src/` paths.
- Aim for coverage on changed code and include edge/error cases.
- Avoid network calls and time-based randomness; mock external services.

## Commit & Pull Request Guidelines
- Recent commits are short, descriptive phrases (often in Spanish) without a strict prefix; keep messages concise and imperative.
- One logical change per commit.
- PRs should include a clear description, linked issues, steps to verify, and screenshots for UI changes.

## Security & Configuration Tips
- Never commit secrets; use `.env.local` and provide safe defaults in `.env.example` if needed.
- Validate inputs at boundaries and handle errors explicitly.
